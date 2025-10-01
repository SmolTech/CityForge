# Backend Refactoring Status

## Completed

### ✅ Package Structure
- Created `app/` package with proper `__init__.py`
- Created `app/models/` for database models
- Created `app/routes/` for API endpoints
- Created `app/utils/` for helper functions

### ✅ Models Extracted
- **app/models/user.py** - User authentication and profile
- **app/models/card.py** - Card, Tag, CardSubmission, CardModification
- **app/models/resource.py** - ResourceCategory, QuickAccessItem, ResourceItem, ResourceConfig

### ✅ Utilities Extracted
- **app/utils/helpers.py** - slug generation, file validation, admin checks

### ✅ Routes Started
- **app/routes/auth.py** - Authentication endpoints (complete)

## Remaining Work

### Routes to Extract (from original app.py lines 574-1925)

1. **app/routes/upload.py** - File upload endpoints (lines 574-599)
   - POST `/api/upload`
   - GET `/api/uploads/<filename>`

2. **app/routes/cards.py** - Public card/business endpoints (lines 600-676)
   - GET `/api/cards`
   - GET `/api/cards/<int:card_id>`
   - GET `/api/business/<int:business_id>`
   - GET `/api/tags`
   - POST `/api/submissions`
   - GET `/api/submissions`
   - POST `/api/cards/<int:card_id>/suggest-edit`

3. **app/routes/resources.py** - Public resource endpoints (lines 1346-1490)
   - GET `/api/resources/config`
   - GET `/api/resources/quick-access`
   - GET `/api/resources/items`
   - GET `/api/resources/categories`
   - GET `/api/site-config`
   - GET `/api/resources`

4. **app/routes/admin.py** - Admin endpoints (lines 714-1809)
   - All `/api/admin/cards/*` endpoints
   - All `/api/admin/submissions/*` endpoints
   - All `/api/admin/modifications/*` endpoints
   - All `/api/admin/users/*` endpoints
   - All `/api/admin/tags/*` endpoints
   - All `/api/admin/resources/*` endpoints

5. **app/routes/search.py** - Search functionality (lines 1811-1925)
   - GET `/api/search`

### New app.py Entry Point

Create a minimal `app.py` that uses the app factory:

```python
import os
from app import create_app, db

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    host = '0.0.0.0' if os.getenv('FLASK_ENV') == 'production' else '127.0.0.1'
    app.run(host=host, port=5000, debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true')
```

## Migration Strategy

### Option 1: Gradual Migration (Recommended)
1. Keep original `app.py` as `app_old.py`
2. Create route files one at a time
3. Test each route file independently
4. Switch over when all routes are migrated

### Option 2: Complete Refactor
Extract all remaining routes at once (requires extensive testing)

## Benefits Already Achieved

1. **Organized Models**: All database models in logical modules
2. **Reusable Utilities**: Helper functions extracted for reuse
3. **App Factory Pattern**: Supports multiple app instances and testing
4. **Authentication Module**: Complete and tested auth routes

## Next Steps

1. Generate remaining route files (cards, resources, admin, search, upload)
2. Update `app/__init__.py` to register all blueprints
3. Create new minimal `app.py` entry point
4. Rename original `app.py` to `app_old.py` as backup
5. Test all endpoints
6. Update Dockerfile if needed (shouldn't change)

## File Count Comparison

**Before**: 1 file (1932 lines)
**After**: 13+ files (~150-200 lines each)

## Testing

Each blueprint can be tested independently:

```python
from app import create_app

def test_auth():
    app = create_app()
    client = app.test_client()
    response = client.post('/api/auth/login', json={...})
    assert response.status_code == 200
```
