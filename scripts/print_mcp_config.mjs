#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const serverPath = path.join(projectRoot, 'mcp', 'clawomics-mcp-server.mjs');

const config = {
    clawomics: {
        command: 'node',
        args: [serverPath],
    },
};

console.log(JSON.stringify(config, null, 2));
