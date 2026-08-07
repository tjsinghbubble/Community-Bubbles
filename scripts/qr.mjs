#!/usr/bin/env node
// Displays the Expo Go QR code for the mobile dev server.
// Uses the Mac's mDNS Bonjour hostname (e.g. TLW-2024.local) so physical
// iOS devices can resolve it automatically on the same WiFi — no /etc/hosts
// needed on the phone.
// Usage: node scripts/qr.mjs        (foreground, auto-exits in 30s)
//        node scripts/qr.mjs &      (background)

import { execSync } from "child_process";
import { tmpdir } from "os";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Use the Mac's Bonjour mDNS hostname (e.g. TLW-2024.local).
// iOS devices resolve .local names automatically via Bonjour on the same WiFi.
function getBonjourHost() {
  try {
    const name = execSync("scutil --get LocalHostName", { stdio: ["pipe", "pipe", "ignore"] })
      .toString().trim();
    return `${name}.local`;
  } catch {
    return null;
  }
}

const metroHost = getBonjourHost() || "metro_host";
const expoUrl = `exp://${metroHost}:8081`;

// Load qrcode (installed at project root)
const QRCode = require(resolve(__dirname, "../node_modules/qrcode"));

console.log(`\nScan with Expo Go → ${expoUrl}\n`);

// Generate a PNG — terminal block-character QR codes break in most fonts
// due to line-height gaps. Open in Preview to scan.
const qrFile = join(tmpdir(), "expo-qr.png");
QRCode.toFile(qrFile, expoUrl, { margin: 4, scale: 10 }, (err) => {
  if (err) {
    console.error("QR generation failed:", err.message);
    process.exit(1);
  }
  console.log(`QR code saved → ${qrFile}`);
  try {
    execSync(`open "${qrFile}"`);
    console.log("Opened in Preview — scan with Expo Go app.\n");
  } catch {
    console.log(`Could not auto-open. Open manually: open "${qrFile}"\n`);
  }
  console.log("(auto-exits in 30 seconds)\n");
});

setTimeout(() => process.exit(0), 30_000);
