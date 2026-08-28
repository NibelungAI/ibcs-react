#!/usr/bin/env bash
# bash wrapper — the setup itself is cross-platform Node: scripts/setup.mjs
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup.mjs" "$@"
