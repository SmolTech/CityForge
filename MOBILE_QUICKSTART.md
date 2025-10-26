# Mobile App Quick Start Guide

Get the CityForge mobile app running in 5 minutes!

## Prerequisites

- Node.js 18+ and npm
- Expo Go app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- Backend API running (see `backend/README.md`)

## 1. Install Dependencies

```bash
cd mobile
npm install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your backend URL:

**For physical device testing:**

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:5000
```

**Find your IP:**

- **Mac/Linux:** `ifconfig | grep "inet " | grep -v 127.0.0.1`
- **Windows:** `ipconfig` (look for IPv4 Address)

**Example:**

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:5000
```

> ⚠️ **Important:** Ensure your phone and computer are on the same WiFi network!

## 3. Start Backend

In another terminal:

```bash
cd backend
# Activate venv (from project root)
source ../.venv/bin/activate  # Mac/Linux
# or
..\.venv\Scripts\activate     # Windows

python app/__init__.py
```

Backend should be running on `http://0.0.0.0:5000`

## 4. Start Mobile App

```bash
cd mobile
npm start
```

You'll see a QR code in the terminal.

## 5. Run on Your Phone

1. Open **Expo Go** app
2. Scan the QR code
3. App will load on your phone!

## 6. Create Test Account

In the app:

1. Tap "Register"
2. Enter:
   - First Name: Test
   - Last Name: User
   - Email: test@example.com
   - Password: Test1234 (must have uppercase, lowercase, number)
3. Tap "Register"

You're in! 🎉

## Testing on Simulators/Emulators

### iOS Simulator (Mac only)

```bash
npm run ios
```

Use `http://localhost:5000` in `.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000
```

### Android Emulator

```bash
npm run android
```

Use `http://10.0.2.2:5000` in `.env`:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
```

> Note: Android emulator can't access `localhost` - use `10.0.2.2` instead!

## Troubleshooting

### "Network request failed"

**Check:**

1. Backend is running: `curl http://YOUR_IP:5000/api/cards`
2. Phone on same WiFi as computer
3. Firewall allows connections on port 5000
4. API URL in `.env` is correct

**Test backend from phone:**

- Open browser on phone
- Go to `http://YOUR_IP:5000/api/cards`
- Should see JSON response

### "Cannot connect to Metro"

**Fix:**

1. Close Expo Go
2. Stop `npm start` (Ctrl+C)
3. Clear Metro cache: `npx expo start -c`
4. Scan QR code again

### "Token authentication errors"

**Fix:**

1. Logout and login again
2. Check backend logs for errors
3. Ensure backend has JWT config updated (see backend README)

## Next Steps

- 📖 Read full [Mobile README](mobile/README.md)
- 🚀 Learn about [automated builds](mobile/SETUP_AUTOMATION.md)
- 📦 Deploy to production: [Deployment Guide](mobile/DEPLOYMENT.md)
- 🐛 Report issues: [GitHub Issues](https://github.com/your-org/cityforge/issues)

## Features to Try

1. **Browse Directory**
   - Scroll through business cards
   - Pull down to refresh
   - View business details

2. **Search**
   - Search for businesses by name/description
   - View search results

3. **Resources**
   - Browse by category
   - View resource details
   - Open external links

4. **Profile**
   - View your account info
   - Logout

## Development Tips

- **Fast Refresh:** Shake device → "Enable Fast Refresh"
- **Dev Menu:** Shake device (or Cmd+D on iOS simulator)
- **Reload:** Double-tap 'R' on keyboard (simulators)
- **Inspect:** Open React DevTools in browser after scanning QR

## Building for Production

See detailed guides:

- [SETUP_AUTOMATION.md](mobile/SETUP_AUTOMATION.md) - GitHub Actions setup
- [DEPLOYMENT.md](mobile/DEPLOYMENT.md) - Complete deployment guide

Quick production build:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build
eas build --platform android --profile production
```

---

**Need Help?** Check the [full documentation](mobile/) or [create an issue](https://github.com/your-org/cityforge/issues).
