# Chat Channel Routing

Use this document when ClawOmics sits behind Feishu, Telegram, or any other mixed-purpose chat channel.

## Goal

Users should not need to say:
- "call ClawOmics"
- "use the bioinformatics tool"
- "start the MCP service"

The host should decide automatically when a message belongs to ClawOmics.

## Recommended Routing Strategy

### Step 1: ask ClawOmics whether it should handle the message

Call:

- MCP tool: `clawomics_should_route_message`

Input:

```json
{
  "message": "原始聊天消息",
  "context_key": "feishu-chat-123"
}
```

`context_key` should be a stable host-side identifier for one conversation, thread, or chat room. This prevents a Telegram confirmation turn from resuming a Feishu dataset by mistake.

### Step 2: inspect the decision

If the result contains:

- `shouldHandle = true`
- `routeTarget = "clawomics_agent_turn"`

then call:

- MCP tool: `clawomics_agent_turn`

Otherwise, let the normal OpenClaw assistant handle the turn.

## Strong Routing Signals

ClawOmics should usually be selected when the message contains at least one of:

- an existing server path such as `/data/project1`
- bioinformatics file types such as `fastq`, `bam`, `vcf`, `h5ad`
- assay terms such as `RNA-seq`, `WGS`, `单细胞`, `测序`, `变异分析`
- analysis requests such as `帮我分析`, `QC`, `差异表达`, `workflow`, `pipeline`
- explicit confirmation with an active ClawOmics session, such as `确认执行`

## Feishu / Telegram Conversation Pattern

### Planning turn

User:

```text
/data/project1 里有数据，帮我分析
```

Host:
1. `clawomics_should_route_message`
2. if true, `clawomics_agent_turn`
3. send `assistantReply` back to the user

### Confirmation turn

User:

```text
确认执行
```

Host:
1. `clawomics_should_route_message`
2. if true, `clawomics_agent_turn`
3. send `assistantReply` and run paths back to the user

## Context Isolation

When the host supports multiple concurrent chats, always pass the same `context_key` to:

- `clawomics_should_route_message`
- `clawomics_agent_turn`
- `clawomics_get_latest_context`
- `clawomics_get_session` when `session_path` is omitted

If the operator wants to drop the remembered bridge for one chat, call:

- `clawomics_clear_context`

This only clears the lightweight bridge state. It does not delete the underlying `agent_session.json` or any run artifacts.

## Why this split matters

This avoids two bad behaviors:

- routing every path-like message into bioinformatics
- forcing users to say special trigger words every time

The routing tool gives OpenClaw a narrow, explicit decision before execution.
