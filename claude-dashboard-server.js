#!/usr/bin/env node

/**
 * Claude Code Agent Dashboard Server
 *
 * Data sources:
 *   1. POST /api/event  — structured JSON from Claude Code hooks
 *   2. --demo           — simulated agent activity for testing the UI
 *
 * Broadcasts state to browsers via WebSocket on /ws
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.DASHBOARD_PORT || 3001;
const DEMO = process.argv.includes('--demo');

// ── Agent state store ──────────────────────────────────────────────

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
  'seo-technical',
  'seo-content',
  'seo-schema',
  'seo-sitemap',
  'seo-geo',
  'seo-performance',
  'seo-visual',
];

const agentState = {
  teamLead: {
    name: 'team-lead',
    status: 'idle',
    currentTask: null,
    model: 'opus',
    tokensUsed: 0,
    startTime: null,
    tasks: [],
  },
  specialists: {},
  globalMetrics: {
    totalTokens: 0,
    totalCost: 0,
    sessionStartTime: Date.now(),
    activeAgents: 0,
    completedTasks: 0,
  },
  taskQueue: [],
};

agentTeam.forEach((name, i) => {
  if (name !== 'team-lead') {
    agentState.specialists[name] = {
      name,
      status: 'idle',
      currentTask: null,
      model: i < 9 ? 'sonnet' : 'inherited',
      tokensUsed: 0,
      startTime: null,
      taskCount: 0,
    };
  }
});

// ── Helpers ────────────────────────────────────────────────────────

function recalcActiveAgents() {
  agentState.globalMetrics.activeAgents =
    Object.values(agentState.specialists).filter((a) => a.status === 'running').length +
    (agentState.teamLead.status === 'running' ? 1 : 0);
}

// ── Event handler (called from POST /api/event or demo) ──────────

function handleEvent(evt) {
  const { type, agent, task, tokens } = evt;

  if (type === 'agent_start') {
    if (agent === 'team-lead') {
      agentState.teamLead.status = 'running';
      agentState.teamLead.startTime = agentState.teamLead.startTime || Date.now();
      if (task) agentState.teamLead.currentTask = task;
    } else if (agentState.specialists[agent]) {
      agentState.specialists[agent].status = 'running';
      agentState.specialists[agent].startTime = Date.now();
      if (task) agentState.specialists[agent].currentTask = task;
    }
    if (task) {
      agentState.taskQueue.push({ task, agent, timestamp: Date.now(), status: 'in_progress' });
    }
  }

  if (type === 'agent_complete') {
    if (agent === 'team-lead') {
      agentState.teamLead.status = 'completed';
      agentState.teamLead.currentTask = null;
    } else if (agentState.specialists[agent]) {
      agentState.specialists[agent].status = 'completed';
      agentState.specialists[agent].currentTask = null;
      agentState.specialists[agent].taskCount++;
    }
    agentState.globalMetrics.completedTasks++;
  }

  if (type === 'agent_idle' && agentState.specialists[agent]) {
    agentState.specialists[agent].status = 'idle';
    agentState.specialists[agent].currentTask = null;
  }

  if (tokens) {
    agentState.globalMetrics.totalTokens += tokens;
    agentState.globalMetrics.totalCost = (agentState.globalMetrics.totalTokens / 1_000_000) * 3;
  }

  recalcActiveAgents();
  broadcastState();
}

// ── WebSocket ──────────────────────────────────────────────────────

const wsServer = new WebSocket.Server({ noServer: true });
let clients = [];

wsServer.on('connection', (ws) => {
  console.log('[WS] Client connected');
  clients.push(ws);
  ws.send(JSON.stringify({ type: 'state_update', payload: agentState }));
  ws.on('close', () => {
    clients = clients.filter((c) => c !== ws);
  });
});

function broadcastState() {
  const msg = JSON.stringify({ type: 'state_update', payload: agentState, timestamp: Date.now() });
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
    return res.end(JSON.stringify(agentState));
  }

  if (req.url === '/api/event' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
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

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', demo: DEMO, timestamp: Date.now() }));
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
  console.log(`  Health    : http://localhost:${PORT}/health`);
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
      handleEvent({ type: 'agent_start', agent, task, tokens: Math.floor(Math.random() * 5000) + 1000 });
      console.log(`[DEMO] ${agent} started: ${task}`);
    }

    // Complete a random running agent after a few have started
    if (step > 2) {
      const running = Object.values(agentState.specialists).filter((a) => a.status === 'running');
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
  server.close(() => process.exit(0));
});
