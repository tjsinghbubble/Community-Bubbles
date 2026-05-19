#!/usr/bin/env bash
# extract_testids.sh — regenerate docs/maestro_testids.{tsv,md} from mobile/src TSX files.
#
# Usage:
#   ./scripts/extract_testids.sh [--json] [--out-dir <dir>]
#
# All flags are forwarded to extract_testids.py.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

python3 "$SCRIPT_DIR/extract_testids.py" --project-root "$PROJECT_ROOT" "$@"
