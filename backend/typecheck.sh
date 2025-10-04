#!/bin/bash
# Type check Python code with mypy

set -e

echo "Type checking Python code with mypy..."

# Activate virtual environment if it exists
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
fi

# Run mypy type checker
python -m mypy .

echo "✓ Python type checking passed"
