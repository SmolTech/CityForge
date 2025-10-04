#!/bin/bash
# Test runner script for CityForge backend

set -e

echo "CityForge Backend Test Suite"
echo "=============================="
echo ""

# Activate virtual environment if it exists
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
fi

# Check if pytest is installed
if ! python -c "import pytest" 2>/dev/null; then
    echo "Installing test dependencies..."
    pip install -r requirements-test.txt
fi

# Run tests with coverage
echo "Running tests with coverage..."
pytest tests/ \
    --cov=app \
    --cov-report=term-missing \
    --cov-report=html \
    --verbose \
    "$@"

echo ""
echo "Coverage report generated in htmlcov/index.html"
