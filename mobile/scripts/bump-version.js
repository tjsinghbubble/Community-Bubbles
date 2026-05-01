#!/usr/bin/env node
/**
 * Bumps the semver patch version in both app.json and package.json.
 * Run this before each production EAS build so that the version stays in
 * sync across both files and the Sentry release slug (read from app.json
 * in app.config.js) always reflects a unique build.
 *
 * Usage:  node scripts/bump-version.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function bumpPatch(version) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Cannot parse semver version: "${version}"`);
  }
  parts[2] += 1;
  return parts.join('.');
}

function updateJson(filePath, updater) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  updater(data);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  return data;
}

const appJsonPath = path.join(ROOT, 'app.json');
const pkgJsonPath = path.join(ROOT, 'package.json');

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const currentVersion = appJson.expo.version;
const nextVersion = bumpPatch(currentVersion);

updateJson(appJsonPath, (data) => {
  data.expo.version = nextVersion;
});

updateJson(pkgJsonPath, (data) => {
  data.version = nextVersion;
});

console.log(`Version bumped: ${currentVersion} → ${nextVersion}`);
