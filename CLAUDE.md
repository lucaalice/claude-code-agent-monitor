# Claude Code Agent Dashboard

## Project Overview

Real-time browser dashboard for monitoring Claude Code subagent activity. Captures lifecycle events from Claude Code hooks (PreToolUse/PostToolUse on the Agent tool), persists state to SQLite, and streams updates to connected browsers over WebSocket.

## Architecture

```
Claude Code (Agent tool)
    │ PreToolUse / PostToolUse hooks
    ▼
~/.claude/hooks/dashboard-agent-event.sh
    │ POST /api/event (fire-and-forget, 2s timeout)
    ▼
claude-dashboard-server.js  (Node.js, port 3001)
    │ SQLite (dashboard.db) + WebSocket /ws
    ▼
frontend/src/ClaudeCodeDashboard.jsx  (React 19, Vite, port 4000)
```

## File Layout

| File | Purpose |
|------|---------|
| `claude-dashboard-server.js` | Node.js HTTP + WebSocket server, SQLite persistence, event handler, model-based pricing |
| `dashboard-agent-event.sh` | Bash hook script — extracts agent type, tokens, usage breakdown, output from hook stdin |
| `frontend/src/ClaudeCodeDashboard.jsx` | Full dashboard UI — single-file React component with inline styles |
| `dashboard.db` | SQLite database (auto-created) — agents, metrics, task_queue, timeline, sessions, agent_logs |
| `com.claude.dashboard-server.plist` | macOS launchd plist — auto-start server on login |
| `com.claude.dashboard-frontend.plist` | macOS launchd plist — auto-start frontend on login |

## Key Concepts

### Agent Hierarchy

```
team-lead (opus) — orchestrator
├── scraper-debugger (sonnet)
├── data-pipeline-qa (sonnet)
├── devops-monitor (sonnet)
├── google-api-debugger (sonnet)
├── code-reviewer (sonnet)
├── ui-ux-designer (sonnet)
├── frontend-developer (sonnet)
├── documentation-expert (sonnet)
└── seo-manager (sonnet) — sub-orchestrator
    ├── seo-technical, seo-content, seo-schema
    ├── seo-sitemap, seo-geo, seo-performance, seo-visual
```

Unknown agents from hook events are auto-registered with sonnet model.

### Event Types

| Type | Effect |
|------|--------|
| `agent_start` | Sets running, records startTime, opens timeline row, inserts task_queue entry |
| `agent_complete` | Sets completed, increments allTime counters, closes timeline row |
| `agent_error` | Sets error, increments allTime counters, closes timeline row |
| `agent_idle` | Sets idle — for team-lead, only fires when ALL specialists are done |

### All-Time vs Session Metrics

Metrics table has dual counters:
- **Session-scoped**: `totalTokens`, `totalCost`, `completedTasks` — reset on archive/reset
- **All-time**: `allTimeTokens`, `allTimeCost`, `allTimeCompleted` — never reset, cumulative forever

Agents table mirrors this: `tokensUsed`/`taskCount` (session) vs `allTimeTokens`/`allTimeTasks` (permanent).

The metric strip shows all-time values as primary, with session sub-values underneath.

### Model-Based Pricing

Hook sends full usage breakdown from `.tool_response.usage`:
- `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`

Server calculates cost per model:
| Model | Input | Output | Cache Read | Cache Creation |
|-------|-------|--------|------------|----------------|
| Opus | $15/M | $75/M | $1.50/M | $18.75/M |
| Sonnet | $3/M | $15/M | $0.30/M | $3.75/M |
| Haiku | $0.80/M | $4/M | $0.08/M | $1.00/M |

Falls back to flat $3/M if no usage breakdown is provided.

### Task Queue Persistence

Task queue entries are never deleted — they accumulate across sessions for long-term tracking. `loadState()` returns the last 200 entries. Archive/reset only clears session-scoped agent fields and the timeline table.

## Hook Integration

The hook script lives at `~/.claude/hooks/dashboard-agent-event.sh` and is registered in `~/.claude/settings.json` as a global hook (applies to all projects):

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Agent", "hooks": [{ "type": "command", "command": "/Users/lucaalice/.claude/hooks/dashboard-agent-event.sh" }] }],
    "PostToolUse": [{ "matcher": "Agent", "hooks": [{ "type": "command", "command": "/Users/lucaalice/.claude/hooks/dashboard-agent-event.sh" }] }]
  }
}
```

Hook reads from stdin: `hook_event_name`, `tool_input.subagent_type`, `tool_input.description`, `tool_response.totalTokens`, `tool_response.usage.*`, `tool_response.content[].text`, `tool_response.is_error`.

All curl calls use `--connect-timeout 1 --max-time 2` and run in background — dashboard being down never blocks Claude Code.

## Running

```bash
# Server (auto-started via launchd)
node claude-dashboard-server.js          # live mode
node claude-dashboard-server.js --demo   # simulated agents

# Frontend (auto-started via launchd)
cd frontend && npm run dev -- --port 4000
```

Server: http://localhost:3001 | Frontend: http://localhost:4000

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/event` | Accept event from hook, update state, broadcast via WS |
| `GET` | `/api/state` | Full state snapshot |
| `GET` | `/api/timeline` | Timeline entries for current session |
| `GET` | `/api/sessions` | List archived sessions |
| `GET` | `/api/sessions/:id` | Single archived session with agent snapshot |
| `GET` | `/api/logs/:agent` | Last 20 log entries for an agent |
| `POST` | `/api/session/archive` | Archive current session, reset session metrics |
| `POST` | `/api/reset` | Reset session metrics (preserves allTime + task_queue) |
| `GET` | `/health` | Health check |

## Development Notes

- Frontend is a single JSX file with inline styles using design token object `T` — no CSS files needed
- SQLite uses WAL mode for concurrent reads during writes
- WebSocket auto-reconnects with exponential backoff (1s → 15s)
- Server pings clients every 30s to detect dead connections
- Team-lead idle race prevention: server checks `countRunning` before allowing team-lead to go idle
- `roundRect` canvas API has a polyfill for Safari < 15.4
- Favicon dynamically shows active agent count as a red badge
- Schema migrations run automatically on startup (columnExists checks)
- `dashboard.db` is gitignored — state is per-machine

## Common Operations

```bash
# Test manually
curl -s -X POST http://localhost:3001/api/event \
  -H 'Content-Type: application/json' \
  -d '{"type":"agent_start","agent":"seo-technical","task":"Test task"}'

# Check state
curl -s http://localhost:3001/api/state | python3 -m json.tool

# Reset session (preserves all-time)
curl -s -X POST http://localhost:3001/api/reset

# Restart server
kill $(lsof -ti :3001); node claude-dashboard-server.js &
```
