#!/bin/bash

# Environment setup
export ANTIGRAVITY_PORT="${ANTIGRAVITY_PORT:-8888}"
export ANTIGRAVITY_HOST="${ANTIGRAVITY_HOST:-127.0.0.1}"

# Require token
if [ -z "$ANTIGRAVITY_TOKEN" ]; then
    echo "Error: ANTIGRAVITY_TOKEN environment variable is required."
    echo "Usage: ANTIGRAVITY_TOKEN=your_token ./test-dispatch.sh [prompt] [modelId]"
    exit 1
fi

# Check if the build artifact exists
DIST_FILE="packages/bridge-cli/dist/test-dispatch.js"
if [ ! -f "$DIST_FILE" ]; then
    echo "Error: Build artifact not found at $DIST_FILE"
    echo "Please run 'npm run build' first."
    exit 1
fi

node "$DIST_FILE" "$1" "$2"
