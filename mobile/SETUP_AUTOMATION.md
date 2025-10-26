# Mobile Build Automation Setup Guide

This guide walks you through setting up automated mobile app builds via GitHub Actions and Expo Application Services (EAS).

## Prerequisites

- GitHub repository with admin access
- Expo account ([create one here](https://expo.dev))
- Payment method for EAS (has free tier, but production builds may require paid plan)

## Step 1: Create Expo Account

1. Go to [expo.dev](https://expo.dev)
2. Sign up for a free account
3. Verify your email

## Step 2: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 3: Login to EAS

```bash
eas login
```

Enter your Expo credentials.

## Step 4: Link Project to EAS

```bash
cd mobile
eas build:configure
```

This will:

- Create or update `app.json` with your project info
- Set up build profiles in `eas.json`
- Link the project to your Expo account

## Step 5: Create Expo Access Token

You need an access token for GitHub Actions to authenticate with EAS.

**Option A: Via CLI**

```bash
eas build:configure
# When prompted, select "Yes" to create a token for GitHub Actions
```

**Option B: Via Web**

1. Go to [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)
2. Click "Create Token"
3. Name it "GitHub Actions"
4. Copy the token (you won't see it again!)

## Step 6: Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `EXPO_TOKEN`
5. Value: Paste the token from Step 5
6. Click **Add secret**

## Step 7: Test the Setup

### Option A: Manual Workflow Trigger

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **Mobile Build (EAS)** workflow
4. Click **Run workflow**
5. Choose:
   - Platform: `android`
   - Profile: `preview`
6. Click **Run workflow**

### Option B: Push to main branch

```bash
cd mobile
# Make a small change (e.g., update app.json version)
git add .
git commit -m "Test mobile build automation"
git push origin main
```

The workflow will trigger automatically.

## Step 8: Monitor Build Progress

1. **On GitHub:**
   - Go to **Actions** tab
   - Click on your running workflow
   - Watch the build steps

2. **On Expo Dashboard:**
   - Go to [expo.dev](https://expo.dev)
   - Navigate to your project
   - Click **Builds** tab
   - See real-time build progress

## Step 9: Download and Test Build

Once the build completes:

1. Go to [expo.dev](https://expo.dev) → Your Project → Builds
2. Find your completed build
3. Click **Download** (Android APK or iOS Simulator build)
4. Install on device/simulator

**For Android:**

- Transfer APK to Android device
- Enable "Install from Unknown Sources"
- Open APK to install

**For iOS (Simulator):**

- Download the `.app` file
- Drag into iOS Simulator

## Step 10: Production Builds (Optional)

### For Google Play Store

1. **Create Google Service Account:**
   - Go to [Google Play Console](https://play.google.com/console)
   - Setup → API access
   - Create service account
   - Grant permissions
   - Download JSON key

2. **Save key file:**

   ```bash
   # Don't commit this file!
   cp ~/Downloads/google-service-account-*.json mobile/google-service-account.json
   ```

3. **Update eas.json:**

   ```json
   {
     "submit": {
       "production": {
         "android": {
           "serviceAccountKeyPath": "./google-service-account.json",
           "track": "internal"
         }
       }
     }
   }
   ```

4. **Add to .gitignore:**
   ```bash
   echo "google-service-account.json" >> mobile/.gitignore
   ```

### For Apple App Store

1. **Join Apple Developer Program** ($99/year)
2. **Create App Store Connect API Key:**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Users and Access → Keys
   - Create new key with "Admin" or "App Manager" access
   - Download key file

3. **Update eas.json:**
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

## Build Triggers

Your automated builds will trigger on:

### 1. Push to `main` (mobile changes)

- **Trigger:** Any commit to `main` branch that changes files in `mobile/`
- **Action:** Builds Android production build
- **Use case:** Continuous deployment

### 2. Pull Requests

- **Trigger:** PR opened/updated with mobile changes
- **Action:** Builds Android preview (APK)
- **Use case:** Testing before merge
- **Benefit:** Adds comment to PR with build link

### 3. Manual Dispatch

- **Trigger:** Manually from GitHub Actions UI
- **Action:** Build any platform/profile combination
- **Use case:** On-demand builds

### 4. Release Tags

- **Trigger:** Git tag matching `mobile-v*.*.*`
- **Action:** Builds both Android and iOS production
- **Use case:** Official releases

Example:

```bash
git tag mobile-v1.0.0
git push origin mobile-v1.0.0
```

## Cost Considerations

**EAS Build Pricing (as of 2024):**

- **Free Tier:**
  - Priority builds
  - Limited concurrent builds
  - Good for small projects

- **Production Plan (~$29/month):**
  - Faster builds
  - More concurrent builds
  - Better for team development

Check current pricing: [expo.dev/pricing](https://expo.dev/pricing)

**GitHub Actions:**

- Public repos: Free unlimited
- Private repos: 2000 minutes/month free (builds run on EAS, so minimal GitHub minutes used)

## Troubleshooting

### "No EXPO_TOKEN secret found"

- Double-check secret name is exactly `EXPO_TOKEN`
- Ensure secret was added to correct repository

### "Project not configured for EAS Build"

- Run `eas build:configure` in mobile directory
- Commit and push `app.json` and `eas.json` changes

### "Build failed: Invalid credentials"

- Token may have expired
- Generate new token and update GitHub secret

### "Android build failed: No keystore"

- First build will generate keystore automatically
- EAS manages keystores for you

### "iOS build failed: No provisioning profile"

- Ensure you have Apple Developer account
- Run `eas build --platform ios` locally first to set up credentials

## Next Steps

1. ✅ Test automated builds
2. ✅ Configure API URLs in `eas.json` for different environments
3. ✅ Set up staging/production backend servers
4. ✅ Configure app signing for stores
5. ✅ Set up automated submissions (optional)
6. ✅ Add app icon and splash screen
7. ✅ Configure app permissions in `app.json`

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [GitHub Actions with Expo](https://docs.expo.dev/build/building-on-ci/)
- [Expo Pricing](https://expo.dev/pricing)
