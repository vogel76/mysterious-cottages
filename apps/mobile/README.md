# Chatynkowo mobile app

The expedition loop of the site as a native app, offline-first: the Atlas
(map of cottages), plaque-code entry (four digits or a QR scan), the story
with its recording, the Kronika (rewards), the leaderboard and a profile,
plus the elf companion prototype as a tab of its own (see the section at the
end). Expo SDK 57, TypeScript, expo-router, a development client (native
modules are used, so Expo Go cannot run it).

The app owns only its interface, navigation and native adapters. Everything
that is domain logic lives in the shared packages: `@chatynkowo/core`
(content, codes, progress, geography, offline rules), `@chatynkowo/api`
(the Supabase backend) and `@chatynkowo/i18n` (the dictionaries, including
the app-only `mobile` namespace).

## Running

Prerequisites: Node 22, pnpm 11, and for a device build Android Studio
(SDK + an emulator or a USB device) or Xcode on macOS.

```bash
pnpm install                        # from the repository root, once
cd apps/mobile
npx expo run:android                # builds and installs the dev client, starts Metro
npx expo run:ios                    # macOS only
npx expo start --dev-client         # later starts, with the client already installed
```

The native projects (`android/`, `ios/`) are generated from `app.json` (and
`app.config.ts`, which adds what depends on the environment) by continuous
native generation and are not committed; `expo run:*` creates them on
demand. After changing either file or adding a native module, run
`npx expo prebuild --clean` or simply `expo run:*` again.

Tablets are first-class: the iPhone keeps portrait, the iPad takes every
orientation (`UISupportedInterfaceOrientations~ipad`), and since iPadOS 26
runs apps in windows of any shape, reading content keeps to the readable
width (`sizes.readable`, the `readable` column style in `src/ui`) while the
Atlas stays full-bleed.

Configuration comes from `EXPO_PUBLIC_*` variables in `apps/mobile/.env`
(template: `.env.example`); without the file the app uses the production
Supabase project and `https://www.chatynkowo.pl` as the content origin.

Because the content origin is the published site, a change under
`packages/content/public` (a new cottage, a translation) reaches the app
only once the site is deployed. To review it earlier, serve the package
from the site's dev server and point the app at it through the emulator's
port forwarding:

```bash
pnpm --filter @chatynkowo/web dev                   # serves packages/content/public at http://127.0.0.1:5173
adb reverse tcp:5173 tcp:5173                       # the emulator's localhost:5173 -> the host
echo 'EXPO_PUBLIC_CONTENT_BASE_URL=http://localhost:5173' > apps/mobile/.env
npx expo start --dev-client --clear                 # the variable is inlined at bundle time
adb shell pm clear pl.chatynkowo.app                # the content cache keeps files for up to a day
```

Remove the `.env` line afterwards; with it, the app needs that server.

### A standalone APK for a phone

The release variant embeds the JS bundle, so the installed app needs
neither Metro nor the computer, like one from a store. Build it with no
`.env` in place (the `EXPO_PUBLIC_*` values are inlined at build time):

```bash
cd apps/mobile/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a   # phones; drop the flag for a universal APK (all four ABIs, ~2.5x larger)
# -> app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk     # over USB or Wi-Fi debugging, or copy the file to the phone and open it
```

The release variant is signed with the debug keystore of the generated
project, which is fine for your own devices but not for Google Play; a
store build needs its own keystore or EAS Build.

Checks, run from the repository root:

```bash
pnpm check                                          # type-checks every package, incl. the app, plus the conventions script
pnpm --filter @chatynkowo/mobile export:android     # bundles the JS for Android through Metro (no SDK needed)
```

### Android SDK without Android Studio (Linux)

Everything the build needs can be installed from the command line into the
home directory, no root required:

```bash
# JDK 17 (Temurin) into ~/.jdks, then the SDK command line tools into ~/Android/Sdk
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "emulator" \
  "system-images;android-36;google_apis;x86_64" "ndk;27.1.12297006" "cmake;3.22.1"
avdmanager create avd --name chatynkowo --package "system-images;android-36;google_apis;x86_64" --device pixel_8
```

Set `JAVA_HOME`, `ANDROID_HOME` and put `platform-tools`, `emulator` and
`cmdline-tools/latest/bin` on the path. The emulator's x86_64 images need
KVM: `/dev/kvm` must exist (virtualisation enabled in the firmware, the
`kvm_amd` / `kvm_intel` module loaded) and the user must be in the `kvm`
group. `emulator -accel-check` tells you which of these is missing.

Metro is configured in `metro.config.js` to watch the repository root and
to resolve from both `node_modules` directories, which is enough for pnpm's
isolated layout; `node-linker=hoisted` in the root `.npmrc` stays commented
out unless a future native module needs it. The same file resolves the bare
`three` specifier to the package's ES module: three is ESM-only from 0.186
and its "require" entry, the one Metro would pick, is a deprecation shim
calling `process.emitWarning`, which Hermes does not have.

Watching the whole monorepo needs more inotify watches than Linux grants
by default; when edits stop reaching the app (Metro logs no "Bundled"
line), raise the limit or install Watchman:

```bash
sudo sysctl fs.inotify.max_user_watches=524288   # or: sudo apt install watchman
```

## Structure

```
app/                     expo-router routes
  _layout.tsx            fonts and the bootstrap behind the splash, the providers, the root native Stack:
                         welcome and (tabs) behind Stack.Protected guards, the sheets and modals on top
  welcome.tsx            the onboarding pager (the lore; the four questions and the creed; the guide as a trail;
                         the photo, the notes and the two ways to begin), first launch only
  (tabs)/_layout.tsx     the tab bar (src/ui/TabBar.tsx): Atlas / Elf / Kronika / Ranking / Profile around a raised gold
                         centre button that opens the code sheet (long press: the scanner); the button stays centred
                         with an odd number of tabs (each half of the bar shares its width among its tabs)
  (tabs)/index.tsx       the Atlas: the full-bleed map with floating chrome, the quest card, the seeker's position
                         and the parchment cottage sheet (a gesture sheet with three snaps)
  (tabs)/kronika/        its own native stack: the collection grid with the progress card
  (tabs)/elf/            its own native stack (_layout.tsx, no bar on the screen) and one screen (index.tsx): the elf
                         companion prototype, the full-screen cottage drawn in Skia with the HUD floating over it
  (tabs)/ranking/        its own native stack: the leaderboard list, the rules and share header items
  (tabs)/profile/        its own native stack: grouped settings (account, language, lore, legal, social),
                         about.tsx (the lore sections) and guide.tsx (the onboarding pager replayed)
  code.tsx               the code entry as a sheet (auto-submits at the fourth digit)
  scan.tsx               the QR scanner, full screen under a transparent bar with torch and close items
  cottages.tsx           every cottage, found first, with a search box and an undiscovered-only filter: one page
                         sheet from the Atlas's search control (keyboard up) and the Kronika's progress card
  story/[slug].tsx       the story as a page sheet: the unlock ceremony the first time, a plain revisit later
  celebrate.tsx          the reward reveal, a transparent modal the Atlas presents after a story
  reward/[id].tsx        one reward card, a sheet that opens at three fifths and can be pulled to the top
  rules.tsx              the ranking rules, a sheet sized to its content
  elf-catch.tsx          the elf in the camera view (the first prototype's remain, nothing navigates to it any more)
  elf-evolve.tsx         the evolution card, a transparent modal the Elf tab presents when a new form is reached
  +native-intent.tsx     where a URL handed to the app goes (plaque links with a code, story and reward links)
  +not-found.tsx         redirects to the Atlas
src/
  config.ts              EXPO_PUBLIC_* with production defaults, storage keys
  i18n/                  the i18next instance: "translation" + "mobile" namespaces, device locale, remembered choice
  ui/                    the interface layer: tokens, fonts, icons (plus the tab glyphs and the native header symbols), motion
                         tokens, Text, Button/LinkButton/IconButton on PressableScale, Screen, ContentImage (expo-image),
                         Skeleton, ProgressRing, CrossfadeText, PageDots, GlowPulse, EmptyState, Toast,
                         SettingsList, Sheet (the base of every sheet route), TabStack, headerItems, TextField, MarkdownView
  lib/                   adapters: bootstrap (what the splash reads), cached content client, progress + sync-queue
                         storage, Supabase and native sign-in, audio (expo-audio), recordings (file system), maps
                         hand-off, position, reachability store, haptics, accessibility announcements
  providers/             BootProvider, NetworkProvider, SessionProvider, ContentProvider, ProgressProvider, ToastProvider,
                         ElfProvider (the companion's state), useCloseModal (the one way a modal route closes)
  features/              screen-level components per area: atlas/, code/, cottages/ (the directory both tabs open), story/, kronika/, ranking/, profile/, welcome/
  features/elf/          the companion prototype: rules.ts (the pure care rules, the stored outfit and decor, the last
                         interaction), cottage/ (the full-screen Skia room: room.ts with the room units and the slots,
                         CottageScene with its two ways of drawing the room; the rendered one in RoomSprites.tsx (the
                         plate and the furniture sprites), SpriteElf.tsx (the elf's atlases on the puppet's motion)
                         and roomAssets.ts (the room manifest, which variants are rendered); the vector one in
                         items/<slot>/<Variant> with the decor catalogue in items/index.ts, wearables/ with the
                         wardrobe catalogue, ElfPuppet with puppet/geometry.ts; shared by both: Lighting, clock.ts
                         with the day phase, motion, EggNest, Particles, SlotMarkers for the edit mode), the screen
                         components (ElfTab, ElfHud, ElfActionBar with drag-to-feed, ElfPicker and ElfThumb for the
                         wardrobe and the decorating panel, useReturnGreeting, the adoption form, the evolution card),
                         and the first prototype's remains, unused by the tab and kept until removed: scene/ (the
                         three.js figure and the scene view) and catch/ (the camera view)
                         sprites/ plays the atlases the art pipeline packs (manifest and registry, the decoded
                         sheets, a UI-thread frame clock, SpritePlayer and LayeredSprite on Skia's Atlas, SpriteDemo)
art/                     the Blender art pipeline (art/README.md): common.py with the shared scene, camera, light
                         and materials, elf.py (the character, its rig and clips) and room.py (the room plate and
                         the furniture), pack.py (frames to WebP atlases and a manifest), the contact sheets;
                         renders go to art/out, only the packed result is committed under assets/elf
assets/elf/              room/ (manifest.json, plate.webp: the empty room at the room units, 1000 by 1600, and one
                         transparent crop per furniture variant with its place in the plate), sprites/<character>/
                         (the packed atlases and manifests the sprite player draws; elf/ today), background.webp
                         (the Chatynkowo painting, seen through the vector cottage's window) and elf.glb (the first
                         prototype's animated model, CC BY, see assets/elf/README.md; unused by the tab)
scripts/                 prepare-elf-model.mjs: transcodes the prototype's WebP-textured model into assets/elf/elf.glb
metro.config.js          the monorepo watch and resolve settings, .glb added to the asset extensions for the model, and
                         `three` pointed at its ES module (its CommonJS entry is a shim that throws on Hermes)
app.config.ts            the configuration that depends on the environment: Sign in with Apple (the capability and its
                         plugin, unless EXPO_PUBLIC_APPLE_SIGN_IN is 0), the Google sign-in plugin with the iOS URL scheme
                         derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, the app's Apple team (signing, and the Sign in
                         with Apple key the backend script reads from here)
plugins/                 config plugins: with-scene-delegate.js (UIScene life cycle for the iOS 27 SDK),
                         with-locale-filters.js (only the app's languages in the Android resources)
locales/                 native permission strings per language (iOS Info.plist)
assets/                  app icon, adaptive icon layers, the splash emblem and the logo, generated from the brand logo in
                         packages/content/private/img
```

Navigation model: the tab bar holds destinations only (the Atlas, the
collection, the elf, the leaderboard, the profile); entering a code is an action and
lives in a sheet reachable from the tab bar's centre button, the cottage sheet, the
onboarding, the empty states and plaque links, so every `/code` href still
works. A discovery runs in place (the sheet or the scanner shows the
outcome), the story replaces that screen, and the Atlas presents the reward
reveal once the story has closed. The Elf tab follows the same split: the
tab is the destination, the evolution card (`/elf-evolve`) is a modal over
it (the catch in the camera view, `/elf-catch`, is still registered but no
longer reachable from the tab). Motion goes through the tokens in
`src/ui/motion` (reanimated 4, system reduce-motion respected) and haptics
through `src/lib/haptics.ts`.

## How the data flows

- **Content** (`src/lib/content.ts`, `ContentProvider`): the core content
  client reads the published files (the `packages/content/public` tree, as
  the site serves it) from the site origin; every file is kept
  in AsyncStorage as a `CacheEntry` and served stale-while-revalidate: a
  fresh copy is used as is, a stale one is shown at once and refreshed in
  the background, and with no network the stale copy is final. A cold start
  in airplane mode therefore shows the last known map, stories, rewards and
  code lookup. Only the very first launch needs a connection.
- **Codes** (`src/features/code/useCodeEntry.ts`): the four digits are
  hashed with expo-crypto and matched against the cached lookup on the
  device (`lookupCode` from core); manual entry and the scanner feed the same
  hook. The scanner extracts the code from the QR payload with
  `codeFromScan` (bare digits, or a `kod`/`code` parameter in a link).
- **Progress** (`ProgressProvider`, `src/lib/progress-store.ts`): the local
  Kronika is the source of truth (`StoredState`, the same shape as the site
  and the backend). A discovery runs the core rules, is saved, and lands in
  the sync queue (`SyncQueue`, core `offline.ts`); the queue is pushed with
  `syncFinds` whenever the device is online and someone is signed in, and
  retried on every reconnect. Signing in exchanges finds with the account
  (earliest date wins, nothing is ever removed).
- **Account** (`SessionProvider`, `src/lib/sync.ts`): the Supabase session
  lives in AsyncStorage with URL detection off; token refresh runs only in
  the foreground. Sign-in is native: Google (`@react-native-google-signin`)
  and Apple (`expo-apple-authentication`, with a nonce the backend checks
  against the token), both handed to `signInWithIdToken`. The build offers what it can: the Google button once
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set (on iOS once
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is too), the Apple button on iOS unless
  `EXPO_PUBLIC_APPLE_SIGN_IN=0` left the capability out of the build; with
  neither, the account controls stay hidden and the app runs signed out,
  like the site. A closed
  dialog is not a failure; a failure is a toast and a console line. Signing
  out revokes the session when the backend can be reached and forgets it on
  the device either way; the sync queue ends with the session, the Kronika
  stays.
- **Elf companion** (`ElfProvider`, `src/features/elf/rules.ts`): the egg
  or the elf lives in AsyncStorage under `STORAGE_KEYS.elf`, read when the
  provider mounts (not in the bootstrap: the elf is not on the first
  screen) and brought up to date with the time away. In the foreground a
  one-second tick applies the needs' decay; the state is saved after every
  action, every ten seconds while it only drifts, and when the app leaves
  the foreground. A form reached by a gain waits in `pendingEvolution`
  until the Elf tab has shown its card; one-shot reactions (`care`, `pet`,
  `levelUp`, `egg`, `wake`) are published to listeners so the tab can
  answer them once (a level gained reaches the scene and the hint from
  there; the rest are answered where they happen) instead of deriving them
  from state. Nothing reaches the
  account yet.

## Native pieces

| Area | Library | Notes |
|---|---|---|
| Map | `@maplibre/maplibre-react-native` | the site's fairy-tale map: OpenStreetMap tiles washed into parchment that turn real as the seeker zooms in, teardrop pins gathered into clusters (`supercluster`), the search area around the chosen cottage, the level indicator, reset and search controls, the parchment cottage panel, a beacon at the edge of the map towards the nearest cottage with its distance when none is in view (the map keeps north up: no rotation); the same per-country opening frame as the site (`homeCountry` / `homeBounds` in core `geo.ts`); "Navigate" opens the system maps app |
| Position | `expo-location` | foreground permission asked from the locate control; once granted the Atlas watches the position while it is focused (balanced accuracy, 20 m) and shows it as a dot under the pins; the launch's first fix frames the seeker with the nearest cottage (unless they moved the map or framed a cottage already), the control centres the map; a one-time grant that lapsed while the app was away is asked for again by the Atlas, once per launch, once the seeker has located themselves before |
| Splash | `expo-splash-screen` | the brand logo on the page colour until the fonts and the bootstrap (language, progress, cached content, flags; capped at 1500 ms) are in, then a 300 ms fade into a fully formed first frame |
| Story audio | `expo-audio` | background playback (`UIBackgroundModes: audio` via its plugin) and lock-screen / notification controls (`setActiveForLockScreen`); a language without a recording falls back to the Polish original when the file fails to load |
| Recordings offline | `expo-file-system` | "Save on this device" downloads the mp3 into the document directory, one folder per language; a saved file plays from disk |
| QR | `expo-camera` | `CameraView` scanning `qr` only, torch from the header; the code is resolved on the scanner itself through the same `useCodeEntry` as manual entry |
| Cottage scene | `@shopify/react-native-skia` | the elf's cottage (`src/features/elf/cottage`): one full-screen `Canvas` whose transforms, opacities and control values are Reanimated shared values, so every loop and reaction runs on the UI thread with no React state per frame; in sprite mode the room is the Blender plate as an `Image`, the furniture its rendered crops and the elf an `Atlas` node fed one cell per frame from the packed sheets (`src/features/elf/sprites`), in the vector fallback a 2D scene graph of paths, gradients, blur and shadow effects with the painting through the window; the room is designed in room units (1000 by 1600) and scaled to cover the screen; the canvas is `opaque` (the room covers it anyway), which backs it with a SurfaceView on Android, the cheapest path and the only one that draws on the emulator |
| Camera | `expo-camera` | next to the QR scanner, the elf catch (`app/elf-catch.tsx`, the first prototype's remain, unreachable from the tab) shows the camera preview with the 3D figure over it, the permission asked on entry as the scanner does |
| 3D scene | `expo-gl` + `three` + `@react-three/fiber` | the first prototype's scene (`src/features/elf/scene`), no longer used by the Elf tab and kept until removed: a `GLView` at the device's native resolution, three's loaders fed through the native polyfills (the model is read from the bundled asset, textures decoded on the device), the painting as a React Native image behind a transparent canvas, and the skinned mesh fitted to the stage's height with `Box3` precise bounds computed from the animated pose (the rest pose of this rig is folded up) |
| Motion sensor | `expo-sensors` | `DeviceMotion` drives the parallax of the catch view (the first prototype's remain), so the figure seems anchored in the room as the phone turns |
| Tabs and stacks | `react-native-screens` through expo-router | a custom tab bar (`Tabs` from expo-router/js-tabs with the `tabBar` prop; it reports its height through `useTabBarHeight` so screens keep clear of it), native stack headers (transparent with the system glass on iOS), `transparentModal` routes carrying the shared sheet (src/ui/Sheet.tsx) for the code, reward and rules, `modal` page sheets for the story and the cottage list |
| Sheets | `@gorhom/bottom-sheet` | one base for every sheet: the in-screen parchment panel over the map (three snaps, the map stays pannable, the camera keeps room for it) and the sheet routes (the code gate, a reward, the rules), which open at their own height or part-way and can be pulled to the top; a scroll inside moves the content first |
| Motion | `react-native-reanimated` 4 + `react-native-gesture-handler` | springs, entrances, the progress ring, the scrub bar, the toast gesture; every animation passes `ReduceMotion.System` |
| Haptics | `expo-haptics` | one module (`src/lib/haptics.ts`) and only three moments: medium on the seal of a fresh find, success on an accepted code and a revealed reward, error on a refused code; no control, tab, pager or toast vibrates; iOS uses the UIKit generators, Android the system `HapticFeedbackConstants` through `performAndroidHapticsAsync` (the OEM's short click, under the system touch-feedback setting and intensity), with the Vibrator notification patterns kept only for success and error below API 30 |
| Images | `expo-image` | `ContentImage`: memory and disk cache, cross-dissolve, retries with a backoff and on reconnect, a quiet fallback after the last failure, prefetch of the reward art and the found cottages' photos |
| Legal pages | `expo-web-browser` | the terms and privacy pages open in an in-app browser sheet |
| Fonts | `expo-font` + `@expo-google-fonts/*` | Cormorant Garamond and Cinzel Decorative, imported per weight; the repository's woff2 files cannot be used natively |
| Locale | `expo-localization` | the device language picks the dictionary and, through `detectCountry`, the map's home country (never geolocation) |
| Country names | `@formatjs/intl-displaynames` | Hermes has no `Intl.DisplayNames`; the polyfill with Polish and English data names a cottage's country in the map panel, as the site does |
| Release size | `expo-build-properties` | R8 and resource shrinking in Android release builds (`enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`): the Java/Kotlin code drops from 55 MB to about 21 MB before packaging; the native libraries ship their own keep rules, so no rules of ours |
| Locale filter | `plugins/with-locale-filters.js` | config plugin that writes the Android Gradle plugin's `localeFilters` from `expo.locales` in app.json, so the libraries' strings in the other eighty languages stay out of the APK (Google Play does the same split from an app bundle) |
| Scene life cycle | `plugins/with-scene-delegate.js` | config plugin for the iOS 27 SDK, which asserts at launch unless the app adopts UIScene: the generated `AppDelegate` conforms to `ExpoReactNativeFactoryProvider` and stops starting React Native itself, a `SceneDelegate` subclasses Expo's `ExpoAppSceneDelegate` (it creates the window and starts React Native from the scene), and `Info.plist` gets the `UIApplicationSceneManifest`; idempotent, skipped from SDK 58 on (the template adopts scenes itself), refuses an expo older than 57.0.25 |

Sign-in setup lives in `supabase/README.md` (the Google and Apple
providers, their client ids, the Supabase side). On the app's side
everything comes from `.env` through `app.config.ts`, and a change there is
followed by a native rebuild: the Google sign-in plugin joins the build with
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` read backwards as its iOS URL scheme (the
plugin refuses to run without one); Sign in with Apple, the capability on
the App ID (`ios.usesAppleSignIn`) and the `expo-apple-authentication`
plugin, is in every build unless `EXPO_PUBLIC_APPLE_SIGN_IN=0`, which a free
Personal Team sets because it cannot sign the capability; `APPLE_TEAM_ID`
names the team that signs device builds.

TODO universal links: the plaque QR carries `https://www.chatynkowo.pl/?kod=NNNN`. The Android half is in place (`android.intentFilters` for `https://www.chatynkowo.pl/`, `/index.html` and `https://chatynkowo.pl/` with `autoVerify`; it stays a plain browser choice until the site serves `/.well-known/assetlinks.json` with `delegate_permission/common.handle_all_urls` for `pl.chatynkowo.app` and the release signing SHA-256). The iOS half is not: add `ios.associatedDomains: ["applinks:www.chatynkowo.pl", "applinks:chatynkowo.pl"]` to `app.json` only once the site serves `/.well-known/apple-app-site-association` (applinks for `<TEAMID>.pl.chatynkowo.app` with components for `/` and `/index.html` carrying a `kod` or `code` query, so `ranking.html` share links keep opening the website), because the Associated Domains capability changes device code signing. `app/+native-intent.tsx` already maps both URL forms to the code sheet.

## Conventions

- Icons come only from `src/ui/icons.ts`, which mirrors the web vocabulary
  name for name (`CloseIcon`, `ChronicleIcon`, ...) and the `iconSize`
  scale; the role names are the theme's `SHARED_ICON_ROLES` and
  `MOBILE_ICON_ROLES`, checked at compile time. `phosphor-react-native` is
  imported nowhere else, and only through its per-icon entries
  (`phosphor-react-native/src/icons/<Name>`): Metro does not tree-shake,
  and the package root would put all 1500 icons in the bundle. Those
  entries are sources, so the type check needs Expo's augmentations
  (`src/types/expo.d.ts` keeps the reference in every checkout; the
  generated `expo-env.d.ts` is ignored). No emoji or typographic glyph is
  used as an icon. `scripts/check-conventions.mjs` enforces all of this as
  part of `pnpm check`.
- Screens compose the primitives in `src/ui` and never restyle them; the
  tokens come from `@chatynkowo/theme`, the same package the site's
  stylesheet is generated from, so a colour changes in one place for both
  clients.
- Every user-facing string goes through i18next: the shared set
  (`packages/i18n/src/shared/`) as the `translation` namespace, the app-only
  set (`packages/i18n/src/mobile/`) as `mobile`, typed so both languages
  stay complete; the site's own strings live in `packages/i18n/src/web/`.
- Domain logic that a screen needs goes to `@chatynkowo/core` first, then
  is consumed here.

## Extending

- A new tab is one `Tabs.Screen` in `app/(tabs)/_layout.tsx` (glyph in
  `TAB_ICONS`, `src/ui/icons.ts`) plus a file or a folder with a `TabStack`
  layout; a new top-level surface (a shop or a wardrobe, say) is one
  `Stack.Screen` in `app/_layout.tsx`, as a sheet or a modal.
- Per-user state that must reach the account follows the finds pattern:
  rules in core, a store in `src/lib`, a queue entry in `SyncQueue`, a
  push in `ProgressProvider`.
- The content cache takes any loader: `cached(name, maxAge, loader)` in
  `src/lib/content.ts`.

Not in this iteration, deliberately: analytics, notifications and
geofencing.

## The elf companion (prototype)

A care loop like a virtual pet, in the spirit of Pou: the seeker adopts an
egg, keeps it warm until it hatches, then feeds, plays with and bathes a
small elf whose needs fall in real time, and watches it grow through four
forms. The elf lives in its cottage, and the cottage is the whole tab: a
painted room in Skia (`src/features/elf/cottage`) that fills the screen
under the status bar and the floating tab bar as the Atlas does, with the
elf big in the middle, and a light HUD over it (`ElfHud.tsx`: the name,
the form, the wardrobe and decorating buttons and the needs as small chips
at the top, the mood pill under them; `ElfActionBar.tsx`: the round care
buttons above the tab bar). A tap on the elf pets it (within the pet
cooldown it is poked instead, so it always answers), a tap on the egg
rocks it. It touches nothing of the expedition flow: no cottage, code,
story or reward knows about it. The game mechanics around the care loop
(levels on show, skills, a shop) are deliberately out of scope for this
iteration; the rules still count experience and forms underneath, so the
evolution card still appears.

The rules (`src/features/elf/rules.ts`, pure functions over an immutable
state) carry the care loop of the first prototype plus what the player
chose: the outfit and the decor as the slots they changed (plain strings;
the catalogues live in the cottage and the provider resolves a stored id
against them, so an id the catalogue no longer knows falls back to the
slot's default) and `lastInteraction`, recorded by every care, pet, egg,
sleep and swap:

| Rule | Values |
|---|---|
| Needs | fullness, joy, energy, clean; each 0 to 100 |
| Decay per minute awake | fullness 0.7, joy 0.55, energy 0.45, clean 0.35; asleep the losses fall to a fraction (0.4 / 0.35 / 0 / 0.3) and energy returns at 1.8 a minute, waking the elf at 100; an absence counts for at most 720 minutes |
| Mood | sleep while asleep; sick when any need is at 0; sad under an average of 28; happy above 72; otherwise ok. A need under 20 is called out in the mood pill |
| Egg | warm +18 and rock +13 warmth (a tap on the egg rocks it); it hatches at 100 |
| Feed | fullness +26, joy +3, energy -2, clean -6, 4 xp; refused at fullness 98 or more, and over 92 it spoils the joy by 6 |
| Play | joy +24, energy -12, fullness -7, 7 xp; refused at energy 10 or less |
| Bath | clean +42, joy +4, energy -5, 3 xp |
| Train | joy +6, energy -18, fullness -8, clean -6, 13 xp; refused at energy 22 or less; no button for it in the cottage |
| Pet (a tap on the elf) | joy +4, 1 xp, 1.4 s between taps |
| Catch (camera view) | joy +12, 6 xp; the view is no longer reachable from the tab |
| Levels | 20 xp for the first, then 18 more per level (`xpNeeded`) |
| Forms | baby from level 1, young from 4, adult from 8, elder from 15; the egg is the state before hatching |

Every action is refused while the elf sleeps (the buttons dim and tell
assistive tech so, but stay pressable: the rules refuse and the sleeping
hint answers, waking excepted), and the first form, the level and fresh
needs are set when the egg hatches.

### The feel

What the research into the pets that do this well (Pou, Tamagotchi,
Talking Tom, Neko Atsume, Finch) says, applied in the tab:

- **The elf notices the player.** The scene's `lookAt` turns the eyes and
  the head toward a point on the screen (the sprite elf, with no separate
  head, leans towards it); a stroke over the body is the most alive input
  (eyes close, the head leans in, hearts trickle).
- **Idle fidgets** every 8 to 15 seconds (an ear twitch, a yawn, a glance
  at the fire, a shift of weight) keep it alive between actions; a tired
  elf (energy under 30) gets heavy lids and yawns.
- **Drag-to-feed.** The acorn of the feed button can be dragged: it floats
  under the finger (an `Animated.View` over the tab, fed by the action
  bar's pan gesture in window coordinates), the elf follows it with its
  eyes (the sprite elf leans towards it), and dropping it on the elf
  (`hitsPuppet`) feeds it; dropped elsewhere it springs back to the button
  and fades. The pan races the
  button's tap, so a still finger is still a tap.
- **The elf speaks first.** A need under the low mark makes it turn to the
  player and wave (`react('call')`, the `callHint`), once per episode of
  that need, never while asleep, out of focus, behind a panel or while a
  greeting plays. A return after half an hour without an interaction is
  greeted (`useReturnGreeting.ts`: a stretch, a wave, sparkles and the
  `greetHint`) when the tab comes into focus or the app comes back to the
  foreground on it; the greeting counts as the interaction, so it is not
  repeated until another half hour has passed.
- **A clock-driven light** (`cottage/clock.ts`) in the vector room:
  `Lighting.tsx` and the window variants change the moonlight, the fire's
  warmth and the sky in the glass with the hour. Over the rendered plate,
  lit in Blender, only the hearth's pulse and the night tint of sleep are
  painted (`PlateLighting`); the hour will return once the pipeline
  renders a day and a night plate.

### The wardrobe and the decorating mode

Customisation follows the pattern that works in these games: fixed slots
with small catalogues and an instant live preview. The wardrobe
(`cottage/wearables/`) has five slots (hat, outfit, neck, hand, face) and
the decor (`cottage/items/index.ts`) one variant list per furniture slot
of the room, the fireplace excepted. In sprite mode (below) the wardrobe
button is hidden, since the rendered elf has no hat layers yet, and the
decorating panel offers only the slots with more than one rendered
variant (`cottage/roomAssets.ts`: the rug, the bed and the window today)
and only those variants. Both open from the HUD as a panel
inside the tab (`ElfPicker.tsx`), not as a route: a route would unfocus
the tab and pause the scene, and the point of the panel is the live
preview in the room behind it. The panel rises in place of the action bar
in the Atlas's chrome, with a tab strip of slots and a strip of
thumbnails (`ElfThumb.tsx`: a 72 pt Skia canvas that shows the piece's
rendered sprite, or draws the vector item or the baby elf wearing the real
wearable with still shared values, so a strip costs nothing per frame;
only the active slot's strip is mounted).
A tap equips or places at once through the provider, which saves it; the
equipped item wears a check, and tapping it again takes it off where the
slot has a 'none'. In the wardrobe the elf twirls after each pick. In the
decorating mode the scene is in edit mode: the slots become tap targets
that pick the panel's tab, the hint says so, and the elf admires each
piece placed (`admireSlot`: it looks at it and sparkles).

### The art

The art is rendered in Blender (`art/`, see `art/README.md`): the room
and the elf are modelled, rigged, lit and animated by script, rendered to
frames with alpha and packed into WebP; the phone draws pictures, which is
smooth on any device, and the light, the cloth and the outlines are
computed offline where they can be as rich as the renders allow. The
cottage started as vectors drawn in code (Skia paths, gradients and
effects) and the owner found that look clumsy, so the scene now has two
ways of drawing the room and picks the rendered one, its sprite mode,
whenever the elf character is registered in `sprites/manifest.ts` and the
room manifest loads.

In sprite mode the room is a plate (`assets/elf/room/plate.webp`, the
empty room with its walls, floor, beams and the fireplace with its fire,
rendered at exactly the room units) with the furniture laid over it as
transparent crops (`assets/elf/room/manifest.json` says where each
variant sits in the plate, `cottage/RoomSprites.tsx` draws them, the
rug under the elf and the rest in their depth), and the elf is an atlas
(`assets/elf/sprites/elf/`: a cell of 293 by 422 pixels per frame, the
feet as the anchor, 24 fps; the clips idle, happy, sad, sleep, pet, feed
and wave) played by `cottage/SpriteElf.tsx` on the sprite player's
UI-thread frame clock, with the puppet's procedural motion (the bob, the
squash, the tilt of the reactions) layered on top as a transform of the
frame, so a pet or a feed still moves the whole figure the way it did.
The egg stays the vector `EggNest`, drawn over the rendered rug. What is
baked into the body frames today: the face (neutral, with blinks in the
idle clip) and the hood. What comes next: the face and the hat as layers
of their own on the same frame grid (then the wardrobe returns), the egg,
the four forms, and more furniture variants; until the sprites cover
everything the vector cottage remains in the tree as the fallback, which
is also what the scene draws when the character is not registered.

Both modes share the room's geometry and the motion. The room is designed
in room units (`ROOM` in `cottage/room.ts`: 1000 wide, 1600 tall, the
floor line at 1150, the elf's feet at 500 by 1240) and `fitRoom` scales
it to cover the view, centred, so a narrow phone crops a little of each
side; everything that matters stays within the middle band the HUD leaves
free. Depth runs wall and window, floor and rug, the items behind the elf,
the elf (or the egg in its nest), the items in front, the particles, then
the light overlays. The puppet's motion (`cottage/motion.ts`: breath,
bob, squash, tilt, blink, look and lookY, the head's own tilt, the ears,
the hood's swing, the arms, the lids, mouth, glow, a fidget scheduler and
a small particle pool) lives in Reanimated shared values that Skia reads
directly, so loops and reactions run on the UI thread, paths are built
once and only transforms, opacities and a few control values animate (the
sprite reads the body values, the vector puppet all of them); reduced
motion collapses the loops to a still pose and the reactions to a plain
fade.

Deliberately left out: sounds, and haptics (the product rule stands: the
app vibrates only for a plaque code and a reward, never in the elf's tab).
The rules stay in the app until the flow is designed (how the egg is found,
what a cottage visit gives it, whether it reaches the account); then they
move to `@chatynkowo/core` next to the progress rules, as every other
domain rule did.

The first prototype's remains, unused by the tab and kept until the owner
removes them: the 3D scene (`src/features/elf/scene`, `expo-gl`, `three`,
`@react-three/fiber`; its tuning constants in `scene/model.ts`, its frame
meter in `scene/FpsMeter.tsx`), the catch in the camera view
(`src/features/elf/catch`, `app/elf-catch.tsx`, `expo-sensors`), the
model `assets/elf/elf.glb` (the character from "Animated Elf & Venus
Flytrap on Floating Island" by LasquetiSpice on Sketchfab, CC BY 4.0,
transcoded by `scripts/prepare-elf-model.mjs`; `assets/elf/README.md`
carries the attribution) and the `.glb` asset extension with the `three`
alias in `metro.config.js`. Nothing in the tab reaches them any more.
