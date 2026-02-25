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

node packages/bridge-cli/dist/test-dispatch.js "$1" "$2"
