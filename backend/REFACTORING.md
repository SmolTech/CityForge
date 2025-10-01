# Backend Refactoring

This refactoring breaks the monolithic 1932-line `app.py` into a modular structure.

## New Structure

```
backend/
├── app/
│   ├── __init__.py          # App factory and configuration
│   ├── models/              # Database models
│   │   ├── __init__.py
│   │   ├── user.py          # User model
│   │   ├── card.py          # Card, Tag, CardSubmission, CardModification
│   │   └── resource.py      # ResourceCategory, QuickAccessItem, ResourceItem, ResourceConfig
│   ├── routes/              # API route blueprints
│   │   ├── __init__.py
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── cards.py         # Card/business endpoints
│   │   ├── resources.py     # Resource management endpoints
│   │   ├── admin.py         # Admin endpoints
│   │   ├── search.py        # Search functionality
│   │   └── upload.py        # File upload endpoints
│   └── utils/               # Utility functions
│       ├── __init__.py
│       └── helpers.py       # Helper functions (slug generation, admin checks, etc.)
└── app.py                   # Application entry point

## Benefits

1. **Modularity**: Code is organized by functionality
2. **Maintainability**: Easier to locate and modify specific features
3. **Testability**: Individual modules can be tested in isolation
4. **Scalability**: New features can be added as new modules
5. **Readability**: Smaller files are easier to understand

## Running the Refactored Backend

The entry point remains the same:

```bash
python app.py
```

Or with gunicorn:

```bash
gunicorn app:app
```

## Module Descriptions

### Models
- **user.py**: User authentication and profile management
- **card.py**: Business cards, tags, submissions, and modifications
- **resource.py**: Resources configuration and management

### Routes
- **auth.py**: `/api/auth/*` - Registration, login, logout, profile updates
- **cards.py**: `/api/cards/*`, `/api/business/*` - Public card endpoints
- **resources.py**: `/api/resources/*`, `/api/site-config` - Public resource endpoints
- **admin.py**: `/api/admin/*` - All admin-only endpoints
- **search.py**: `/api/search` - OpenSearch integration
- **upload.py**: `/api/upload`, `/api/uploads/*` - File uploads

### Utils
- **helpers.py**: Shared utility functions (slug generation, file validation, admin checks)
