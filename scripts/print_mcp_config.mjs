#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const serverPath = path.join(projectRoot, 'mcp', 'clawomics-mcp-server.mjs');
const npmLinkDir = path.join(projectRoot, 'node_modules', '.bin');
const linkedMcpBin = path.join(npmLinkDir, 'clawomics-mcp-server');
const mcpBinName = 'clawomics-mcp-server';

function isCommandAvailable(command) {
    try {
        execFileSync('which', [command], {
            stdio: ['ignore', 'ignore', 'ignore'],
        });
        return true;
    } catch {
        return false;
    }
}

const config = (existsSync(linkedMcpBin) || isCommandAvailable(mcpBinName))
    ? {
        clawomics: {
            command: mcpBinName,
        },
    }
    : {
        clawomics: {
            command: 'node',
            args: [serverPath],
        },
    };

console.log(JSON.stringify(config, null, 2));
