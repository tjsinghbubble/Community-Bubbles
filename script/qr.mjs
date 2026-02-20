#!/usr/bin/env node
// Displays the Expo Go QR code for the mobile dev server.
// Reads the IP from mobile/.env, then exits after 30 seconds.
// Usage: node script/qr.mjs        (foreground, auto-exits)
//        node script/qr.mjs &      (background)

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Parse mobile/.env to get EXPO_PUBLIC_API_URL
const envPath = resolve(__dirname, "../mobile/.env");
let apiUrl = "http://localhost:3000";
try {
  const envText = readFileSync(envPath, "utf8");
  const match = envText.match(/^EXPO_PUBLIC_API_URL=(.+)$/m);
  if (match) apiUrl = match[1].trim();
} catch {
  console.warn("Could not read mobile/.env — defaulting to", apiUrl);
}

// Convert http://192.168.x.x:PORT -> exp://192.168.x.x:8081
const url = new URL(apiUrl);
const expoUrl = `exp://${url.hostname}:8081`;

// Load qrcode (installed at project root)
const QRCode = require(resolve(__dirname, "../node_modules/qrcode"));

console.log(`\nScan with Expo Go → ${expoUrl}\n`);
QRCode.toString(expoUrl, { type: "terminal", small: true }, (err, str) => {
  if (err) {
    console.error("QR generation failed:", err.message);
    process.exit(1);
  }
  console.log(str);
  console.log("(auto-exits in 30 seconds)\n");
});

setTimeout(() => process.exit(0), 30_000);
