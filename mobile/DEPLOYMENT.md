# Mobile App Deployment Guide

Complete guide for deploying CityForge mobile app to production.

## Table of Contents

1. [Pre-deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Build Configuration](#build-configuration)
4. [Store Setup](#store-setup)
5. [Deployment Workflow](#deployment-workflow)
6. [Post-deployment](#post-deployment)

---

## Pre-deployment Checklist

### Required Accounts

- [ ] Expo account created
- [ ] GitHub repository with Actions enabled
- [ ] Google Play Console account ($25 one-time fee)
- [ ] Apple Developer account ($99/year) - for iOS
- [ ] EAS subscription (if needed for build capacity)

### App Assets

- [ ] App icon (1024x1024 PNG)
- [ ] Splash screen image
- [ ] App screenshots for stores
- [ ] Privacy policy URL
- [ ] Terms of service URL

### Configuration

- [ ] Backend API deployed and accessible
- [ ] SSL certificate for API (HTTPS)
- [ ] Database migrations applied
- [ ] API rate limits configured

---

## Environment Configuration

### 1. Update app.json

Replace placeholders in `mobile/app.json`:

```json
{
  "expo": {
    "name": "CityForge",
    "slug": "cityforge-mobile",
    "owner": "your-expo-username",
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

Get your project ID by running:

```bash
cd mobile
eas build:configure
```

### 2. Update eas.json

Configure production API URLs in `mobile/eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.yourdomain.com"
      }
    }
  }
}
```

### 3. Configure Bundle Identifiers

**iOS (mobile/app.json):**

```json
{
  "ios": {
    "bundleIdentifier": "com.yourcompany.cityforge"
  }
}
```

**Android (mobile/app.json):**

```json
{
  "android": {
    "package": "com.yourcompany.cityforge"
  }
}
```

---

## Build Configuration

### 1. Set Up EAS Build

```bash
cd mobile
eas build:configure
```

This will:

- Link project to your Expo account
- Generate credentials for signing
- Update `app.json` with project ID

### 2. Configure Build Secrets

Add to GitHub repository secrets (Settings → Secrets → Actions):

| Secret Name  | Description        | How to Get                                                                 |
| ------------ | ------------------ | -------------------------------------------------------------------------- |
| `EXPO_TOKEN` | EAS authentication | [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) |

### 3. Test Build Locally

**Android:**

```bash
eas build --platform android --profile preview
```

**iOS:**

```bash
eas build --platform ios --profile preview
```

This ensures your configuration is correct before automated builds.

---

## Store Setup

### Google Play Store

#### 1. Create App Listing

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in:
   - App name: CityForge
   - Default language: English (US)
   - App or game: App
   - Free or paid: Free
4. Accept declarations and click **Create app**

#### 2. Set Up Internal Testing

1. Navigate to **Testing** → **Internal testing**
2. Click **Create new release**
3. Upload your APK/AAB (EAS will build this)
4. Add release notes
5. Save and review

#### 3. Complete Store Listing

Required information:

- App name
- Short description (80 chars max)
- Full description (4000 chars max)
- App icon (512x512 PNG)
- Feature graphic (1024x500 PNG)
- Screenshots (minimum 2)
- App category
- Content rating questionnaire
- Privacy policy URL
- Contact details

#### 4. Configure Service Account (for automated submission)

1. Go to **Setup** → **API access**
2. Click **Create service account**
3. Follow prompts to Google Cloud Console
4. Create service account with "Service Account User" role
5. Create and download JSON key
6. Save as `mobile/google-service-account.json`
7. Grant Play Store access in Console

**Add to .gitignore:**

```bash
echo "google-service-account.json" >> mobile/.gitignore
```

### Apple App Store

#### 1. Create App ID

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+**
4. Select **App IDs** → Continue
5. Enter:
   - Description: CityForge
   - Bundle ID: com.yourcompany.cityforge (explicit)
   - Capabilities: Push Notifications (if needed)
6. Register

#### 2. Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - Platform: iOS
   - Name: CityForge
   - Primary Language: English (U.S.)
   - Bundle ID: Select your Bundle ID
   - SKU: cityforge-mobile
   - User Access: Full Access
4. Create

#### 3. Complete App Information

Required:

- App name
- Subtitle (30 chars max)
- Description (4000 chars max)
- Keywords (100 chars max, comma-separated)
- Support URL
- Privacy policy URL
- App icon (1024x1024 PNG)
- Screenshots for all device sizes
- App category
- Content rights
- Age rating

#### 4. Configure App Store Connect API (for automated submission)

1. In App Store Connect, go to **Users and Access**
2. Click **Keys** tab (under Integrations)
3. Click **+** to generate new key
4. Name: "EAS Submit"
5. Access: Admin or App Manager
6. Download key file (only shown once!)
7. Note the **Key ID** and **Issuer ID**

**Update eas.json:**

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD123456"
      }
    }
  }
}
```

---

## Deployment Workflow

### Option 1: Automated (Recommended)

**For regular releases:**

1. **Update version:**

   ```bash
   cd mobile
   # Update version in app.json
   # Update versionCode (Android) and buildNumber (iOS)
   ```

2. **Create release tag:**

   ```bash
   git add mobile/app.json
   git commit -m "Release mobile v1.0.0"
   git tag mobile-v1.0.0
   git push origin main --tags
   ```

3. **Monitor build:**
   - GitHub Actions will trigger automatically
   - Check progress: Repository → Actions tab
   - Watch EAS dashboard: [expo.dev](https://expo.dev)

4. **Download builds:**
   - Go to your Expo project dashboard
   - Navigate to Builds
   - Download APK/AAB and IPA files

5. **Submit to stores** (if auto-submit configured):
   - Builds will auto-submit to internal testing tracks
   - Review and promote to production in store consoles

### Option 2: Manual

**For one-off builds:**

1. **Build production:**

   ```bash
   cd mobile

   # Android
   eas build --platform android --profile production

   # iOS
   eas build --platform ios --profile production
   ```

2. **Submit to stores:**

   ```bash
   # Android
   eas submit --platform android --latest

   # iOS
   eas submit --platform ios --latest
   ```

### Version Numbering

Follow semantic versioning:

- **Major.Minor.Patch** (e.g., 1.2.3)
- Major: Breaking changes
- Minor: New features
- Patch: Bug fixes

**Update in app.json:**

```json
{
  "version": "1.2.3",
  "ios": {
    "buildNumber": "123"
  },
  "android": {
    "versionCode": 123
  }
}
```

**Build number/version code:**

- Must increment with each build
- Cannot reuse previous numbers
- iOS: String (can be same as version)
- Android: Integer (incremental)

---

## Post-deployment

### 1. Test Builds

**Internal Testing:**

- Install on test devices
- Test all critical flows:
  - Login/Register
  - Browse directory
  - Search
  - View resources
  - Logout
- Check API connectivity
- Verify authentication works

### 2. Beta Testing

**Google Play (Internal Testing):**

- Add testers by email
- Share internal testing link
- Collect feedback

**TestFlight (iOS):**

- Add internal testers
- Submit for Beta App Review (for external testing)
- Share TestFlight link
- Collect crash reports

### 3. Production Release

**Google Play:**

1. Navigate to **Production** track
2. Click **Create new release**
3. Select your tested build
4. Add release notes
5. **Review release**
6. **Start rollout** (can do staged rollout 1% → 10% → 50% → 100%)

**App Store:**

1. In App Store Connect, select your app
2. Create new version
3. Upload build (via EAS submit or Xcode)
4. Submit for review
5. Wait for approval (typically 24-48 hours)
6. Release manually or auto-release after approval

### 4. Monitor

**Key Metrics:**

- Crash-free rate (target: >99%)
- App startup time
- API response times
- User reviews/ratings
- Active users

**Tools:**

- Expo Dashboard (crash reports)
- Google Play Console (Android vitals)
- App Store Connect (metrics)
- Your backend analytics

### 5. Rollback Plan

If critical issues found:

**Google Play:**

- Halt rollout immediately
- Release hotfix as new version
- Staged rollout of fix

**App Store:**

- Submit expedited review for hotfix
- Remove app from sale temporarily (if severe)

---

## Continuous Deployment

### Automatic Builds on Push

Current setup triggers builds on:

- Push to `main` with mobile changes
- Pull requests (preview builds)

### Release Process

1. **Development:** Work in feature branches
2. **Testing:** Create PR → Preview build → Test
3. **Merge:** Merge to `main` → Production build
4. **Release:** Create tag → Both platforms built → Auto-submit
5. **Monitor:** Watch crash reports and metrics

### Recommended Schedule

- **Patch releases:** As needed (bug fixes)
- **Minor releases:** Every 2-4 weeks (new features)
- **Major releases:** Every 3-6 months (major changes)

---

## Troubleshooting

### Build Failures

**"No bundle identifier":**

- Set in `app.json` → `ios.bundleIdentifier`

**"No package name":**

- Set in `app.json` → `android.package`

**"Credentials invalid":**

- Run `eas credentials` to reconfigure

### Submission Failures

**Google Play "Signature mismatch":**

- Using different signing key
- EAS manages this automatically

**App Store "Missing compliance":**

- Add export compliance in App Store Connect

**"Privacy policy required":**

- Add URL in store listings

---

## Security Checklist

- [ ] API uses HTTPS only
- [ ] JWT secret is strong and secure
- [ ] Rate limiting enabled on API
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (using ORMs)
- [ ] XSS protection
- [ ] No secrets in code (use environment variables)
- [ ] Regular dependency updates
- [ ] Crash reporting configured

---

## Resources

- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo EAS Submit](https://docs.expo.dev/submit/introduction/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [React Native Security](https://reactnative.dev/docs/security)
