#!/bin/bash
# Lint Python code with ruff

set -e

echo "Linting Python code with ruff..."

# Activate virtual environment if it exists (check parent directory first)
if [ -f "../.venv/bin/activate" ]; then
  source ../.venv/bin/activate
elif [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
fi

# Run ruff linter
python -m ruff check .

echo "✓ Python linting passed"
