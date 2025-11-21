# CityForge v0.9.4

**Release Date:** January 21, 2025

## Highlights

This release fixes a critical authentication bug causing login redirect loops and adds a better user experience when users visit the login page while already authenticated. It also includes email service migration from Cloudflare to Mailgun and several database improvements.

## What's New

### Added

- **Already logged in indicator** - Login page now shows user info and quick navigation options when visiting while authenticated
- **Password reset functionality** - Users can now reset their passwords via email verification
- **Mailgun email service integration** - New email delivery provider for improved reliability
- **User deletion with orphan handling** - Deleted users' content is reassigned to "Deleted User" to preserve data integrity
- **User ID sequence fix script** - Automatic correction of PostgreSQL sequence mismatches
- **Automatic database schema sync** - Container startup now ensures database schema is up-to-date

### Fixed

- **Login redirect loop** - Fixed race condition where users were redirected back to login after successful authentication
- **AuthContext race condition** - Resolved timing issue causing authentication state to be stale during page navigation
- **Null safety in card_tags** - Fixed transformation errors when card tags are undefined
- **User ID sequence table name** - Corrected table name in sequence fix script
- **Login component tests** - Updated tests to properly mock AuthContext after adding authentication checks

### Changed

- **Migrated from Cloudflare to Mailgun** - Improved email delivery reliability and features
- **Enhanced pre-push hook** - Added comprehensive checks including typecheck, lint, security scan, tests, and build
- **Updated Kubernetes configuration** - Added Mailgun secret management

## Upgrade Notes

No database migrations are required for this release. The automatic schema sync will handle any necessary updates on container startup.

## Contributors

Generated with Claude Code

---

**Full Changelog**: https://github.com/smoltech/CityForge/compare/v0.9.3...v0.9.4
