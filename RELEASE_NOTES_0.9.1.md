# Release 0.9.1

## Summary

This release includes infrastructure improvements, bug fixes, and enhancements to the deployment system.

## Features

- **Kubernetes Security**: Add security contexts to Ansible Kubernetes jobs for improved pod security

## Improvements

- **Infrastructure**: Centralize Kubernetes configuration and add Ansible automation
- **Configuration Management**: Update Kubernetes configuration for unified secrets and OpenSearch
- **Metadata Generation**: Use direct database query for metadata generation instead of API fetch

## Bug Fixes

- Fix metadata generation to use database config instead of static fallback
- Fix site config API to force dynamic rendering
- Enhance date handling in conversion script for timezone-less dates
- Handle dates without timezone in conversion script

## DevOps

- Trigger rebuild for Docker image

---

**Full Changelog**: https://github.com/SmolTech/cityforge/compare/v0.9.0...v0.9.1
