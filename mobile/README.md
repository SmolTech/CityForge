# CityForge Mobile App

React Native mobile application for CityForge built with Expo.

## Features

- Business directory browsing
- Resource directory
- Full-text search
- User authentication with secure token storage
- Cross-platform (iOS and Android)

## Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android Emulator
- CityForge backend running (see `../backend/README.md`)

## Setup

1. **Install dependencies:**

   ```bash
   cd mobile
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

3. **Update API URL in `.env`:**
   - iOS Simulator: `EXPO_PUBLIC_API_URL=http://localhost:5000`
   - Android Emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000`
   - Physical Device: `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:5000`

## Development

### Start Development Server

```bash
npm start
```

This will start the Expo development server. You can then:

- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Scan QR code with Expo Go app on your physical device

### Run on iOS

```bash
npm run ios
```

**Note:** Requires macOS with Xcode installed.

### Run on Android

```bash
npm run android
```

**Note:** Requires Android Studio and Android SDK installed.

### Run on Web (for testing)

```bash
npm run web
```

## Project Structure

```
mobile/
├── src/
│   ├── api/          # API client
│   ├── components/   # Reusable components
│   ├── contexts/     # React contexts (Auth, etc.)
│   ├── navigation/   # Navigation configuration
│   ├── screens/      # Screen components
│   ├── types/        # TypeScript types
│   └── utils/        # Utility functions
├── assets/           # Images, fonts, etc.
├── App.tsx           # Root component
└── app.json          # Expo configuration
```

## Authentication

The mobile app uses token-based authentication:

- Tokens are stored securely using Expo SecureStore
- Tokens are sent via Authorization header (Bearer token)
- Backend supports both cookie-based (web) and header-based (mobile) authentication

## Building for Production

### Setup EAS (One-time)

1. **Install EAS CLI globally:**

   ```bash
   npm install -g eas-cli
   ```

2. **Create Expo account:**
   - Sign up at [expo.dev](https://expo.dev)

3. **Login to EAS:**

   ```bash
   eas login
   ```

4. **Configure your project:**

   ```bash
   cd mobile
   eas build:configure
   ```

5. **Add GitHub secret for automated builds:**
   - Go to your repository's Settings → Secrets and variables → Actions
   - Add new secret: `EXPO_TOKEN`
   - Generate token: Run `eas whoami` then `eas build:configure` or get from [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)

### Manual Builds

**Preview Build (for testing):**

```bash
# Android APK (can install directly)
eas build --platform android --profile preview

# iOS Simulator build (Mac only)
eas build --platform ios --profile preview
```

**Production Build:**

```bash
# Android App Bundle (for Google Play)
eas build --platform android --profile production

# iOS (for App Store)
eas build --platform ios --profile production
```

### Automated Builds (GitHub Actions)

The project includes automated build workflows:

**1. On every push to `main` (mobile changes):**

- Triggers Android production build automatically
- Build runs on EAS cloud
- Check build status on [expo.dev](https://expo.dev)

**2. On pull requests:**

- Triggers preview build
- Adds comment to PR with build link
- Use for testing before merge

**3. Manual workflow dispatch:**

- Go to Actions → Mobile Build (EAS) → Run workflow
- Choose platform (Android/iOS/All)
- Choose profile (development/preview/production)

**4. Release tags:**

```bash
git tag mobile-v1.0.0
git push origin mobile-v1.0.0
```

- Builds both Android and iOS
- Creates GitHub release
- Optional: Auto-submits to stores (requires setup)

### Build Profiles

The app has three build profiles configured in `eas.json`:

- **development**: For local development with Expo Go
- **preview**: Internal testing builds (APK/Ad-Hoc)
  - Android: APK format (easy to install)
  - iOS: Simulator build
  - API: Staging server
- **production**: Store-ready builds
  - Android: AAB format (Google Play)
  - iOS: Distribution build (App Store)
  - API: Production server

### Submitting to Stores

**One-time setup:**

1. **Google Play Store:**

   ```bash
   # Create a Google Service Account with Play Store access
   # Download the JSON key file
   # Save as mobile/google-service-account.json
   ```

2. **Apple App Store:**
   ```bash
   # Set up Apple Developer account
   # Update eas.json with your Apple ID and App ID
   ```

**Submit builds:**

```bash
# Android to Google Play (internal track)
eas submit --platform android --latest

# iOS to App Store
eas submit --platform ios --latest
```

**Automated submission** (optional):

- Uncomment submission steps in `.github/workflows/mobile-release.yml`
- Add GitHub secrets:
  - `GOOGLE_SERVICE_ACCOUNT_KEY` (base64 encoded JSON)
  - `APPLE_API_KEY` (App Store Connect API key)

## Testing

The app can be tested using:

- iOS Simulator (Mac)
- Android Emulator
- Expo Go app on physical device
- Web browser (limited functionality)

## Troubleshooting

### Cannot connect to backend

1. **iOS Simulator:** Use `http://localhost:5000`
2. **Android Emulator:** Use `http://10.0.2.2:5000` (not localhost)
3. **Physical Device:** Ensure your device is on the same network as your computer and use your computer's IP address

### Token authentication errors

1. Ensure backend is updated to support header-based authentication
2. Check that `JWT_TOKEN_LOCATION` includes `"headers"` in backend config
3. Verify API URL is correct in `.env` file

## Contributing

See main project README for contribution guidelines.

## License

See main project LICENSE file.
