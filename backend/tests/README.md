# CityForge Backend Test Suite

Comprehensive unit and integration tests for the CityForge backend API.

## Test Structure

```
tests/
├── conftest.py              # Shared fixtures and test configuration
├── unit/                    # Unit tests
│   ├── test_models.py       # Model tests (User, Card, Resource)
│   ├── test_auth_routes.py  # Authentication endpoint tests
│   ├── test_card_routes.py  # Card/business endpoint tests
│   ├── test_resource_routes.py  # Resource endpoint tests
│   ├── test_admin_routes.py # Admin endpoint tests
│   └── test_utils.py        # Utility function tests
├── integration/             # Integration tests (future)
└── fixtures/                # Test data fixtures (future)
```

## Running Tests

### Quick Start

```bash
# Install test dependencies
pip install -r requirements-test.txt

# Run all tests
./run_tests.sh

# Or use pytest directly
pytest
```

### Run Specific Tests

```bash
# Run only unit tests
pytest -m unit

# Run specific test file
pytest tests/unit/test_models.py

# Run specific test class
pytest tests/unit/test_models.py::TestUserModel

# Run specific test
pytest tests/unit/test_models.py::TestUserModel::test_user_creation

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov=app --cov-report=html
```

### Test Markers

Tests are organized with markers:

- `@pytest.mark.unit` - Unit tests
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.slow` - Slow running tests

## Test Coverage

Current test coverage includes:

### Models (test_models.py)

- ✅ User creation and validation
- ✅ Password hashing and verification
- ✅ Password strength validation
- ✅ User serialization
- ✅ Card creation and relationships
- ✅ Slug generation
- ✅ Share URL generation
- ✅ Tag management
- ✅ Resource configuration
- ✅ Quick access items
- ✅ Resource items

### Authentication Routes (test_auth_routes.py)

- ✅ User registration
- ✅ Login/logout
- ✅ Token validation
- ✅ Email updates
- ✅ Password updates
- ✅ Profile updates
- ✅ Current user retrieval

### Card Routes (test_card_routes.py)

- ✅ Card listing and filtering
- ✅ Search functionality
- ✅ Tag filtering
- ✅ Featured cards
- ✅ Single card retrieval
- ✅ Business endpoints with slugs
- ✅ Card submissions
- ✅ Edit suggestions

### Resource Routes (test_resource_routes.py)

- ✅ Resource configuration
- ✅ Quick access items
- ✅ Resource items
- ✅ Category filtering
- ✅ Site configuration
- ✅ Complete resource data

### Admin Routes (test_admin_routes.py)

- ✅ Card management (CRUD)
- ✅ Submission approval/rejection
- ✅ User management
- ✅ Tag management
- ✅ Resource configuration management
- ✅ Quick access management
- ✅ Resource item management
- ✅ Authorization checks

### Utilities (test_utils.py)

- ✅ Slug generation
- ✅ File validation
- ✅ Admin authorization

## Fixtures

Key fixtures available in `conftest.py`:

- `app` - Flask application instance
- `client` - Test client for API requests
- `db_session` - Database session for tests
- `admin_user` - Admin user account
- `regular_user` - Regular user account
- `admin_token` - JWT token for admin
- `user_token` - JWT token for user
- `sample_card` - Sample business card
- `sample_tag` - Sample tag
- `sample_resource_config` - Sample resource config
- `sample_quick_access` - Sample quick access item
- `sample_resource_item` - Sample resource item

## Writing New Tests

### Example Test

```python
import pytest

@pytest.mark.unit
def test_new_feature(client, admin_token):
    """Test new feature description"""
    response = client.get('/api/new-endpoint',
                         headers={'Authorization': f'Bearer {admin_token}'})

    assert response.status_code == 200
    assert 'expected_key' in response.json
```

### Best Practices

1. **Use markers** - Tag tests with `@pytest.mark.unit` or `@pytest.mark.integration`
2. **Descriptive names** - Test names should describe what they test
3. **One assertion per concept** - Keep tests focused
4. **Use fixtures** - Leverage shared fixtures for common setup
5. **Test edge cases** - Don't just test happy paths
6. **Clean up** - Database session fixture handles cleanup automatically

## Continuous Integration

Tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: |
    pip install -r requirements-test.txt
    pytest --cov=app --cov-report=xml

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

**Import errors**

```bash
# Make sure you're in the backend directory
cd backend
# Install in development mode
pip install -e .
```

**Database errors**

```bash
# Tests use in-memory SQLite, no setup needed
# If issues persist, check conftest.py database configuration
```

**Fixture not found**

```bash
# Ensure conftest.py is in tests/ directory
# Check fixture scope (function vs session)
```

## Test Statistics

Run `pytest --collect-only` to see test count:

```bash
pytest --collect-only
```

Generate coverage report:

```bash
pytest --cov=app --cov-report=term-missing
```

## Future Enhancements

- [ ] Integration tests with real PostgreSQL
- [ ] Performance tests
- [ ] Load testing
- [ ] API contract tests
- [ ] Frontend integration tests
- [ ] E2E tests with Playwright
