#!/usr/bin/env node

/**
 * Claude Code Agent Dashboard Server
 *
 * Data sources:
 *   1. POST /api/event  — structured JSON from Claude Code hooks
 *   2. --demo           — simulated agent activity for testing the UI
 *
 * State is persisted to SQLite (dashboard.db). Survives server restarts.
 * Broadcasts state to browsers via WebSocket on /ws.
 */

const http = require('http');
const WebSocket = require('ws');
const Database = require('better-sqlite3');
const path = require('path');

const PORT = process.env.DASHBOARD_PORT || 3001;
const DEMO = process.argv.includes('--demo');
const DB_PATH = path.join(__dirname, 'dashboard.db');

// ── Model-based pricing (per 1M tokens) ────────────────────────────

const MODEL_PRICING = {
  opus:      { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheCreation: 18.75 },
  sonnet:    { input:  3.00, output: 15.00, cacheRead: 0.30,  cacheCreation:  3.75 },
  haiku:     { input:  0.80, output:  4.00, cacheRead: 0.08,  cacheCreation:  1.00 },
  inherited: { input:  3.00, output: 15.00, cacheRead: 0.30,  cacheCreation:  3.75 }, // default to sonnet rates
};

function calculateCost(model, usage) {
  const rates = MODEL_PRICING[model] || MODEL_PRICING.sonnet;
  const { input_tokens = 0, output_tokens = 0, cache_read = 0, cache_creation = 0 } = usage;
  return (
    (input_tokens * rates.input / 1_000_000) +
    (output_tokens * rates.output / 1_000_000) +
    (cache_read * rates.cacheRead / 1_000_000) +
    (cache_creation * rates.cacheCreation / 1_000_000)
  );
}

// ── Agent team definition ──────────────────────────────────────────

const agentTeam = [
  'team-lead',
  'scraper-debugger',
  'data-pipeline-qa',
  'devops-monitor',
  'google-api-debugger',
  'code-reviewer',
  'ui-ux-designer',
  'frontend-developer',
  'documentation-expert',
  'seo-manager',
  'seo-technical',
  'seo-content',
  'seo-schema',
  'seo-sitemap',
  'seo-geo',
  'seo-performance',
  'seo-visual',
];

// ── SQLite persistence ─────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    name        TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'idle',
    currentTask TEXT,
    model       TEXT NOT NULL DEFAULT 'sonnet',
    tokensUsed  INTEGER NOT NULL DEFAULT 0,
    startTime   INTEGER,
    taskCount   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    totalTokens     INTEGER NOT NULL DEFAULT 0,
    totalCost       REAL NOT NULL DEFAULT 0,
    sessionStartTime INTEGER NOT NULL,
    completedTasks  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS task_queue (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    task      TEXT NOT NULL,
    agent     TEXT,
    timestamp INTEGER NOT NULL,
    status    TEXT NOT NULL DEFAULT 'in_progress',
    tokens    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    startTime       INTEGER NOT NULL,
    endTime         INTEGER NOT NULL,
    totalTokens     INTEGER NOT NULL DEFAULT 0,
    totalCost       REAL NOT NULL DEFAULT 0,
    completedTasks  INTEGER NOT NULL DEFAULT 0,
    agentSnapshot   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    agent      TEXT NOT NULL,
    timestamp  INTEGER NOT NULL,
    output     TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'complete'
  );
  CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent);

  CREATE TABLE IF NOT EXISTS timeline (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    agent     TEXT NOT NULL,
    task      TEXT,
    startTime INTEGER NOT NULL,
    endTime   INTEGER,
    status    TEXT NOT NULL DEFAULT 'running'
  );
  CREATE INDEX IF NOT EXISTS idx_timeline_agent ON timeline(agent);
  CREATE INDEX IF NOT EXISTS idx_timeline_starttime ON timeline(startTime);
`);

// ── Schema migrations — add all-time columns if missing ──────────

function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

if (!columnExists('metrics', 'allTimeTokens')) {
  db.exec(`
    ALTER TABLE metrics ADD COLUMN allTimeTokens     INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE metrics ADD COLUMN allTimeCost        REAL    NOT NULL DEFAULT 0;
    ALTER TABLE metrics ADD COLUMN allTimeCompleted   INTEGER NOT NULL DEFAULT 0;
  `);
  // Backfill from current session + archived sessions
  const current = db.prepare('SELECT totalTokens, totalCost, completedTasks FROM metrics WHERE id = 1').get();
  const archived = db.prepare('SELECT COALESCE(SUM(totalTokens),0) as t, COALESCE(SUM(totalCost),0) as c, COALESCE(SUM(completedTasks),0) as d FROM sessions').get();
  db.prepare('UPDATE metrics SET allTimeTokens = ?, allTimeCost = ?, allTimeCompleted = ? WHERE id = 1').run(
    current.totalTokens + archived.t,
    current.totalCost + archived.c,
    current.completedTasks + archived.d
  );
  console.log('[MIGRATION] Added allTime columns to metrics, backfilled from history');
}

if (!columnExists('agents', 'allTimeTokens')) {
  db.exec(`
    ALTER TABLE agents ADD COLUMN allTimeTokens INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE agents ADD COLUMN allTimeTasks  INTEGER NOT NULL DEFAULT 0;
  `);
  // Backfill from current values
  db.prepare('UPDATE agents SET allTimeTokens = tokensUsed, allTimeTasks = taskCount').run();
  console.log('[MIGRATION] Added allTime columns to agents, backfilled');
}

// Seed agents if table is empty
const agentCount = db.prepare('SELECT COUNT(*) as c FROM agents').get().c;
if (agentCount === 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO agents (name, model) VALUES (?, ?)');
  const tx = db.transaction(() => {
    agentTeam.forEach((name, i) => {
      const model = name === 'team-lead' ? 'opus' : (i < 10 ? 'sonnet' : 'inherited');
      insert.run(name, model);
    });
  });
  tx();
}

// Seed metrics if not exists
const metricsExists = db.prepare('SELECT COUNT(*) as c FROM metrics').get().c;
if (metricsExists === 0) {
  db.prepare('INSERT INTO metrics (id, sessionStartTime) VALUES (1, ?)').run(Date.now());
}

// ── State helpers ──────────────────────────────────────────────────

function loadState() {
  const agents = db.prepare('SELECT * FROM agents').all();
  const metrics = db.prepare('SELECT * FROM metrics WHERE id = 1').get();
  const tasks = db.prepare('SELECT * FROM task_queue ORDER BY id DESC LIMIT 200').all().reverse();

  const teamLead = agents.find((a) => a.name === 'team-lead') || {
    name: 'team-lead', status: 'idle', currentTask: null, model: 'opus',
    tokensUsed: 0, startTime: null, taskCount: 0,
  };

  // Attach latest log output to each agent
  const logMap = {};
  stmts.latestLogs.all().forEach((row) => { logMap[row.agent] = row.output; });

  const specialists = {};
  agents.filter((a) => a.name !== 'team-lead').forEach((a) => {
    a.lastOutput = logMap[a.name] || null;
    specialists[a.name] = a;
  });

  const activeAgents = agents.filter((a) => a.status === 'running').length;

  return {
    teamLead,
    specialists,
    globalMetrics: {
      totalTokens: metrics.allTimeTokens,
      totalCost: metrics.allTimeCost,
      sessionStartTime: metrics.sessionStartTime,
      activeAgents,
      completedTasks: metrics.allTimeCompleted,
      // Session-scoped metrics for reference
      sessionTokens: metrics.totalTokens,
      sessionCost: metrics.totalCost,
      sessionCompleted: metrics.completedTasks,
    },
    taskQueue: tasks,
  };
}

// Prepared statements for hot path
const stmts = {
  setRunning: db.prepare(`
    UPDATE agents SET status = 'running', startTime = ?, currentTask = COALESCE(?, currentTask)
    WHERE name = ?
  `),
  setCompleted: db.prepare(`
    UPDATE agents SET status = 'completed', currentTask = NULL, taskCount = taskCount + 1
    WHERE name = ?
  `),
  setIdle: db.prepare(`
    UPDATE agents SET status = 'idle', currentTask = NULL WHERE name = ?
  `),
  setError: db.prepare(`
    UPDATE agents SET status = 'error', taskCount = taskCount + 1 WHERE name = ?
  `),
  addTokens: db.prepare(`
    UPDATE agents SET tokensUsed = tokensUsed + ?, allTimeTokens = allTimeTokens + ? WHERE name = ?
  `),
  addGlobalTokens: db.prepare(`
    UPDATE metrics SET totalTokens = totalTokens + ?, allTimeTokens = allTimeTokens + ? WHERE id = 1
  `),
  updateCost: db.prepare(`
    UPDATE metrics SET totalCost = totalCost + ?, allTimeCost = allTimeCost + ? WHERE id = 1
  `),
  incCompleted: db.prepare(`
    UPDATE metrics SET completedTasks = completedTasks + 1, allTimeCompleted = allTimeCompleted + 1 WHERE id = 1
  `),
  incAgentAllTimeTasks: db.prepare(`
    UPDATE agents SET allTimeTasks = allTimeTasks + 1 WHERE name = ?
  `),
  insertTask: db.prepare(`
    INSERT INTO task_queue (task, agent, timestamp, status, tokens) VALUES (?, ?, ?, ?, ?)
  `),
  completeLatestTask: db.prepare(`
    UPDATE task_queue SET status = 'completed'
    WHERE id = (SELECT MAX(id) FROM task_queue WHERE agent = ? AND status = 'in_progress')
  `),
  errorLatestTask: db.prepare(`
    UPDATE task_queue SET status = 'error'
    WHERE id = (SELECT MAX(id) FROM task_queue WHERE agent = ? AND status = 'in_progress')
  `),
  agentExists: db.prepare('SELECT 1 FROM agents WHERE name = ?'),
  insertAgent: db.prepare('INSERT OR IGNORE INTO agents (name, model) VALUES (?, ?)'),
  resetSession: db.prepare(`
    UPDATE metrics SET totalTokens = 0, totalCost = 0, completedTasks = 0, sessionStartTime = ? WHERE id = 1
  `),
  insertLog: db.prepare(`
    INSERT INTO agent_logs (agent, timestamp, output, event_type) VALUES (?, ?, ?, ?)
  `),
  latestLogs: db.prepare(`
    SELECT agent, output FROM agent_logs WHERE id IN (
      SELECT MAX(id) FROM agent_logs GROUP BY agent
    )
  `),
  agentLogs: db.prepare(`
    SELECT id, agent, timestamp, output, event_type FROM agent_logs
    WHERE agent = ? ORDER BY id DESC LIMIT 20
  `),
  archiveSession: db.prepare(`
    INSERT INTO sessions (startTime, endTime, totalTokens, totalCost, completedTasks, agentSnapshot)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  listSessions: db.prepare(`
    SELECT id, startTime, endTime, totalTokens, totalCost, completedTasks FROM sessions
    ORDER BY id DESC LIMIT 50
  `),
  getSession: db.prepare(`SELECT * FROM sessions WHERE id = ?`),
  getAgentModel: db.prepare('SELECT model FROM agents WHERE name = ?'),
  countRunning: db.prepare("SELECT COUNT(*) as c FROM agents WHERE status='running' AND name != 'team-lead'"),
  timelineStart: db.prepare(`
    INSERT INTO timeline (agent, task, startTime, status) VALUES (?, ?, ?, 'running')
  `),
  timelineEnd: db.prepare(`
    UPDATE timeline SET endTime = ?, status = ?
    WHERE id = (SELECT MAX(id) FROM timeline WHERE agent = ? AND status = 'running')
  `),
  timelineAll: db.prepare(`
    SELECT * FROM timeline
    WHERE startTime >= (SELECT sessionStartTime FROM metrics WHERE id = 1)
    ORDER BY startTime ASC LIMIT 500
  `),
};

// ── Event handler ──────────────────────────────────────────────────

function handleEvent(evt) {
  const { type, agent, task, tokens, output, usage } = evt;
  if (!type || !agent || typeof agent !== 'string') return;

  // Auto-register unknown agents
  if (!stmts.agentExists.get(agent)) {
    stmts.insertAgent.run(agent, 'sonnet');
  }

  if (type === 'agent_start') {
    stmts.setRunning.run(Date.now(), task || null, agent);
    stmts.timelineStart.run(agent, task || null, Date.now());
    if (task) {
      stmts.insertTask.run(task, agent, Date.now(), 'in_progress', tokens || 0);
    }
  }

  if (type === 'agent_complete') {
    stmts.setCompleted.run(agent);
    stmts.incCompleted.run();
    stmts.incAgentAllTimeTasks.run(agent);
    stmts.completeLatestTask.run(agent);
    stmts.timelineEnd.run(Date.now(), 'completed', agent);
    stmts.insertTask.run(`Completed: ${task || agent}`, agent, Date.now(), 'completed', tokens || 0);
  }

  if (type === 'agent_idle') {
    // Only idle if no other specialists are still running (prevents premature team-lead idle)
    if (agent === 'team-lead') {
      const stillRunning = stmts.countRunning.get().c;
      if (stillRunning > 0) return; // other agents still working
    }
    stmts.setIdle.run(agent);
    stmts.timelineEnd.run(Date.now(), 'completed', agent);
  }

  if (type === 'agent_error') {
    stmts.setError.run(agent);
    stmts.incAgentAllTimeTasks.run(agent);
    stmts.errorLatestTask.run(agent);
    stmts.timelineEnd.run(Date.now(), 'error', agent);
    stmts.insertTask.run(`Error: ${task || agent}`, agent, Date.now(), 'error', tokens || 0);
  }

  if (tokens && tokens > 0) {
    stmts.addTokens.run(tokens, tokens, agent);
    stmts.addGlobalTokens.run(tokens, tokens);

    // Model-based cost calculation
    const agentRow = stmts.getAgentModel.get(agent);
    const model = agentRow ? agentRow.model : 'sonnet';
    let cost = 0;
    if (usage && typeof usage.input_tokens === 'number') {
      cost = calculateCost(model, usage);
    } else {
      cost = tokens * 3.0 / 1_000_000;
    }
    stmts.updateCost.run(cost, cost);
  }

  // Store agent output log if provided
  if (output && agent) {
    const eventType = type === 'agent_error' ? 'error' : 'complete';
    stmts.insertLog.run(agent, Date.now(), output.slice(0, 4000), eventType);
  }

  broadcastState();
}

// ── WebSocket ──────────────────────────────────────────────────────

const wsServer = new WebSocket.Server({ noServer: true });
let clients = [];

wsServer.on('connection', (ws) => {
  console.log('[WS] Client connected');
  clients.push(ws);
  ws.send(JSON.stringify({ type: 'state_update', payload: loadState() }));

  // Ping/pong to keep connection alive
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('close', () => {
    clients = clients.filter((c) => c !== ws);
  });
});

// Ping all clients every 30s to detect dead connections
setInterval(() => {
  clients = clients.filter((ws) => {
    if (!ws.isAlive) { ws.terminate(); return false; }
    ws.isAlive = false;
    ws.ping();
    return true;
  });
}, 30_000);

function broadcastState() {
  const state = loadState();
  const msg = JSON.stringify({ type: 'state_update', payload: state, timestamp: Date.now() });
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// ── HTTP server ────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(loadState()));
  }

  if (req.url === '/api/event' && req.method === 'POST') {
    let body = '';
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      body += chunk;
      if (body.length > 65536) { aborted = true; res.writeHead(413); res.end(); req.destroy(); }
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const evt = JSON.parse(body);
        handleEvent(evt);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (req.url === '/api/reset' && req.method === 'POST') {
    // Reset session-scoped agent fields but preserve allTime counters
    db.prepare("UPDATE agents SET status = 'idle', currentTask = NULL, tokensUsed = 0, startTime = NULL, taskCount = 0").run();
    db.prepare('DELETE FROM timeline').run();
    stmts.resetSession.run(Date.now());
    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, message: 'State reset' }));
  }

  // Session archive — snapshot current session, then reset
  if (req.url === '/api/session/archive' && req.method === 'POST') {
    const metrics = db.prepare('SELECT * FROM metrics WHERE id = 1').get();
    const agents = db.prepare('SELECT * FROM agents').all();
    const result = stmts.archiveSession.run(
      metrics.sessionStartTime, Date.now(),
      metrics.totalTokens, metrics.totalCost, metrics.completedTasks,
      JSON.stringify(agents)
    );
    // Reset session-scoped fields but preserve allTime counters and task_queue history
    db.prepare("UPDATE agents SET status = 'idle', currentTask = NULL, tokensUsed = 0, startTime = NULL, taskCount = 0").run();
    db.prepare('DELETE FROM timeline').run();
    stmts.resetSession.run(Date.now());
    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, sessionId: result.lastInsertRowid }));
  }

  if (req.url === '/api/sessions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(stmts.listSessions.all()));
  }

  const sessionMatch = req.url.match(/^\/api\/sessions\/(\d+)$/);
  if (sessionMatch && req.method === 'GET') {
    const row = stmts.getSession.get(parseInt(sessionMatch[1]));
    if (!row) { res.writeHead(404); return res.end('Not Found'); }
    try { row.agentSnapshot = JSON.parse(row.agentSnapshot); } catch { row.agentSnapshot = []; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(row));
  }

  if (req.url === '/api/timeline' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(stmts.timelineAll.all()));
  }

  const logsMatch = req.url.match(/^\/api\/logs\/([a-z0-9_-]+)$/);
  if (logsMatch && req.method === 'GET') {
    const logs = stmts.agentLogs.all(logsMatch[1]);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(logs));
  }

  if (req.url === '/api/analytics' && req.method === 'GET') {
    const agents = db.prepare('SELECT name, model, allTimeTokens, allTimeTasks, tokensUsed, taskCount FROM agents ORDER BY allTimeTokens DESC').all();
    const sessions = stmts.listSessions.all();
    const timeline = stmts.timelineAll.all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ agents, sessions, timeline }));
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', demo: DEMO, persisted: true, timestamp: Date.now() }));
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wsServer.handleUpgrade(request, socket, head, (ws) => wsServer.emit('connection', ws, request));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`\n  Claude Code Agent Dashboard Server`);
  console.log(`  -----------------------------------`);
  console.log(`  WebSocket : ws://localhost:${PORT}/ws`);
  console.log(`  API state : http://localhost:${PORT}/api/state`);
  console.log(`  Post event: http://localhost:${PORT}/api/event`);
  console.log(`  Reset     : POST http://localhost:${PORT}/api/reset`);
  console.log(`  Health    : http://localhost:${PORT}/health`);
  console.log(`  Database  : ${DB_PATH}`);
  console.log(`  Mode      : ${DEMO ? 'DEMO (simulated agents)' : 'LIVE (waiting for hook events)'}\n`);
});

// ── Demo mode ──────────────────────────────────────────────────────

if (DEMO) {
  const demoTasks = [
    { agent: 'team-lead', task: 'Orchestrating full SEO audit for example.com' },
    { agent: 'seo-technical', task: 'Checking crawlability and robots.txt' },
    { agent: 'seo-content', task: 'Analyzing E-E-A-T signals on /blog' },
    { agent: 'seo-schema', task: 'Validating JSON-LD structured data' },
    { agent: 'frontend-developer', task: 'Building responsive nav component' },
    { agent: 'code-reviewer', task: 'Reviewing PR #42 for security issues' },
    { agent: 'seo-performance', task: 'Measuring Core Web Vitals' },
    { agent: 'documentation-expert', task: 'Updating API docs for v2 endpoints' },
    { agent: 'scraper-debugger', task: 'Fixing broken selector on retailer page' },
    { agent: 'seo-sitemap', task: 'Generating XML sitemap for 500 pages' },
  ];

  let step = 0;

  function demoStep() {
    if (step < demoTasks.length) {
      const { agent, task } = demoTasks[step];
      handleEvent({ type: 'agent_start', agent, task });
      console.log(`[DEMO] ${agent} started: ${task}`);
    }

    if (step > 2) {
      const state = loadState();
      const running = Object.values(state.specialists).filter((a) => a.status === 'running');
      if (running.length > 0) {
        const toComplete = running[Math.floor(Math.random() * running.length)];
        setTimeout(() => {
          handleEvent({ type: 'agent_complete', agent: toComplete.name, tokens: Math.floor(Math.random() * 3000) });
          console.log(`[DEMO] ${toComplete.name} completed`);
        }, 1500);
      }
    }

    step++;
    if (step <= demoTasks.length + 5) {
      setTimeout(demoStep, 2000 + Math.random() * 2000);
    }
  }

  setTimeout(demoStep, 1000);
}

// ── Graceful shutdown ──────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.close();
  server.close(() => process.exit(0));
});
