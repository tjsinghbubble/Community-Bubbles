#!/usr/bin/env node
// Prints the /etc/hosts entries needed for local development with named hosts,
// and optionally writes them (requires sudo).
//
// Named hosts used across this project:
//   api_host    → Express API server  (port 3000)
//   db_host     → PostgreSQL          (port 5432)
//   metro_host  → Expo Metro bundler  (port 8081)
//
// Usage:
//   node script/setup-hosts.mjs           # print entries only
//   sudo node script/setup-hosts.mjs --write  # append entries to /etc/hosts
//
// For physical iOS devices:
//   The phone cannot use /etc/hosts. Instead, use the Mac's Bonjour address
//   (TLW-2024.local) which iOS resolves automatically on the same WiFi.
//   Run: node script/setup-hosts.mjs --mobile  to update mobile/.env to use it.

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { networkInterfaces } from "os";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getLanIP() {
  const nets = networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return null;
}

function getBonjourHost() {
  try {
    const name = execSync("scutil --get LocalHostName", { stdio: ["pipe", "pipe", "ignore"] })
      .toString().trim();
    return `${name}.local`;
  } catch {
    return null;
  }
}

const lanIP = getLanIP();
const bonjourHost = getBonjourHost();
const args = process.argv.slice(2);

// --- Mode: update mobile/.env to use Bonjour host (for physical device testing)
if (args.includes("--mobile")) {
  if (!bonjourHost) {
    console.error("Could not detect Bonjour hostname.");
    process.exit(1);
  }
  const envPath = resolve(__dirname, "../mobile/.env");
  const envText = readFileSync(envPath, "utf8");
  const updated = envText.replace(
    /^EXPO_PUBLIC_API_URL=.+$/m,
    `EXPO_PUBLIC_API_URL=http://${bonjourHost}:3000`
  );
  writeFileSync(envPath, updated);
  console.log(`mobile/.env → EXPO_PUBLIC_API_URL=http://${bonjourHost}:3000`);
  console.log("Rebuild the app for the change to take effect: npm run mobile:build:ios-sim");
  process.exit(0);
}

// --- Build /etc/hosts entries
const entries = [
  `# Bubble dev — named hosts`,
  `127.0.0.1  db_host`,
  `127.0.0.1  api_host metro_host`,
].join("\n");

console.log("\n=== Add to /etc/hosts (for simulator + Mac-side tools) ===");
console.log(entries);

if (lanIP) {
  console.log(`\n# If testing with a physical device on the same WiFi,`);
  console.log(`# replace 127.0.0.1 with your LAN IP:`);
  console.log(`${lanIP}  api_host metro_host`);
}

if (bonjourHost) {
  console.log(`\n=== Physical iOS device (no /etc/hosts needed) ===`);
  console.log(`Your Mac's Bonjour address: ${bonjourHost}`);
  console.log(`iOS resolves .local names automatically via Bonjour on the same WiFi.`);
  console.log(`To use it: node script/setup-hosts.mjs --mobile`);
}

// --- Mode: write to /etc/hosts
if (args.includes("--write")) {
  const hostsPath = "/etc/hosts";
  const current = readFileSync(hostsPath, "utf8");
  if (current.includes("api_host")) {
    console.log("\n/etc/hosts already contains api_host entries — not modified.");
  } else {
    writeFileSync(hostsPath, current + "\n" + entries + "\n");
    console.log("\n✓ Written to /etc/hosts");
  }
}
