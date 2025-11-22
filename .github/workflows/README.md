# Android Build Setup

This directory contains GitHub Actions workflows for building the CityForge mobile app on Android.

## Available Workflows

### 1. `android-local-build.yml` - Local GitHub Actions Build

**Best for**: Development, testing, and quick builds

- ✅ Builds APK entirely on GitHub Actions infrastructure
- ✅ No external dependencies (EAS/Expo account)
- ✅ Fast builds (typically 5-15 minutes)
- ✅ Free on GitHub (uses included CI/CD minutes)
- ✅ Automatic artifact upload
- ✅ PR comments with build status

**Triggers**:

- Push to `main`/`develop` (when mobile files change)
- Pull requests (when mobile files change)
- Manual dispatch with build type selection

### 2. `android-release-build.yml` - Signed Release Build

**Best for**: Production releases

- ✅ Creates signed APKs for Google Play Store
- ✅ Automatic GitHub releases
- ✅ Keystore management via GitHub Secrets
- ✅ Version-tagged APK names

**Triggers**:

- Git tags matching `mobile-v*` (e.g., `mobile-v1.0.0`)
- Manual dispatch with release option

### 3. `mobile-build-strategy.yml` - Flexible Build Options

**Best for**: Choosing between local and cloud builds

- ✅ Switch between GitHub Actions and EAS builds
- ✅ Platform selection (Android/iOS/both)
- ✅ Profile selection (development/preview/production)
- ✅ Build comparison and strategy testing

## Quick Start

### Option 1: Local GitHub Actions Build (Recommended)

```bash
# 1. Push changes to trigger automatic build
git add .
git commit -m "Update mobile app"
git push origin main

# 2. Or trigger manual build
# Go to GitHub Actions → "Android Local Build" → "Run workflow"
```

### Option 2: Manual Workflow Dispatch

1. Go to GitHub Actions tab
2. Select "Mobile Build Strategy"
3. Click "Run workflow"
4. Choose:
   - Build method: `local-github-actions`
   - Platform: `android`
   - Profile: `preview`
5. Click "Run workflow"

## Setting Up Signed Releases

### 1. Generate Android Keystore

```bash
# Create a new keystore (one-time setup)
keytool -genkey -v -keystore cityforge-release-key.keystore \
  -alias cityforge-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Answer the prompts:
# - Store password: [choose a strong password]
# - Key password: [choose a strong password]
# - Name: CityForge
# - Organization: Your Organization
# - City, State, Country: Your details
```

### 2. Add GitHub Secrets

Go to GitHub Settings → Secrets and variables → Actions, add:

```bash
# Convert keystore to base64
base64 -i cityforge-release-key.keystore | tr -d '\n'
# Copy the output to ANDROID_KEYSTORE_BASE64 secret

# Add these secrets:
ANDROID_KEYSTORE_BASE64=<base64-encoded-keystore>
ANDROID_KEY_ALIAS=cityforge-key
ANDROID_KEY_PASSWORD=<your-key-password>
ANDROID_STORE_PASSWORD=<your-store-password>
PRODUCTION_API_URL=https://your-production-api.com
```

### 3. Create Release

```bash
# Tag and push for automatic release build
git tag mobile-v1.0.0
git push origin mobile-v1.0.0

# Or use manual dispatch with "Create GitHub release" enabled
```

## Build Outputs

### Debug Builds

- **File**: `app-debug.apk`
- **Install**: Enable "Unknown sources" and install directly
- **Use case**: Development and testing

### Release Builds

- **File**: `cityforge-v1.0.0-signed.apk` (if keystore configured)
- **File**: `cityforge-v1.0.0-unsigned.apk` (if no keystore)
- **Use case**: Production deployment

## Environment Configuration

Each build profile uses different API endpoints:

| Profile     | API URL                              | Use Case           |
| ----------- | ------------------------------------ | ------------------ |
| development | `http://10.0.2.2:5000`               | Local development  |
| preview     | `https://staging-api.yourdomain.com` | Testing/staging    |
| production  | `https://api.yourdomain.com`         | Production release |

## Troubleshooting

### Build Fails with "SDK not found"

- The workflow automatically installs Android SDK
- Check the "Setup Android SDK" step logs

### APK not created

- Check the Gradle build logs in "Build Android APK" step
- Verify `mobile/android/app/build.gradle` configuration

### Keystore errors in release builds

- Verify all four keystore secrets are set correctly
- Check that keystore file was generated properly
- Ensure passwords match what you used during keystore generation

### EAS builds fail

- Verify `EXPO_TOKEN` secret is set
- Check Expo dashboard for detailed error logs
- Ensure EAS project is properly configured

## Build Times Comparison

| Method               | Typical Time  | Cost                 | Complexity |
| -------------------- | ------------- | -------------------- | ---------- |
| Local GitHub Actions | 5-15 minutes  | Free (CI/CD minutes) | Low        |
| EAS Cloud            | 10-30 minutes | Free/Paid tier       | Medium     |
| Local machine        | 3-10 minutes  | Hardware cost        | High       |

## Next Steps

1. **Test the build**: Run a manual workflow to verify everything works
2. **Set up signed releases**: Add keystore secrets for production builds
3. **Automate releases**: Create tags to trigger automatic releases
4. **Add iOS builds**: Set up macOS runners or EAS for iOS support

For questions or issues, check the GitHub Actions logs or create an issue in the repository.
