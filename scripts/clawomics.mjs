#!/usr/bin/env node
/**
 * ClawOmics CLI
 * Main entry point for the ClawOmics bioinformatics platform
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const orchestrator = path.join(__dirname, '..', 'skills', 'bio-expert', 'scripts', 'orchestrator.mjs');
const mcpServer = path.join(__dirname, '..', 'mcp', 'clawomics-mcp-server.mjs');
const mcpDoctor = path.join(__dirname, 'mcp_doctor.mjs');
const mcpConfig = path.join(__dirname, 'print_mcp_config.mjs');

function runNodeScript(scriptPath, args = []) {
    execFileSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });
}

function runBashScript(scriptPath) {
    execFileSync('bash', [scriptPath], { stdio: 'inherit' });
}

const COMMANDS = {
    'start': () => {
        runNodeScript(mcpDoctor);
        console.log('');
        console.log('ClawOmics chat bridge is ready. Keep this process running and talk to your MCP-enabled client.');
        runNodeScript(mcpServer);
    },
    'setup': () => {
        console.log('🦞 Running ClawOmics setup...');
        runBashScript(path.join(__dirname, 'setup.sh'));
    },
    'identify': (targetPath = '.', ...extraArgs) => {
        runNodeScript(orchestrator, ['identify', targetPath, ...extraArgs]);
    },
    'agent': (...messageArgs) => {
        if (messageArgs.length === 0) {
            COMMANDS.help();
            process.exit(1);
        }
        runNodeScript(orchestrator, ['agent', ...messageArgs]);
    },
    'route': (...messageArgs) => {
        if (messageArgs.length === 0) {
            COMMANDS.help();
            process.exit(1);
        }
        runNodeScript(orchestrator, ['route', ...messageArgs]);
    },
    'clear-context': (...extraArgs) => {
        runNodeScript(orchestrator, ['clear-context', ...extraArgs]);
    },
    'mcp': (...extraArgs) => {
        runNodeScript(mcpServer, extraArgs);
    },
    'mcp-doctor': () => {
        runNodeScript(mcpDoctor);
    },
    'mcp-config': () => {
        runNodeScript(mcpConfig);
    },
    'analyze': (targetPath = '.', ...extraArgs) => {
        runNodeScript(orchestrator, ['analyze', targetPath, ...extraArgs]);
    },
    'profile': (targetPath = '.', ...extraArgs) => {
        runNodeScript(orchestrator, ['profile', targetPath, ...extraArgs]);
    },
    'plan': (targetPath = '.', ...extraArgs) => {
        runNodeScript(orchestrator, ['plan', targetPath, ...extraArgs]);
    },
    'partition': (targetPath = '.', ...extraArgs) => {
        runNodeScript(orchestrator, ['partition', targetPath, ...extraArgs]);
    },
    'run': (targetPath = '.', ...extraArgs) => {
        runNodeScript(orchestrator, ['run', targetPath, ...extraArgs]);
    },
    'session': (sessionPath, ...extraArgs) => {
        if (!sessionPath) {
            COMMANDS.help();
            process.exit(1);
        }
        runNodeScript(orchestrator, ['session', sessionPath, ...extraArgs]);
    },
    'demo': () => {
        console.log('🧬 Generating demo data...');
        const generator = path.join(__dirname, 'generate_demo_data.mjs');
        runNodeScript(generator);
    },
    'inventory': () => {
        console.log('📂 Updating skill inventory...');
        runNodeScript(path.join(__dirname, 'inventory_skills.mjs'));
    },
    'help': () => {
        console.log(`
🦞 ClawOmics CLI - Professional Bioinformatics Orchestration

Usage:
  clawomics <command> [options]

Commands:
  Primary:
    start               Check MCP readiness and start the MCP bridge locally
    setup               Initialize ClawOmics environment
    mcp-doctor          Check whether MCP dependencies and files are ready
    mcp-config          Print a ready-to-copy OpenClaw MCP config snippet

  Advanced / Debug:
    identify [path]     Legacy format summary
    agent "<message>"   Natural-language agent entrypoint
    route "<message>"   Test whether a chat message should auto-route to ClawOmics
    clear-context       Clear remembered bridge state for one chat context
    mcp                 Start the ClawOmics MCP server
    analyze [path]      Profile, partition, and plan in one step
    profile [path]      Build a structured dataset profile
    plan [path]         Generate an automatic analysis plan
    partition [path]    Split mixed datasets into analysis units
    run [path]          Execute the confirmation-gated run bootstrap
    session <file>      Inspect a persisted agent session
    demo                Generate demo data for testing
    inventory           Update skill inventory
    help                Show this help message

Examples:
  clawomics start
  clawomics setup
  clawomics agent "帮我分析 ./data"
  clawomics route "/data/project1 里有测序数据，帮我分析"
  clawomics route "/data/project1 里有测序数据，帮我分析" --context-key feishu-chat-123
  clawomics agent "帮我分析 ./data" --compact
  clawomics agent "确认执行"
  clawomics clear-context --context-key telegram-user-42
  clawomics mcp-doctor
  clawomics mcp-config
  clawomics mcp
  clawomics analyze ./data --write
  clawomics profile ./data --write
  clawomics plan ./data --goal "Prepare a first-pass QC workflow" --write
  clawomics partition ./data --output ./dataset_partitions.json
  clawomics run ./data --session ./agent_session.json
  clawomics run ./data --approve
  clawomics session ./agent_session.json
  clawomics demo

For detailed documentation: https://github.com/yf8578/clawomics

Notes:
  start is the simplest local test entrypoint. In a normal MCP host, the host should
  auto-spawn the server instead of requiring a manual long-running shell.
  agent remembers the latest conversation session automatically, so a later
  "确认执行" turn does not need an explicit --session argument.
  Use --context-key when multiple chat channels or threads share the same host.
        `);
    }
};

const command = process.argv[2] || 'help';
const args = process.argv.slice(3);

if (COMMANDS[command]) {
    COMMANDS[command](...args);
} else {
    console.error(`❌ Unknown command: ${command}`);
    COMMANDS['help']();
    process.exit(1);
}
