#!/usr/bin/env node

import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageLockPath = path.join(projectRoot, 'package-lock.json');
const nodeModulesPath = path.join(projectRoot, 'node_modules');
const serverPath = path.join(projectRoot, 'mcp', 'clawomics-mcp-server.mjs');

const checks = [
    {
        name: 'package.json',
        ok: existsSync(packageJsonPath),
        hint: 'Missing package.json. The MCP server dependencies are not declared.',
    },
    {
        name: 'package-lock.json',
        ok: existsSync(packageLockPath),
        hint: 'package-lock.json is missing. Run npm install to lock MCP dependencies.',
    },
    {
        name: 'node_modules',
        ok: existsSync(nodeModulesPath),
        hint: 'Dependencies are not installed. Run npm install from the repository root.',
    },
    {
        name: 'mcp server',
        ok: existsSync(serverPath),
        hint: 'The MCP server entrypoint is missing.',
    },
];

const failed = checks.filter((check) => !check.ok);

console.log('ClawOmics MCP Doctor');
console.log('');
for (const check of checks) {
    console.log(`${check.ok ? 'OK ' : 'NO '} ${check.name}`);
    if (!check.ok) {
        console.log(`   ${check.hint}`);
    }
}

console.log('');
console.log('Recommended OpenClaw MCP command:');
console.log(`node ${serverPath}`);

if (failed.length > 0) {
    console.log('');
    console.log('Suggested fix:');
    console.log(`cd ${projectRoot}`);
    console.log('npm install');
    process.exit(1);
}

console.log('');
console.log('MCP setup looks ready.');
