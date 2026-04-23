#!/bin/bash
# Posts agent start/complete events to the dashboard server.
# Called by Claude Code as a PreToolUse and PostToolUse hook for the Agent tool.
# Receives JSON on stdin with tool_name, tool_input, hook_event_name, etc.

DASHBOARD_URL="http://localhost:${DASHBOARD_PORT:-3001}/api/event"

input=$(cat)

hook_event=$(echo "$input" | jq -r '.hook_event_name // empty')
agent_type=$(echo "$input" | jq -r '.tool_input.subagent_type // "general-purpose"')
description=$(echo "$input" | jq -r '.tool_input.description // empty')

# Map hook event to dashboard event type
if [ "$hook_event" = "PreToolUse" ]; then
  event_type="agent_start"
elif [ "$hook_event" = "PostToolUse" ]; then
  # Check if the agent errored — look for error/failure indicators in tool_response
  is_error=$(echo "$input" | jq -r '.tool_response.is_error // false' 2>/dev/null || echo "false")
  if [ "$is_error" = "true" ]; then
    event_type="agent_error"
  else
    event_type="agent_complete"
  fi
else
  exit 0
fi

# Extract agent output and token usage from PostToolUse response
tokens=0
agent_output=""
if [ "$hook_event" = "PostToolUse" ]; then
  agent_output=$(echo "$input" | jq -r '.tool_response.output // empty' | cut -c 1-4000)
fi

if [ "$event_type" = "agent_complete" ] || [ "$event_type" = "agent_error" ]; then
  # Extract total_tokens from the output text (format: "total_tokens: 12345" or "total_tokens:12345")
  # Uses sed instead of grep -P for macOS compatibility
  raw_tokens=$(echo "$agent_output" | sed -n 's/.*total_tokens[: ]*\([0-9][0-9]*\).*/\1/p' | head -1)
  if [ -n "$raw_tokens" ] && [ "$raw_tokens" -gt 0 ] 2>/dev/null; then
    tokens=$raw_tokens
  fi
  # Also try the usage block directly if present in tool_response JSON
  usage_tokens=$(echo "$input" | jq -r '.tool_response.usage.total_tokens // 0' 2>/dev/null || echo "0")
  if [ "$usage_tokens" -gt "$tokens" ] 2>/dev/null; then
    tokens=$usage_tokens
  fi
fi

# Also mark team-lead as running when any agent starts
if [ "$event_type" = "agent_start" ] && [ "$agent_type" != "team-lead" ]; then
  lead_task="Delegating to ${agent_type}: ${description:-no description}"
  curl -s -X POST "$DASHBOARD_URL" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg task "$lead_task" '{"type":"agent_start","agent":"team-lead","task":$task}')" \
    --connect-timeout 1 --max-time 2 \
    >/dev/null 2>&1 &
fi

# Ensure tokens is a valid number for jq --argjson
tokens=$(echo "$tokens" | grep -E '^[0-9]+$' || echo "0")
[ -z "$tokens" ] && tokens=0

# Fire and forget — don't block Claude Code if dashboard is down
curl -s -X POST "$DASHBOARD_URL" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg type "$event_type" \
    --arg agent "$agent_type" \
    --arg task "$description" \
    --argjson tokens "$tokens" \
    --arg output "$agent_output" \
    '{type: $type, agent: $agent, task: $task, tokens: $tokens, output: $output}'
  )" \
  --connect-timeout 1 \
  --max-time 2 \
  >/dev/null 2>&1 &

exit 0
