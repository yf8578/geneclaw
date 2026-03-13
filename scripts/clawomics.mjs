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

function runNodeScript(scriptPath, args = []) {
    execFileSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });
}

function runBashScript(scriptPath) {
    execFileSync('bash', [scriptPath], { stdio: 'inherit' });
}

const COMMANDS = {
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
  setup               Initialize ClawOmics environment
  identify [path]     Legacy format summary
  agent "<message>"   Natural-language agent entrypoint
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
  clawomics setup
  clawomics agent "帮我分析 ./data" --write
  clawomics agent "确认执行" --session ./data/agent_session.json
  clawomics analyze ./data --write
  clawomics profile ./data --write
  clawomics plan ./data --goal "Prepare a first-pass QC workflow" --write
  clawomics partition ./data --output ./dataset_partitions.json
  clawomics run ./data --session ./agent_session.json
  clawomics run ./data --approve
  clawomics session ./agent_session.json
  clawomics demo

For detailed documentation: https://github.com/yf8578/clawomics
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
