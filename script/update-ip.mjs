#!/usr/bin/env node
// Updates mobile/.env with the current LAN IP for physical device testing.
// The iOS Simulator can use localhost, but a physical phone needs the actual
// LAN IP to reach the dev server.
//
// Usage:
//   node script/update-ip.mjs          # writes LAN IP to mobile/.env
//   node script/update-ip.mjs reset    # restores localhost to mobile/.env

import { readFileSync, writeFileSync } from "fs";
import { networkInterfaces } from "os";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../mobile/.env");

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

const reset = process.argv[2] === "reset";
const host = reset ? "localhost" : getLanIP();

if (!host) {
  console.error("Could not detect LAN IP. Are you connected to a network?");
  process.exit(1);
}

const envText = readFileSync(envPath, "utf8");
const updated = envText.replace(
  /^EXPO_PUBLIC_API_URL=.+$/m,
  `EXPO_PUBLIC_API_URL=http://${host}:3000`
);
writeFileSync(envPath, updated);
console.log(`mobile/.env → EXPO_PUBLIC_API_URL=http://${host}:3000`);
if (!reset) {
  console.log("Rebuild the app (npm run mobile:build:ios-sim) for the change to take effect.");
}