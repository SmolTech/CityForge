#!/bin/bash
# Format Python code with black and isort

set -e

echo "Formatting Python code..."

# Activate virtual environment if it exists (check root first, then local)
if [ -f "../.venv/bin/activate" ]; then
  source ../.venv/bin/activate
elif [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
fi

# Format with black
python -m black .

# Sort imports with isort
python -m isort .

echo "✓ Python code formatted successfully"
