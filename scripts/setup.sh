#!/bin/bash

# ClawOmics One-Click Setup Script
# 🧬 Professional Bioinformatics Orchestration for OpenClaw

echo "🦞 Initializing ClawOmics Environment..."

# 1. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js 22+."
    exit 1
fi

# 2. Check for uv (Python package manager)
if ! command -v uv &> /dev/null; then
    echo "⚠️ Warning: 'uv' not found. Installing uv for fast Python dependency management..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.cargo/env
fi

# 3. Initialize Skill Inventory
echo "📂 Scanning 200+ specialized skills..."
node scripts/inventory_skills.mjs

# 4. Finalizing
echo "✅ ClawOmics Setup Complete!"
echo "------------------------------------------------"
echo "Next steps:"
echo "1. Ask OpenClaw: 'What can ClawOmics do for my data?'"
echo "2. Check docs/RESOURCES.md for the full toolkit."
echo "3. Happy Researching! 🧬"
