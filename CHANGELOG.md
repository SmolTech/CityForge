# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.4] - 2025-01-21

### Added

- Already logged in indicator on login page with user info and quick navigation
- Password reset functionality with email verification
- Mailgun email service integration
- User deletion with orphan record reassignment to "Deleted User"
- User ID sequence fix script
- Automatic database schema synchronization on container startup

### Fixed

- Login redirect loop after successful authentication
- AuthContext race condition causing users to be redirected back to login
- Null safety issues in card_tags transformation
- User ID sequence fix script table name
- Login component tests after AuthContext changes

### Changed

- Migrated from Cloudflare to Mailgun for email delivery
- Enhanced pre-push hook with comprehensive checks
- Updated Kubernetes configuration for Mailgun secrets

## [0.9.3] - 2025-01-15

### Added

- Cloudflare email service integration

- Email verification functionality
- Enhanced error handling and validation

### Fixed

- Password validation mismatch between frontend and backend
- Metadata generation to use database config

### Changed

- Use direct database query for metadata generation

## [0.9.2] - 2025-01-14

### Changed

- Various bug fixes and improvements

## [0.9.1] - 2025-01-13

### Changed

- Initial versioned release
- Foundation for changelog tracking

## [Unreleased]

### Planned

- Additional authentication improvements
- Enhanced admin dashboard features
- Performance optimizations

---

**Note:** This changelog started with version 0.9.1. For changes prior to this version, please refer to the git commit history.
