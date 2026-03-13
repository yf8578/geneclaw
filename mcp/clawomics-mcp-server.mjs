#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
    classifyAgentRouting,
    formatAgentEnvelope,
    getAgentSession,
    getBridgeState,
    handleAgentMessage,
} from '../skills/bio-expert/scripts/orchestrator.mjs';

const server = new McpServer({
    name: 'clawomics-mcp-server',
    version: '1.2.0',
});

function makeTextResult(payload) {
    const reply = payload.assistantReply
        || payload.response?.conversation?.assistantMessage
        || 'ClawOmics handled the request.';

    return {
        content: [{ type: 'text', text: reply }],
        structuredContent: payload,
    };
}

server.registerTool(
    'clawomics_should_route_message',
    {
        title: 'ClawOmics Route Decision',
        description: `Decide whether an incoming chat message should be handed to ClawOmics.

Use this before calling clawomics_agent_turn when the host needs automatic routing for Feishu, Telegram, or other mixed-purpose chat channels.`,
        inputSchema: {
            message: z.string().min(1).describe('The raw user message from the chat channel.'),
            cwd: z.string().optional().describe('Optional working directory used to resolve relative paths.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    async ({ message, cwd }) => {
        const payload = classifyAgentRouting(message, { cwd });
        return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            structuredContent: payload,
        };
    },
);

server.registerTool(
    'clawomics_agent_turn',
    {
        title: 'ClawOmics Agent Turn',
        description: `Handle one OpenClaw conversation turn for bioinformatics analysis.

Use this for both:
- dataset intake and automatic planning
- explicit confirmation turns such as "确认执行"

The tool persists the latest session bridge automatically, so follow-up confirmation turns do not need a separate session parameter in normal use.`,
        inputSchema: {
            message: z.string().min(1).describe('The raw user message from the OpenClaw conversation.'),
            cwd: z.string().optional().describe('Optional working directory used to resolve relative paths.'),
            persist_artifacts: z.boolean().default(true).describe('Persist planning artifacts when the turn enters analyze mode.'),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
        },
    },
    async ({ message, cwd, persist_artifacts }) => {
        const envelope = handleAgentMessage(message, {
            cwd,
            write: persist_artifacts,
        });
        return makeTextResult(formatAgentEnvelope(envelope, {
            cwd,
            write: persist_artifacts,
        }));
    },
);

server.registerTool(
    'clawomics_get_latest_context',
    {
        title: 'ClawOmics Latest Context',
        description: 'Return the latest persisted conversation bridge so OpenClaw can inspect remembered dataset/session state.',
        inputSchema: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    async () => {
        const payload = getBridgeState() || {
            message: 'No persisted ClawOmics bridge state was found yet.',
        };
        return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            structuredContent: payload,
        };
    },
);

server.registerTool(
    'clawomics_get_session',
    {
        title: 'ClawOmics Session',
        description: 'Read a persisted ClawOmics session. If no path is provided, use the latest remembered session from the bridge state.',
        inputSchema: {
            session_path: z.string().optional().describe('Optional explicit path to agent_session.json.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    async ({ session_path }) => {
        const latest = getBridgeState();
        const effectivePath = session_path || latest?.sessionPath;
        const payload = effectivePath
            ? getAgentSession(effectivePath)
            : { message: 'No session path is available yet.' };

        return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            structuredContent: payload,
        };
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);
