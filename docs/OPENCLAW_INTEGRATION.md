# OpenClaw Integration Guide

## Goal

Use ClawOmics as the bioinformatics workflow layer behind a natural-language OpenClaw assistant.

## Recommended Routing

### Preferred backend entry: `agent`

For a dialogue-first OpenClaw integration, call:

```bash
node scripts/clawomics.mjs agent "<user-message>" --write
```

This lets ClawOmics detect paths, infer whether the turn is planning or confirmation, and return a stable conversation payload.

### When `agent` should enter planning mode

The `agent` entrypoint should route to planning when the user:

- mentions a data directory or file path
- asks how to analyze a dataset
- asks what kind of data they have
- asks for a plan before execution

Example user messages:

- "`/data/project1` has sequencing data, help me analyze it"
- "What is in `/mnt/run42` and what should I do next?"

### When `agent` should enter execution mode

The `agent` entrypoint should route to execution only when the user gives explicit confirmation such as:

- "确认执行"
- "开始跑"
- "proceed"
- "run it"

If confirmation is ambiguous, stay in planning mode.

## Suggested OpenClaw Turn Logic

### Turn A: intake

1. Detect a path in the user message.
2. Call `agent "<user-message>" --write`.
3. Read:
   - `response.conversation.assistantMessage`
   - `response.conversation.confirmationPrompt`
   - `response.session.sessionPath`
4. Reply to the user with the planning summary and ask for confirmation.

### Turn B: confirmation

1. Detect explicit confirmation.
2. Call `agent "<confirmation-message>" --session <agent_session.json>`.
3. Read:
   - `response.conversation.assistantMessage`
   - `response.artifacts.manifest`
   - `response.actionHints`
4. Reply with the created run workspace and what can be inspected next.

### Direct command fallback

If your OpenClaw runtime prefers explicit tools over a single message router, keep this equivalent mapping:

- planning: `analyze <path> --write`
- confirmation: `run <path> --session <agent_session.json> --approve`

## Minimum Required Persistence

OpenClaw should preserve:

- input path
- `agent_session.json` path
- latest `run_manifest.json` path

This allows the conversation layer to survive model context loss or long-running threads.

If needed, the session can be reloaded explicitly with:

```bash
node scripts/clawomics.mjs session /path/to/agent_session.json
```

## Example Backend Sequence

```text
User: "/data/tumor_wgs has data, help me analyze it"
OpenClaw -> agent "/data/tumor_wgs has data, help me analyze it" --write
OpenClaw <- mode=analyze, response.agentState=awaiting_confirmation
User: "确认执行"
OpenClaw -> agent "确认执行" --session /data/tumor_wgs/agent_session.json
OpenClaw <- mode=run, response.agentState=prepared
```
