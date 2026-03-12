#!/usr/bin/env node
/**
 * ClawOmics CLI
 * Main entry point for the ClawOmics bioinformatics platform
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMMANDS = {
    'setup': () => {
        console.log('🦞 Running ClawOmics setup...');
        execSync(`bash ${path.join(__dirname, 'setup.sh')}`, { stdio: 'inherit' });
    },
    'identify': (targetPath = '.') => {
        const orchestrator = path.join(__dirname, '..', 'skills', 'bio-expert', 'scripts', 'orchestrator.mjs');
        execSync(`node ${orchestrator} identify ${targetPath}`, { stdio: 'inherit' });
    },
    'demo': () => {
        console.log('🧬 Generating demo data...');
        const generator = path.join(__dirname, 'generate_demo_data.mjs');
        execSync(`node ${generator}`, { stdio: 'inherit' });
    },
    'inventory': () => {
        console.log('📂 Updating skill inventory...');
        execSync(`node ${path.join(__dirname, 'inventory_skills.mjs')}`, { stdio: 'inherit' });
    },
    'help': () => {
        console.log(`
🦞 ClawOmics CLI - Professional Bioinformatics Orchestration

Usage:
  clawomics <command> [options]

Commands:
  setup               Initialize ClawOmics environment
  identify [path]     Identify bioinformatics data formats
  demo                Generate demo data for testing
  inventory           Update skill inventory
  help                Show this help message

Examples:
  clawomics setup
  clawomics identify ./data
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