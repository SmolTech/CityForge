# Mobile App Quick Reference

## Common Commands

### Development

```bash
npm start              # Start Expo dev server
npm run ios           # Run iOS simulator
npm run android       # Run Android emulator
npm run web           # Run in browser
npx expo start -c     # Clear cache and start
```

### Building

```bash
eas build --platform android --profile preview     # Preview APK
eas build --platform ios --profile preview         # Preview iOS
eas build --platform android --profile production  # Production AAB
eas build --platform ios --profile production      # Production IPA
eas build --platform all --profile production      # Both platforms
```

### Submission

```bash
eas submit --platform android --latest  # Submit to Play Store
eas submit --platform ios --latest      # Submit to App Store
```

### Version Management

```bash
# Update version in app.json:
# - version: "1.2.3"
# - android.versionCode: increment by 1
# - ios.buildNumber: increment by 1
```

## API URLs by Environment

| Environment     | Platform         | URL                     |
| --------------- | ---------------- | ----------------------- |
| **Development** | iOS Simulator    | `http://localhost:5000` |
| **Development** | Android Emulator | `http://10.0.2.2:5000`  |
| **Development** | Physical Device  | `http://YOUR_IP:5000`   |
| **Preview**     | Any              | Staging API URL         |
| **Production**  | Any              | Production API URL      |

## File Locations

| What               | Where                                 |
| ------------------ | ------------------------------------- |
| Environment config | `mobile/.env`                         |
| Build profiles     | `mobile/eas.json`                     |
| App metadata       | `mobile/app.json`                     |
| API client         | `mobile/src/api/client.ts`            |
| Auth context       | `mobile/src/contexts/AuthContext.tsx` |
| Navigation         | `mobile/src/navigation/`              |
| Screens            | `mobile/src/screens/`                 |

## GitHub Actions

### Workflows

- **mobile-ci.yml** - Linting and type checking on push/PR
- **mobile-build.yml** - Automated builds on main push
- **mobile-release.yml** - Release builds on version tags

### Required Secret

- `EXPO_TOKEN` - Get from [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)

### Trigger Release Build

```bash
git tag mobile-v1.0.0
git push origin mobile-v1.0.0
```

## Environment Variables

### Required

```env
EXPO_PUBLIC_API_URL=http://YOUR_API_URL
```

### Optional

```env
# None currently
```

## Common Issues & Fixes

| Issue                         | Fix                                       |
| ----------------------------- | ----------------------------------------- |
| "Network request failed"      | Check API URL, backend running, same WiFi |
| "Cannot connect to Metro"     | `npx expo start -c`                       |
| "Token invalid"               | Logout and login again                    |
| Android can't reach localhost | Use `10.0.2.2` not `localhost`            |
| iOS simulator issues          | Use `localhost` not `127.0.0.1`           |
| Cache issues                  | `npx expo start -c`                       |

## Version Numbering

**Semantic Versioning:** `Major.Minor.Patch`

- **Major:** Breaking changes (1.0.0 → 2.0.0)
- **Minor:** New features (1.0.0 → 1.1.0)
- **Patch:** Bug fixes (1.0.0 → 1.0.1)

**Platform Versions:**

- **iOS buildNumber:** String, can match version (e.g., "1.0.0")
- **Android versionCode:** Integer, must increment (1, 2, 3...)

## App Store Statuses

### Google Play

- **Internal testing** - Private, for team (instant)
- **Closed testing** - Limited testers (instant)
- **Open testing** - Public beta (few hours review)
- **Production** - Public release (few hours review)

### App Store

- **TestFlight (Internal)** - Up to 100 testers (instant)
- **TestFlight (External)** - Up to 10,000 testers (review required)
- **Production** - Public release (1-2 days review)

## Testing Checklist

- [ ] Login/Register
- [ ] Browse directory
- [ ] Infinite scroll
- [ ] Pull to refresh
- [ ] Search
- [ ] View resources
- [ ] Open external links
- [ ] Profile view
- [ ] Logout
- [ ] Network errors handled
- [ ] Loading states shown

## Build Profiles

| Profile     | Android Output | iOS Output   | Use For                |
| ----------- | -------------- | ------------ | ---------------------- |
| development | Dev client     | Dev client   | Local dev with Expo Go |
| preview     | APK            | Simulator    | Testing (easy install) |
| production  | AAB            | Distribution | Store submission       |

## Links

- **Expo Dashboard:** [expo.dev](https://expo.dev)
- **Access Tokens:** [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)
- **Google Play Console:** [play.google.com/console](https://play.google.com/console)
- **App Store Connect:** [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- **EAS Build Docs:** [docs.expo.dev/build](https://docs.expo.dev/build)

## Getting Help

1. Check [mobile/README.md](README.md)
2. Check [MOBILE_QUICKSTART.md](../MOBILE_QUICKSTART.md)
3. Check [Expo docs](https://docs.expo.dev)
4. Search [Expo forums](https://forums.expo.dev)
5. Create [GitHub issue](https://github.com/your-org/cityforge/issues)
