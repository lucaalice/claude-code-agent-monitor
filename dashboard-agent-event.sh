#!/bin/bash
# Posts agent start/complete events to the dashboard server.
# Called by Claude Code as a PreToolUse and PostToolUse hook for the Agent tool.
# Receives JSON on stdin with tool_name, tool_input, hook_event_name, etc.

DASHBOARD_URL="http://localhost:3001/api/event"

input=$(cat)

hook_event=$(echo "$input" | jq -r '.hook_event_name // empty')
agent_type=$(echo "$input" | jq -r '.tool_input.subagent_type // "general-purpose"')
description=$(echo "$input" | jq -r '.tool_input.description // empty')

# Map hook event to dashboard event type
if [ "$hook_event" = "PreToolUse" ]; then
  event_type="agent_start"
elif [ "$hook_event" = "PostToolUse" ]; then
  event_type="agent_complete"
else
  exit 0
fi

# Also mark team-lead as running when any agent starts
if [ "$event_type" = "agent_start" ]; then
  curl -s -X POST "$DASHBOARD_URL" \
    -H 'Content-Type: application/json' \
    -d '{"type":"agent_start","agent":"team-lead","task":"Orchestrating agents"}' \
    --connect-timeout 1 --max-time 2 \
    >/dev/null 2>&1 &
fi

# Fire and forget — don't block Claude Code if dashboard is down
curl -s -X POST "$DASHBOARD_URL" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg type "$event_type" \
    --arg agent "$agent_type" \
    --arg task "$description" \
    '{type: $type, agent: $agent, task: $task}'
  )" \
  --connect-timeout 1 \
  --max-time 2 \
  >/dev/null 2>&1 &

exit 0
