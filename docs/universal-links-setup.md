# Universal Links Setup (Layer 2 Deep Linking)

Universal Links (iOS) and App Links (Android) allow `trybubble.io/b/:shortId` to open
the Bubble app directly — no browser step, no "Open in App" prompt. When the OS sees a
registered domain, it opens the app immediately if installed.

**Prerequisite:** The app must be distributed via the App Store / Google Play, built with
EAS Build (not Expo Go). Universal Links do not work in Expo Go.

---

## Part A — Server: Serve the well-known files

Add two static route handlers in `server/routes.ts` **before** the catch-all static file
handler. These must be reachable at exactly these paths on `trybubble.io`.

### iOS — Apple App Site Association

```typescript
app.get("/.well-known/apple-app-site-association", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: "TEAMID.com.bubble.mobile",  // replace TEAMID with your Apple Team ID
          paths: ["/b/*"],
        },
      ],
    },
  });
});
```

Find your Apple Team ID at https://developer.apple.com → Membership → Team ID (10-char string).

### Android — Asset Links

```typescript
app.get("/.well-known/assetlinks.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.bubble.mobile",
        sha256_cert_fingerprints: [
          "AA:BB:CC:...",  // replace with your release keystore SHA-256 fingerprint
        ],
      },
    },
  ]);
});
```

Get the SHA-256 fingerprint from EAS:
```
eas credentials --platform android
```
Copy the "SHA-256 Certificate Fingerprint" for your production keystore.

---

## Part B — Mobile app: `app.json` changes

### iOS — Associated Domains entitlement

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.bubble.mobile",
      "associatedDomains": ["applinks:trybubble.io"]
    }
  }
}
```

### Android — Intent filters (Expo handles this automatically)

Add `intentFilters` under the `android` key:

```json
{
  "expo": {
    "android": {
      "package": "com.bubble.mobile",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "trybubble.io",
              "pathPrefix": "/b/"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

---

## Part C — Build and submit

Universal Links require a new binary. After making the changes above:

```bash
# Build for both platforms
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

After the new version is live and installed on a device, tapping `trybubble.io/b/:shortId`
from any app (Messages, WhatsApp, email) will open Bubble directly.

---

## Verification

### iOS
1. Install the new build on a device (not simulator)
2. Send `https://trybubble.io/b/some-short-id` in iMessage to yourself
3. Tap it — should open Bubble, not Safari
4. If Safari opens first, go to Settings → Developer → Universal Links → ensure "Associated Domains Development" is disabled for production

### Android
1. Install the new APK/AAB
2. Run: `adb shell am start -a android.intent.action.VIEW -d "https://trybubble.io/b/some-short-id"`
3. Should launch Bubble directly

---

## Notes

- The well-known files must be served over HTTPS with no redirect (Replit's custom domain handles this)
- iOS fetches the AASA file when the app is installed — changes to the file take effect on next install
- Android verifies assetlinks.json on install; re-install to pick up changes
- The Layer 1 smart HTML page (`/b/:shortId`) remains as a fallback for users who don't have the app installed
