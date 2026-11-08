# Android / Google Play

The game is wrapped with **Capacitor** (no Unity). `android/` is the native project; the game files come from `dist/` (`node tools/build.js`).

## Build in the cloud (no Android Studio needed)
1. Push to GitHub, open **Actions → Android build → Run workflow**.
2. Download the `android-builds` artifact: `app-debug.apk` installs on any phone; `app-release.aab` is the Play bundle.

## Sign for Google Play
Create an upload key once (needs Java): `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`.
Add repo secrets: `ANDROID_KEYSTORE_B64` (`base64 -w0 upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`. Keep `upload.jks` private and backed up. Then use Play App Signing when you upload the `.aab`.

## Local build (optional)
Install Android Studio, then: `npm run build && npx cap sync android && npx cap open android`.

## Play Console checklist
- Developer account ($25 once). New personal accounts need a closed test (about 12 testers, 14 days) before production.
- App id is `com.jayet95.heroesjs` (permanent once published — change in `capacitor.config.json` and `android/app/build.gradle` first if you want another).
- Store listing: icon 512px (`icons/icon-512.png`), feature graphic 1024x500, 2+ phone screenshots, short and full description.
- Privacy policy URL (the game collects no data; say so), Data safety form, content rating questionnaire, target audience.
- Raise `versionCode` in `android/app/build.gradle` for every upload.

## Screens and Android 15/16 (edge-to-edge)
- The app targets SDK 36, where Android draws the app under the status bar, cutout and gesture bar. The game keeps clear of them through `--sat/--sab/--sal/--sar` (CSS safe-area insets; Capacitor's SystemBars plugin supplies them, `insetsHandling: css`).
- Layouts are checked at 344x882 (folded phone), 360x780, 412x915, 915x412 (landscape with cutout insets), 673x841 (unfolded), 800x1280 and 1280x800 tablets.
- Battles prefer landscape: in portrait a "turn your phone sideways" prompt appears (it also asks Android to lock landscape where allowed).
