#!/bin/bash
set -e

npm install --legacy-peer-deps --ignore-scripts
npx drizzle-kit push --force || echo "[post-merge] drizzle-kit push skipped (schema may already be up to date)"
