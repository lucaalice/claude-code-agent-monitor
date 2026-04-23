# Claude Code Agent Dashboard

A real-time browser dashboard that monitors a team of Claude Code sub-agents. The server receives lifecycle events from Claude Code hooks, maintains agent state in memory, and streams updates to connected browsers over WebSocket. A built-in demo mode simulates agent activity without requiring Claude Code to be running.

---

## Architecture

```
Claude Code (Agent tool)
        |
        | PreToolUse / PostToolUse hooks
        v
dashboard-agent-event.sh
        |
        | POST /api/event  (fire-and-forget, 2s timeout)
        v
claude-dashboard-server.js  (Node.js, port 3001)
        |
        | in-memory agentState object
        |
        +---> GET /api/state       (snapshot poll)
        |
        +---> WebSocket /ws        (push on every state change)
                    |
                    v
         React frontend (Vite, port 5173)
         ClaudeCodeDashboard.jsx
                    |
                    +-- MetricStrip      (tokens, cost, active agents, tasks done, session time)
                    +-- TeamLeadCard     (orchestrator status + current task)
                    +-- SpecialistCard   (grid, one card per specialist)
                    +-- TaskQueue        (last 10 events, right column)
```

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18 or later | Both server and frontend build tooling |
| npm | 9 or later | Bundled with Node.js 18 |
| Claude Code | any recent | Required only for live hook events |
| `jq` | any | Used inside the hook script to parse JSON |
| `curl` | any | Used inside the hook script to POST events |

The dashboard server has one npm dependency (`ws`). The frontend uses React 19 and Vite 8.

---

## Quick Start

### 1. Install server dependencies

```bash
cd ~/Desktop/ClaudexSEO/agent-dashboard
npm install
```

### 2. Install frontend dependencies

```bash
cd ~/Desktop/ClaudexSEO/agent-dashboard/frontend
npm install
```

### 3. Start the server

```bash
# Live mode — waits for hook events from Claude Code
node claude-dashboard-server.js

# Demo mode — simulates agent activity immediately (no hooks required)
node claude-dashboard-server.js --demo
```

The server starts on port 3001 by default. You will see:

```
  Claude Code Agent Dashboard Server
  -----------------------------------
  WebSocket : ws://localhost:3001/ws
  API state : http://localhost:3001/api/state
  Post event: http://localhost:3001/api/event
  Health    : http://localhost:3001/health
  Mode      : LIVE (waiting for hook events)
```

### 4. Start the frontend

In a second terminal:

```bash
cd ~/Desktop/ClaudexSEO/agent-dashboard/frontend
npm run dev
```

Vite starts on `http://localhost:5173`. Open that URL in a browser. The dashboard connects to the WebSocket automatically and shows a boot screen until data arrives.

### 5. Install the Claude Code hooks (live mode only)

See [Hook Integration](#hook-integration) below.

---

## File Structure

```
agent-dashboard/
├── claude-dashboard-server.js    # Node.js HTTP + WebSocket server
├── package.json                  # Server package (ws dependency)
├── package-lock.json
└── frontend/
    ├── package.json              # Frontend package (React 19, Vite 8)
    ├── src/
    │   ├── main.jsx              # React entry point
    │   ├── App.jsx               # Root component (wraps ClaudeCodeDashboard)
    │   ├── ClaudeCodeDashboard.jsx  # Full dashboard UI — all components in one file
    │   ├── App.css
    │   └── index.css
    └── assets/

~/.claude/
├── settings.json                 # Claude Code hooks configuration
└── hooks/
    └── dashboard-agent-event.sh  # Hook script — reads stdin, POSTs to /api/event
```

---

## API Reference

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/state` | Returns the full `agentState` object as JSON |
| `POST` | `/api/event` | Accepts an event object; updates state and broadcasts to all WebSocket clients |
| `GET` | `/health` | Returns `{"status":"ok","demo":<bool>,"timestamp":<ms>}` |
| `OPTIONS` | `*` | CORS preflight — all origins permitted |

All responses include `Access-Control-Allow-Origin: *`.

#### POST /api/event

Request body (JSON):

```json
{
  "type":   "agent_start | agent_complete | agent_idle",
  "agent":  "<agent-name>",
  "task":   "<task description>",
  "tokens": 1500
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Event type — see values below |
| `agent` | string | yes | Agent name, must match a name in the agent team list |
| `task` | string | no | Human-readable description of the current task |
| `tokens` | number | no | Token count to add to global totals |

**Event types:**

| `type` | Effect |
|--------|--------|
| `agent_start` | Sets agent status to `running`, records `startTime`, appends task to queue |
| `agent_complete` | Sets agent status to `completed`, increments `taskCount` and `completedTasks` |
| `agent_idle` | Sets agent status to `idle`, clears `currentTask` |

Response on success:

```json
{"ok": true}
```

Response on invalid JSON:

```json
{"error": "Invalid JSON"}
```
HTTP status 400.

### WebSocket

Connect to `ws://localhost:3001/ws`.

On connection, the server immediately sends the current full state:

```json
{
  "type": "state_update",
  "payload": { ...agentState }
}
```

After every `POST /api/event`, the server broadcasts the same message shape to all connected clients:

```json
{
  "type":      "state_update",
  "payload":   { ...agentState },
  "timestamp": 1714000000000
}
```

The `payload` structure:

```json
{
  "teamLead": {
    "name":        "team-lead",
    "status":      "idle | running | completed",
    "currentTask": null,
    "model":       "opus",
    "tokensUsed":  0,
    "startTime":   null,
    "tasks":       []
  },
  "specialists": {
    "<agent-name>": {
      "name":        "<agent-name>",
      "status":      "idle | running | completed",
      "currentTask": null,
      "model":       "sonnet | inherited",
      "tokensUsed":  0,
      "startTime":   null,
      "taskCount":   0
    }
  },
  "globalMetrics": {
    "totalTokens":       0,
    "totalCost":         0.0,
    "sessionStartTime":  1714000000000,
    "activeAgents":      0,
    "completedTasks":    0
  },
  "taskQueue": [
    {
      "task":      "description",
      "agent":     "agent-name",
      "timestamp": 1714000000000,
      "status":    "in_progress"
    }
  ]
}
```

Cost is estimated at `$3.00 per 1M tokens` (applied to `totalTokens`).

---

## Hook Integration

### How it works

Claude Code fires `PreToolUse` and `PostToolUse` hook events whenever the `Agent` tool is invoked. The hook script `/Users/lucaalice/.claude/hooks/dashboard-agent-event.sh` reads the JSON payload from stdin, extracts `tool_input.subagent_type` and `tool_input.description`, maps the hook event name to a dashboard event type, and POSTs to `/api/event`.

Both `curl` calls use `--connect-timeout 1 --max-time 2` and run in the background (`&`), so a missing or slow dashboard server never blocks Claude Code.

When any sub-agent starts, the script also fires an additional `agent_start` event for `team-lead` to mark the orchestrator as active.

### Hook payload received by the script (stdin)

Claude Code writes JSON to the hook's stdin. The fields the script reads:

| Field | Used as |
|-------|---------|
| `hook_event_name` | `PreToolUse` maps to `agent_start`; `PostToolUse` maps to `agent_complete` |
| `tool_input.subagent_type` | Dashboard `agent` field (e.g. `seo-technical`) |
| `tool_input.description` | Dashboard `task` field |

### Installing the hooks

The hooks are already configured in `~/.claude/settings.json`. If you need to set them up from scratch:

**1. Create the hook script**

```bash
mkdir -p ~/.claude/hooks
cp /path/to/dashboard-agent-event.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/dashboard-agent-event.sh
```

**2. Add hooks to `~/.claude/settings.json`**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Agent",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/lucaalice/.claude/hooks/dashboard-agent-event.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Agent",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/lucaalice/.claude/hooks/dashboard-agent-event.sh"
          }
        ]
      }
    ]
  }
}
```

Replace the path with the absolute path to your hook script. Relative paths are not supported.

### Testing the hook manually

With the server running, send a test event directly:

```bash
curl -s -X POST http://localhost:3001/api/event \
  -H 'Content-Type: application/json' \
  -d '{"type":"agent_start","agent":"seo-technical","task":"Checking robots.txt","tokens":1200}'
```

---

## Configuration

### Server port

The server reads `DASHBOARD_PORT` from the environment. Default is `3001`.

```bash
DASHBOARD_PORT=4000 node claude-dashboard-server.js
```

If you change the port, update the WebSocket URL hardcoded in the frontend:

`frontend/src/ClaudeCodeDashboard.jsx`, line with `localhost:3001/ws` (two occurrences — the `useEffect` hook and the status bar footer).

### Demo mode

```bash
node claude-dashboard-server.js --demo
```

Demo mode fires a sequence of 10 pre-defined tasks at 2–4 second intervals, randomly completing running agents as new ones start. It is useful for testing the UI without Claude Code or live hooks. Demo state is not persisted — restarting the server resets everything.

### Adding or renaming agents

The agent roster is defined at the top of `claude-dashboard-server.js`:

```js
const agentTeam = [
  'team-lead',
  'scraper-debugger',
  'data-pipeline-qa',
  // ... add entries here
];
```

Rules:
- The first entry (`team-lead`) is treated as the orchestrator and rendered in the `TeamLeadCard` component. All other entries are specialists.
- The `model` field is set to `'sonnet'` for entries at index 1–8 and `'inherited'` for index 9 and beyond. Adjust the condition in the `forEach` loop if needed.
- Agent names sent via `POST /api/event` must exactly match entries in this array or they will be silently ignored.

---

## Agents and Roles

| # | Agent name | Role |
|---|-----------|------|
| — | `team-lead` | Orchestrator — delegates tasks to specialists, runs on Opus |
| 01 | `scraper-debugger` | Diagnoses and fixes broken web scrapers and CSS selectors |
| 02 | `data-pipeline-qa` | Validates data extraction, transformation, and pipeline integrity |
| 03 | `devops-monitor` | Monitors infrastructure, logs, and deployment health |
| 04 | `google-api-debugger` | Debugs Google API integrations (Search Console, Analytics, etc.) |
| 05 | `code-reviewer` | Reviews PRs for correctness, security, and style |
| 06 | `ui-ux-designer` | Produces UI specifications and component designs |
| 07 | `frontend-developer` | Implements React/JS components and frontend features |
| 08 | `documentation-expert` | Writes and maintains technical documentation |
| 09 | `seo-technical` | Crawlability, indexability, robots.txt, canonical tags |
| 10 | `seo-content` | E-E-A-T signals, content quality, keyword alignment |
| 11 | `seo-schema` | JSON-LD structured data, schema validation |
| 12 | `seo-sitemap` | XML sitemap generation and submission |
| 13 | `seo-geo` | Hreflang, geo-targeting, international SEO |
| 14 | `seo-performance` | Core Web Vitals, page speed, rendering performance |
| 15 | `seo-visual` | Image optimisation, alt text, visual search signals |

---

## Troubleshooting

### Dashboard shows "Connecting to ws://localhost:3001..."

The browser cannot reach the server. Check:

```bash
# Verify the server is running
curl http://localhost:3001/health

# Check what is listening on port 3001
lsof -i :3001
```

If the server is running on a different port, set `DASHBOARD_PORT` and update the hardcoded WebSocket URL in `ClaudeCodeDashboard.jsx`.

### Browser shows "Waiting for data..." but server is running

The WebSocket connection succeeded but no events have arrived yet. In live mode this is expected until Claude Code invokes an agent. Use demo mode to verify the UI is working:

```bash
node claude-dashboard-server.js --demo
```

Or send a manual event:

```bash
curl -s -X POST http://localhost:3001/api/event \
  -H 'Content-Type: application/json' \
  -d '{"type":"agent_start","agent":"team-lead","task":"Test task"}'
```

### Hook events are not appearing on the dashboard

1. Confirm the server is running before starting Claude Code.
2. Confirm `jq` is installed: `which jq`
3. Confirm `curl` is installed: `which curl`
4. Test the hook script manually by piping sample input:

```bash
echo '{"hook_event_name":"PreToolUse","tool_input":{"subagent_type":"seo-technical","description":"Test"}}' \
  | bash ~/.claude/hooks/dashboard-agent-event.sh
```

5. Check that the hook script is executable: `ls -la ~/.claude/hooks/dashboard-agent-event.sh`
6. Verify the path in `~/.claude/settings.json` matches the actual script location exactly (absolute path required).

### Agent events are silently dropped

The agent name in the event payload must match exactly one of the 16 names in `agentTeam` in `claude-dashboard-server.js`. The value comes from `tool_input.subagent_type` in the Agent tool call. If your agents use different `subagent_type` values, either update the hook script to remap them or add the new names to `agentTeam`.

### State does not reset between Claude Code sessions

The server holds state in memory for the duration of its process. Restart the server to reset all agent state, token counts, and the task queue:

```bash
# Ctrl-C or:
kill $(lsof -ti :3001)
node claude-dashboard-server.js
```

### Port 3001 is already in use

```bash
# Find the process
lsof -i :3001

# Kill it or start the server on a different port
DASHBOARD_PORT=3002 node claude-dashboard-server.js
```

Then update the WebSocket URL in `ClaudeCodeDashboard.jsx` to match.
