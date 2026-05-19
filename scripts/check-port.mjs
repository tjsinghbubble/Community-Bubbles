#!/usr/bin/env node
// Checks whether the API server port is available before startup.
// Exits 0 if free, exits 1 with a clear diagnosis if occupied.
// Usage: node scripts/check-port.mjs

import { createServer } from 'net';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseDotEnv(filePath) {
  try {
    const vars = {};
    for (const line of readFileSync(filePath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) vars[m[1]] = m[2].trim();
    }
    return vars;
  } catch {
    return {};
  }
}

const dotEnv = parseDotEnv(resolve(__dirname, '../.env'));
const port = parseInt(
  process.env.API_WEB_SERVER_PORT ?? dotEnv.API_WEB_SERVER_PORT ?? '5000',
  10,
);

function getPortOwner(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN 2>/dev/null`, {
      encoding: 'utf8',
    });
    const line = out.trim().split('\n')[1]; // skip header row
    if (!line) return null;
    const parts = line.split(/\s+/);
    return { command: parts[0], pid: parts[1] };
  } catch {
    return null;
  }
}

function checkPort(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen({ port, host: '127.0.0.1' }, () => {
      srv.close(() => resolve(null)); // port is free
    });
    srv.on('error', () => resolve(getPortOwner(port)));
  });
}

const owner = await checkPort(port);

if (owner) {
  console.error(`
❌  API server cannot start — port ${port} is already in use
    Owner: ${owner.command} (PID ${owner.pid})

    Environment variables that control this port:
      API_WEB_SERVER_PORT  (currently resolves to: ${port})

    Files to check:
      .env                 (project root)
      ~/.bubble_secrets    (if sourced in your shell profile)

    To kill the blocking process:
      kill ${owner.pid}
`);
  process.exit(1);
}

console.log(`✅  Port ${port} is available`);
