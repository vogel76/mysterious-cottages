# Chatynkowo mobile app

The expedition loop of the site as a native app, offline-first: the Atlas
(map of cottages), plaque-code entry (four digits or a QR scan), the story
with its recording, the Kronika (rewards), the leaderboard and a profile,
plus a sheet to support Chatynkowo with a coffee for the elf (a store
purchase) or a rewarded ad (see "Supporting Chatynkowo" at the end) and
the elf companion prototype as a tab of its own (see "The elf companion"
at the end). Expo SDK 57, TypeScript, expo-router, a development client
(native modules are used, so Expo Go cannot run it).

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
adb shell pm clear com.blockchainwares.app.mysterious.cottages   # the content cache keeps files for up to a day
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

### A demo build, for walking the elf through in a sitting

A build with `EXPO_PUBLIC_ELF_DEMO=1` in `apps/mobile/.env` is "Chatynkowo
DEMO", installed beside the real app under the package with `.demo`
appended (`app.config.ts`), so it starts with a fresh egg and never
touches the real app's data. Its elf keeps a clock seventy-two times
faster than the wall clock (`src/lib/elf-clock.ts`: a day in twenty
minutes, an hour in fifty seconds), so the egg hatches, the care's
charges come back, the peddler changes his wares, the letters arrive,
the streak grows and the levels with their forms come within a
presentation; the night no
longer puts the elf to sleep on its own (it sleeps when tucked in, at any
hour; `configureElfNight` in the rules), and no reminder is scheduled.
Give it Google's sample rewarded unit as well, so the dust shop's ad
works without an AdMob account:

```bash
cd apps/mobile
printf 'EXPO_PUBLIC_ELF_DEMO=1\nEXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID=ca-app-pub-3940256099942544/5224354917\n' > .env
npx expo prebuild --clean --platform android      # the demo package into the native project
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a && cd ..
adb install app/build/outputs/apk/release/app-release.apk
# then put .env back and regenerate the native project for the real package:
npx expo prebuild --clean --platform android
```

Never ship it: the fast timestamps it stores make no sense to the real
app, which is why it lives under its own package.

### Store builds (EAS Build)

The release variant above is signed with the generated project's debug
keystore, which Google Play does not accept: a store build is a signed
app bundle (AAB) built with EAS Build, on this machine (`--local`, no
queue, nothing uploaded) or in Expo's cloud. `eas.json` holds the
profiles and `.easignore` at the repository root keeps the site, the
backend notes, the authored content and the private plaque codes out of
a cloud upload (EAS uploads the whole monorepo otherwise; the app reads
content from the published site, so it needs none of it). The CLI runs
through `pnpm dlx` at a pinned version, so nothing is installed
globally.

The upload keystore is the one registered with Google Play for
`com.blockchainwares.app.mysterious.cottages` (Setup, App signing,
"Upload key certificate"; its SHA-1 begins with `DD:F2:E9`). The
production profile takes it from a local `credentials.json`
(`credentialsSource: local`; the file is ignored by git and points at
the keystore kept outside the repository, with its passwords), so a
store build never depends on the keystore EAS generated for itself:

```json
{ "android": { "keystore": { "keystorePath": "/home/<you>/keys/chatynkowo/upload.jks",
  "keystorePassword": "...", "keyAlias": "...", "keyPassword": "..." } } }
```

A bundle signed with any other key is refused by the Play Console. The
keystore and its passwords are backed up outside the repository (the
backup downloaded from expo.dev, under the project's credentials, is the
same file); losing them means an upload key reset request in the Play
Console.

```bash
cd apps/mobile
pnpm eas login                  # once per machine, the Expo account that owns the project
pnpm eas init                   # once per project: writes extra.eas.projectId into app.json (commit it)
pnpm build:android:local        # production: AAB built here, signed with credentials.json (the usual way)
pnpm build:android              # the same in Expo's cloud (queued on the free plan)
pnpm build:android:preview      # an installable APK of the same code, for a phone without the store
pnpm submit:android             # the latest AAB to the Play internal testing track as a draft release
                                # (needs a Google service account JSON, see below; uploading by hand works too)
```

The `EXPO_PUBLIC_*` variables are inlined into the JS bundle at build time
and `.env` never reaches EAS (`.easignore`), so a store build takes them
from the project's EAS environment variables, one set per profile
environment (`production`, `preview`, `development`): the Google web
client id for sign-in and the AdMob ids for the rewarded ad.

```bash
pnpm eas env:set --scope project --environment production --visibility plaintext --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value <id>
pnpm eas env:set --scope project --environment production --visibility plaintext --name EXPO_PUBLIC_ADMOB_ANDROID_APP_ID --value <id>
pnpm eas env:set --scope project --environment production --visibility plaintext --name EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID --value <id>
pnpm eas env:list --environment production
```

A build without the AdMob variables still works: the support sheet says
this version shows no ads. `pnpm eas credentials --platform android`
shows the upload key's SHA-1, which the Google sign-in client needs next
to the SHA-1 of Play's app signing key (supabase/README.md, "Sign-in
providers"). `eas submit` needs a Google Play service account with
access to the app; its JSON key is referenced from `eas.json` as
`serviceAccountKeyPath` or kept in the EAS environment as
`GOOGLE_SERVICE_ACCOUNT_KEY`, never committed.

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
out unless a future native module needs it.

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
                         the elf, when the build has it; the photo, the notes and the two ways to begin), first launch only
  (tabs)/_layout.tsx     the tab bar (src/ui/TabBar.tsx): Atlas / Elf on the left, Kronika / Profile on the right of a
                         raised gold centre button that opens the code sheet (long press: the scanner); the button
                         would stay centred with an odd number of tabs too (each half of the bar shares its width
                         among its tabs)
  (tabs)/index.tsx       the Atlas: the full-bleed map with floating chrome, the quest card, the seeker's position
                         and the parchment cottage sheet (a gesture sheet with three snaps)
  (tabs)/kronika/        its own native stack: the collection grid with the progress card and the Ranking's card,
                         and ranking.tsx pushed on top: the leaderboard list, the rules and share header items (the
                         stack is anchored at the collection, so a link from the account screen still has a back)
  (tabs)/elf/            its own native stack (_layout.tsx, no bar on the screen) and one screen (index.tsx): the elf
                         companion prototype, the full-screen cottage drawn in Skia with the HUD floating over it
  (tabs)/profile/        its own native stack: grouped settings (account, language, preferences, lore, legal, social)
                         with the support invitation, account.tsx (the signed-in account: identity, leaderboard entry,
                         finds, preferences, sign-out, deletion), preferences.tsx (the consent to ads: its state and
                         the form reopened, to change or withdraw it), about.tsx (the lore sections) and guide.tsx
                         (the onboarding pager replayed)
  code.tsx               the code entry as a sheet (auto-submits at the fourth digit)
  scan.tsx               the QR scanner, full screen under a transparent bar with torch and close items
  cottages.tsx           every cottage, found first, with a search box and an undiscovered-only filter: one page
                         sheet from the Atlas's search control (keyboard up) and the Kronika's progress card
  story/[slug].tsx       the story as a page sheet: the unlock ceremony the first time, a plain revisit later
  celebrate.tsx          the reward reveal, a transparent modal the Atlas presents after a story
  reward/[id].tsx        one reward card, a sheet that opens at three fifths and can be pulled to the top
  rules.tsx              the ranking rules, a sheet sized to its content
  support.tsx            supporting Chatynkowo, a sheet opened by the support invitations: a coffee for the elf (a purchase
                         through the store) or a rewarded ad watched instead
  nickname.tsx           the nickname editor, a sheet from the account screen and the Ranking's "Change nickname" item
  elf-hatch.tsx          the hatch sheet, where the elf that has just hatched is named and given its element
  elf-evolve.tsx         the evolution card, a transparent modal the Elf tab presents when a later form is reached
  elf-today.tsx          the elf's day: the quests with their progress, the reward to pick, the way to the keepsake
                         shelf, the streak and what the ledger's figures mean, a sheet opened from the Elf tab's ledger
  elf-away.tsx           the 'while you were away' card: what an absence brought (the finds, a letter, the plant grown),
                         a sheet the Elf tab presents on the first visit back
  elf-letter.tsx         a letter from the elves of the cottages, by its number (`n`), from the envelope in the room,
                         the away card or the shelf
  elf-shop.tsx           the shop of star dust: the balance, a rewarded ad for dust (up to a daily cap), the store's
                         dust packs and the skips of the waiting (the hatch, a care's charges, the next form) for
                         dust or an ad, a sheet from the shop button on the elf's bar and the egg's chip
  elf-tree.tsx           the elf's tree of development: the level with its rank, the experience bar, the points and
                         a trunk, three branches that fork and merge, three archetypes; a sheet from the name block on the elf's bar
  elf-shelf.tsx          the keepsake shelf: the jars of the cottages found, the windowsill's treasures and the letters
  elf-activities.tsx     the activities hub: what there is to do with the elf from the couch (the tricks; the games,
                         the peddler and the badges join as they come), a sheet from the activities button on the elf's bar
  elf-tricks.tsx         the elf's tricks: bought for acorns, practised once a day until learned, shown on demand; a sheet
                         from the activities hub
  elf-game/[id].tsx      a game from the couch (catch the acorns, memory), a page sheet from the activities hub: a few
                         rounds a day, a round paying acorns by its points and experience
  elf-peddler.tsx        the travelling peddler: three wares a day for acorns, each once (a care's charges back, a round
                         more in the games, a grain of dust, a trick under its price); a sheet from the activities hub
  elf-badges.tsx         the badges: fifteen things done often enough, each with a bar and a reward to take; a sheet
                         from the activities hub
  +native-intent.tsx     where a URL handed to the app goes (plaque links with a code, story and reward links)
  +not-found.tsx         redirects to the Atlas
src/
  config.ts              EXPO_PUBLIC_* with production defaults (including the account preview flag and the elf's
                         flag, EXPO_PUBLIC_ELF_ENABLED, "0" leaving the elf out of a build; the demo flag, EXPO_PUBLIC_ELF_DEMO, see "A demo build"), storage keys
  i18n/                  the i18next instance: "translation" + "mobile" namespaces, device locale, remembered choice
  ui/                    the interface layer: tokens, fonts, icons (plus the tab glyphs and the native header symbols), motion
                         tokens, Text, Button/LinkButton/IconButton on PressableScale, Screen, ContentImage (expo-image),
                         Skeleton, ProgressRing, CrossfadeText, PageDots, GlowPulse, EmptyState, Toast,
                         SettingsList, Sheet (the base of every sheet route), TabStack, headerItems, TextField, MarkdownView
  lib/                   adapters: bootstrap (what the splash reads), cached content client, progress + sync-queue
                         storage, Supabase and native sign-in, the account preview stand-in (development builds only),
                         audio (expo-audio: the story player and the app's audio session), recordings (file system), maps hand-off, position, reachability store,
                         store billing (the coffee), the support ledger, the ads SDK with Google's consent (ads.ts),
                         the elf's local notifications (notifications.ts) and their device store (reminders-store.ts),
                         the switch of the elf's sounds (sounds-store.ts), haptics, accessibility announcements
  providers/             BootProvider, NetworkProvider, SessionProvider, ContentProvider, ProgressProvider, ToastProvider,
                         SupportProvider (the store connection, the coffee menu and the dust packs, the receipt of support),
                         ElfProvider (the companion's state), useCloseModal (the one way a modal route closes)
  features/              screen-level components per area: atlas/, code/, cottages/ (the directory both tabs open), story/, kronika/, ranking/, profile/, welcome/
  features/profile/      the settings list, the account screen (the identity header, the leaderboard entry with the
                         photo switch, the finds, sign-out and the delete-account confirm) and the nickname editor
  features/support/      supporting Chatynkowo: the sheet, the coffee menu and the dust packs with the store product
                         ids (tips.ts), the rewarded ad (useRewardedSupportAd.ts, the elf's shop uses it too), the
                         ledger hook, and the invitation card (SupportCard.tsx) the other screens mount
  features/preferences/  the preferences screen: the switches of the elf's reminders (RemindersSection.tsx) and sounds
                         (SoundsSection.tsx), where the
                         consent to ads stands and the row that opens Google's form again (the privacy options in the
                         EEA), with the consent hook on top of src/lib/ads.ts
  features/elf/          the companion prototype, on the rules in packages/core (elf.ts: the needs, the day's quests,
                         the purse and the streak, the cottages found credited and celebrated, the furniture the finds
                         unlock, the stored outfit and decor, what an absence brings: the sill's finds, the letters,
                         the plant), cottage/ (the full-screen Skia room:
                         room.ts with the room units and the slots,
                         catalogue.ts with the slot, decor and wardrobe ids, roomAssets.ts (the room manifest, which
                         variants are rendered, the days' pieces) and RoomSprites.tsx drawing the plate, the furniture
                         crops and what the days bring,
                         SpriteElf.tsx (the elf's atlases on the figure's motion), SleepingElf.tsx (the elf in its bed),
                         fire.ts with the hearth's flicker,
                         Lighting with the glow and the night tint over the plate, clock.ts with the day phase, motion,
                         RenderedEgg (the egg in its nest and its hatch), Particles, SlotHighlight for the decorating
                         mode, roomFiles.ts generated by the
                         room's packer), the screen components (ElfTab, ElfHud, ElfActionBar with drag-to-feed and
                         the need rings, ElfDecorPanel and ElfThumb for the decorating catalogue, ElfShopSheet (the shop of star dust), ElfTreeSheet (the tree of development),
                         useReturnGreeting, useElfReminders (the reminders planned when the app leaves), useElfSounds (the
                         elf's sounds while the tab is in view), ElfCard (the
                         tutorial's and the reminders question's card), useElfCardPresenter with the hatch sheet, the
                         evolution card and the away
                         card, the letter sheet with letters.ts, the keepsake shelf); sprites/ plays the atlases the art
                         pipeline packs (manifest and the four forms' registries, <form>Files.ts generated by the
                         packer, the decoded sheets, a UI-thread frame clock,
                         SpritePlayer and LayeredSprite on Skia's Atlas)
tools/                   the measuring tools, system Python and adb (see "Measuring the elf"): ui.py drives the app by the
                         words on screen, memtable.py samples the app's memory, sftable.py reads the frames the cottage presents
art/                     the Blender art pipeline (art/README.md): common.py with the shared scene, camera, light
                         and materials, elf.py (the character, its rig and clips) and room.py (the room plate and
                         the furniture), pack.py (frames to WebP atlases and a manifest), the contact sheets;
                         renders go to art/out, only the packed result is committed under assets/elf
assets/elf/              room/ (manifest.json, plate_<wall>_<floor>.webp and its _day twin: the empty room at the
                         room units, 1000 by 1300, for every wall and floor, by night and by day; one transparent
                         crop per piece with its _day twin at its place in the plate; the catalogue's close-ups
                         as _thumb), sprites/<character>/
                         (the packed atlases and manifests the sprite player draws; elf/ today)
metro.config.js          the monorepo watch and resolve settings
app.config.ts            the configuration that depends on the environment: the AdMob app ids of the support sheet's rewarded
                         plugin, unless EXPO_PUBLIC_APPLE_SIGN_IN is 0), the Google sign-in plugin with the iOS URL scheme
                         derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, the app's Apple team (signing, and the Sign in
                         with Apple key the backend script reads from here)
plugins/                 config plugins: with-scene-delegate.js (UIScene life cycle for the iOS 27 SDK),
                         with-locale-filters.js (only the app's languages in the Android resources),
                         with-gradle-heap.js (the Gradle daemon's heap, which R8 needs for a release build)
locales/                 native permission strings per language (iOS Info.plist)
assets/                  app icon, adaptive icon layers, the splash emblem and the logo, generated from the brand logo in
                         packages/content/private/img
```

Navigation model: the tab bar holds destinations only (the Atlas, the
elf, the collection with the leaderboard on its stack, the profile); entering a code is an action and
lives in a sheet reachable from the tab bar's centre button, the cottage sheet, the
onboarding, the empty states and plaque links, so every `/code` href still
works. A discovery runs in place (the sheet or the scanner shows the
outcome), the story replaces that screen, and the Atlas presents the reward
reveal once the story has closed. Supporting Chatynkowo is an action too,
a sheet (`/support`) opened by the invitation card wherever it is mounted
(see "Supporting Chatynkowo"); so is changing the nickname, a sheet
(`/nickname`) opened from the account screen and from the Ranking. The
Elf tab follows the same split: the tab is the destination, the evolution
card (`/elf-evolve`) is a modal over it. Motion goes through the tokens in
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
- **Account screen** (`app/(tabs)/profile/account.tsx`, `app/nickname.tsx`,
  `src/features/profile`): the signed-in seeker's own page, pushed from the
  Profile tab. An identity header shows the provider's picture, the
  nickname and the e-mail of the Google or Apple account signed in with;
  the leaderboard entry section shows the nickname with a row that opens
  the nickname editor as a sheet (the same sheet the Ranking's "Change
  nickname" item opens) and a switch for showing the account photo next to
  it; a finds section says how many discoveries the account holds; then
  sign-out, and at the end "Delete account" behind a confirm. Deleting
  calls `deleteAccount` in `src/lib/sync.ts` (the api's `deleteAccount`:
  the backend's `delete-account` Edge Function removes the finds, the
  profile and the auth user, then the local session is forgotten; see
  `supabase/README.md`, "Deleting an account"); the Kronika on the device
  stays, like after a sign-out. A refusal is a toast and the session is
  kept for another try.
- **Account preview** (`src/lib/account-preview.ts`): with
  `EXPO_PUBLIC_ACCOUNT_PREVIEW=1` in `apps/mobile/.env` a development
  build behaves as if a Google account were signed in, so the account
  screen, the nickname sheet and the signed-in Ranking can be looked at on
  an emulator that has no Google sign-in configured. `sync.ts` answers
  every account call from a stand-in account (sign-in, profile, nickname
  changes, sign-out, deletion) and nothing reaches the backend; the finds
  stay on the device. The flag is read under `__DEV__` only, so a release
  build cannot carry it. The variable is inlined by Metro: after setting it
  restart the dev server (`npx expo start --dev-client --clear`) and reload
  the app; no native rebuild is needed.

- **Support** (`SupportProvider`, `src/lib/billing.ts`,
  `src/features/support`, `src/lib/support-store.ts`): the two voluntary
  ways to support Chatynkowo, a coffee for the elf (a consumable product
  bought through the store) and a rewarded ad, neither of which unlocks
  anything (see "Supporting Chatynkowo" below). The store connection
  opens with the app and stays, so a purchase settled outside the sheet
  is still finished and thanked for. The ledger of what was given lives in
  AsyncStorage under `STORAGE_KEYS.support`, on the device only; the
  invitation card reads it to turn into a thank-you after the first
  support. The same connection sells the elf's star dust packs (the
  product ids in `DUST_PACKS`, `tips.ts`): a pack paid goes into the
  elf's wallet through `ElfProvider`, with a toast, and is not support.
- **Elf companion** (`ElfProvider`, on the rules in `packages/core`,
  `elf.ts`): the egg or the elf lives in AsyncStorage under
  `STORAGE_KEYS.elf`, read when the provider mounts (not in the bootstrap:
  the elf is not on the first screen) and brought up to date with the time
  away. In the foreground a tick every five seconds applies the needs'
  drift, hatches the egg when its time has come and puts the elf to sleep
  or wakes it by the clock; the state is saved after every action, every
  ten seconds while it only drifts, and when the app leaves the
  foreground. A form reached (by the hatch, the cottages found or time)
  waits in `pendingEvolution` until the Elf tab has shown its card. What
  the day's rules said about an action or a visit (a new day, a quest
  done and its pay, the full set, a streak milestone, a streak lost, a
  cottage found to cheer about) is published as `news`, one record the
  tab turns into the elf's lines
  in its bubble; the day is settled on every path (the tick, the visit,
  each action) so its news is never lost, and the tab calls `visit()`
  when it comes into view. Nothing reaches the account yet.

## Native pieces

| Area | Library | Notes |
|---|---|---|
| Map | `@maplibre/maplibre-react-native` | the site's fairy-tale map: OpenStreetMap tiles washed into parchment that turn real as the seeker zooms in, teardrop pins gathered into clusters (`supercluster`), the search area around the chosen cottage, the level indicator, reset and search controls, the parchment cottage panel, a beacon at the edge of the map towards the nearest cottage with its distance when none is in view (the map keeps north up: no rotation); the same per-country opening frame as the site (`homeCountry` / `homeBounds` in core `geo.ts`); "Navigate" opens the system maps app |
| Position | `expo-location` | foreground permission asked from the locate control; once granted the Atlas watches the position while it is focused (balanced accuracy, 20 m) and shows it as a dot under the pins; the launch's first fix frames the seeker with the nearest cottage (unless they moved the map or framed a cottage already), the control centres the map; a one-time grant that lapsed while the app was away is asked for again by the Atlas, once per launch, once the seeker has located themselves before |
| Splash | `expo-splash-screen` | the brand logo on the page colour until the fonts and the bootstrap (language, progress, cached content, flags; capped at 1500 ms) are in, then a 300 ms fade into a fully formed first frame |
| Story audio | `expo-audio` | background playback (`UIBackgroundModes: audio` via its plugin) and lock-screen / notification controls (`setActiveForLockScreen`); a language without a recording falls back to the Polish original when the file fails to load |
| The elf's sounds | `expo-audio` | short CC0 sounds for what happens to the elf and the fire's crackle under the room (`src/features/elf/useElfSounds.ts`, the files and their authors in `assets/elf/sounds/CREDITS.md`), only while the Elf tab is in view and the preferences' switch is on; the app's audio session is the story's or the effects' one, whichever played last (`enterAudioSession` in `src/lib/audio.ts`): the effects mix with whatever else plays, never take the audio focus, and keep quiet while the phone is on silent or vibrate (expo-audio's `playsInSilentMode: false` reads the ringer mode on Android) |
| Recordings offline | `expo-file-system` | "Save on this device" downloads the mp3 into the document directory, one folder per language; a saved file plays from disk |
| QR | `expo-camera` | `CameraView` scanning `qr` only, torch from the header; the code is resolved on the scanner itself through the same `useCodeEntry` as manual entry |
| Cottage scene | `@shopify/react-native-skia` | the elf's cottage (`src/features/elf/cottage`): one full-screen `Canvas` whose transforms, opacities and control values are Reanimated shared values, so every loop and reaction runs on the UI thread with no React state per frame; the room is the Blender plate as an `Image`, the furniture its rendered crops and the elf an `Atlas` node fed one cell per frame from the packed sheets (`src/features/elf/sprites`); the room is designed in room units (1000 by 1300, the plate's pixels) and scaled to cover the band between the tab's top strip and its bottom band; the canvas is `opaque` (the room covers it anyway), which backs it with a SurfaceView on Android, the cheapest path and the only one that draws on the emulator |
| Tabs and stacks | `react-native-screens` through expo-router | a custom tab bar (`Tabs` from expo-router/js-tabs with the `tabBar` prop; it reports its height through `useTabBarHeight` so screens keep clear of it), native stack headers (transparent with the system glass on iOS), `transparentModal` routes carrying the shared sheet (src/ui/Sheet.tsx) for the code, reward and rules, `modal` page sheets for the story and the cottage list |
| Sheets | `@gorhom/bottom-sheet` | one base for every sheet: the in-screen parchment panel over the map (three snaps, the map stays pannable, the camera keeps room for it) and the sheet routes (the code gate, a reward, the rules), which open at their own height or part-way and can be pulled to the top; a scroll inside moves the content first; a sheet route can pin a footer under its scroll (the tree's node card), kept in view whatever is tapped above |
| Motion | `react-native-reanimated` 4 + `react-native-gesture-handler` | springs, entrances, the progress ring, the scrub bar, the toast gesture; every animation passes `ReduceMotion.System` |
| Reminders | `expo-notifications` | local notifications only (no push token, no server): the elf's reminders scheduled on the device when the app goes to the background and dropped when it comes back (`src/lib/notifications.ts`, `src/features/elf/useElfReminders.ts`); one Android channel of the default importance, so the phone's settings decide the sound and the vibration; the small icon is `assets/notification-icon.png` (the monochrome app icon as a white silhouette), tinted with the gold accent; `POST_NOTIFICATIONS` comes with the library and is asked for only after the player says yes to the elf |
| Haptics | `expo-haptics` | one module (`src/lib/haptics.ts`) and only three moments: medium on the seal of a fresh find, success on an accepted code and a revealed reward, error on a refused code; no control, tab, pager or toast vibrates; iOS uses the UIKit generators, Android the system `HapticFeedbackConstants` through `performAndroidHapticsAsync` (the OEM's short click, under the system touch-feedback setting and intensity), with the Vibrator notification patterns kept only for success and error below API 30 |
| Images | `expo-image` | `ContentImage`: memory and disk cache, cross-dissolve, retries with a backoff and on reconnect, a quiet fallback after the last failure, prefetch of the reward art and the found cottages' photos |
| Legal pages | `expo-web-browser` | the terms and privacy pages open in an in-app browser sheet |
| Store billing | `expo-iap` | the coffee for the elf and the elf's star dust packs as consumable products through Google Play Billing and StoreKit 2 (`src/lib/billing.ts`, driven by `SupportProvider`): listeners registered before the connection opens and kept for the life of the app, every paid purchase finished at once (consumed on Android), the leftovers settled at launch and on every return to the foreground, pending purchases (cash, Ask to Buy) reported and left alone until paid; prices come from the store's product records, the app carries only the product ids (`src/features/support/tips.ts`) |
| Ads | `react-native-google-mobile-ads` | one rewarded ad, only in the support sheet and the elf's shop and only when asked for (`src/features/support/useRewardedSupportAd.ts`); Google's consent flow (UMP) runs before the first request and decides between personalised and non-personalised requests, the SDK initialises after it (`delayAppMeasurementInit`); the AdMob app ids reach the native manifests through the plugin in `app.config.ts`, the rewarded units come from `EXPO_PUBLIC_ADMOB_REWARDED_*_UNIT_ID`, and without one a development build shows Google's test ad while a release build offers no ad |
| Fonts | `expo-font` + `@expo-google-fonts/*` | Cormorant Garamond and Cinzel Decorative, imported per weight; the repository's woff2 files cannot be used natively |
| Locale | `expo-localization` | the device language picks the dictionary and, through `detectCountry`, the map's home country (never geolocation) |
| Country names | `@formatjs/intl-displaynames` | Hermes has no `Intl.DisplayNames`; the polyfill with Polish and English data names a cottage's country in the map panel, as the site does |
| Plural forms | `@formatjs/intl-pluralrules` | Hermes has no `Intl.PluralRules`; the polyfill with Polish and English data lets i18next pick the Polish forms for two to four ("4 odkrycia", "2 Chatynki") instead of the many form |
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

TODO universal links: the plaque QR carries `https://www.chatynkowo.pl/?kod=NNNN`. The Android half is in place (`android.intentFilters` for `https://www.chatynkowo.pl/`, `/index.html` and `https://chatynkowo.pl/` with `autoVerify`; it stays a plain browser choice until the site serves `/.well-known/assetlinks.json` with `delegate_permission/common.handle_all_urls` for `com.blockchainwares.app.mysterious.cottages` and the release signing SHA-256). The iOS half is not: add `ios.associatedDomains: ["applinks:www.chatynkowo.pl", "applinks:chatynkowo.pl"]` to `app.json` only once the site serves `/.well-known/apple-app-site-association` (applinks for `<TEAMID>.com.blockchainwares.app.mysterious.cottages` with components for `/` and `/index.html` carrying a `kod` or `code` query, so `ranking.html` share links keep opening the website), because the Associated Domains capability changes device code signing. `app/+native-intent.tsx` already maps both URL forms to the code sheet.

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

## Supporting Chatynkowo

The app is free and stays free; the support sheet (`app/support.tsx`,
`src/features/support/`) offers two voluntary ways to help, side by side
and equal, and says plainly that neither unlocks anything:

- **A coffee for the elf.** A consumable in-app product per size (the
  product ids in `TIP_MENU`, `tips.ts`: `coffee_small`, `coffee_regular`,
  `coffee_large`, `coffee_pot`), bought through the store the app came
  from, so the payment never leaves the app and the stores' billing rules
  are met on both platforms. The sheet shows the names from the dictionary
  with the prices the store reports, in the player's currency; the store's
  own payment sheet takes the payment. `src/lib/billing.ts` is the only
  module that talks to the store (expo-iap over Play Billing and StoreKit
  2) and `SupportProvider` drives it from the app's start: the purchase
  listeners are in place before the connection opens and stay for the
  life of the app; a purchase the store reports as paid is finished at
  once (consumed on Android, finished on iOS) and only then counted;
  purchases left unfinished by a crash are settled at launch and on
  every return to the foreground (Google refunds a purchase not
  acknowledged within three days, Apple keeps re-sending an unfinished
  one); a pending purchase (a cash payment, Ask to Buy) is reported in the
  sheet and left alone until the store says it is paid; a cancelled
  payment is silent, a failed one is reported with nothing charged. There
  is no receipt verification on a server: a coffee grants nothing, so
  there is no entitlement to protect; should one ever be attached to it,
  the purchase goes through an Edge Function (Google Play Developer API,
  App Store Server API) before it is finished. A device without a working
  store (an emulator without Play, a build whose products are not yet
  published) shows the coffee as unavailable.
- **A rewarded ad.** The only ad in the app, shown only here and only when
  the player asks (`useRewardedSupportAd.ts`): the consent flow first
  (`src/lib/ads.ts`: Google's User Messaging Platform; in the EEA the
  message configured in the AdMob account, once), then the SDK, then one
  ad loaded and shown; the ad network's word that it was watched to the
  end is the support. A consent flow that fails (no message configured
  yet, no network) falls back to non-personalised requests; consent
  required and not given means no ad. The sheet reports where a request
  stands (looking, no ad right now, offline, interrupted, refused). The
  consent is never buried: the preferences screen (Profile, Preferences,
  also on the account screen) shows where it stands and reopens Google's
  form, the privacy options in the EEA, so it can be changed or withdrawn
  as easily as it was given, which Google requires of apps in the EEA and
  the GDPR requires of any consent. A development build tells the SDK to
  treat the device as in the EEA, so the form can be tried on an emulator
  (the SDK does that only for test devices, which an emulator is).

Either way the receipt is the provider's and the same: the ledger on the
device counts it (`src/lib/support-store.ts`, shown in the sheet as "your
support so far"), a toast says thanks and the sheet closes. No haptic: the
phone stirs only for a discovery (`src/lib/haptics.ts`).

The elf's star dust packs (`dust_small`, `dust_regular`, `dust_large` in
`DUST_PACKS`, `tips.ts`) go through the same connection and the same
rules of finishing, but they are a purchase of dust, not support: a pack
paid is credited to the elf's wallet (`ElfProvider.addDust`) with a toast
saying how much, the ledger does not count it, and the elf's shop
(`/elf-shop`) is where they are sold. The rewarded ad there is the same
unit and hook as here; its reward is dust or a skip, up to a daily cap of ads, not support.

The sheet is never pushed on anyone; it is opened by the support
invitations, one component (`src/features/support/SupportCard.tsx`)
mounted where a player has just received something: a card at the end of
every tale, under the story; a card under the collection in the Kronika; a
line on the celebration card after a reward; and a card in the profile,
right under the account block. Each says in its own words that Chatynkowo
is free and that a coffee or a moment for an ad is a choice, not a
condition, and opens `/support`. Once the device's ledger records the
first support, every card turns into a thank-you that still opens the
sheet and the celebration's line disappears, so a player who has given is
not asked again, only reminded where the sheet is.

### Setting the stores up

The code is complete; what remains is configuration in the consoles, none
of it in the repository:

1. **Google Play Console**, the app `com.blockchainwares.app.mysterious.cottages` (it must exist,
   with a signed build uploaded to at least an internal testing track;
   Play Billing refuses an app it does not know): under Monetize, In-app
   products, create the four coffees and the three dust packs with exactly
   the ids above, type one-time (consumable is the app's choice at
   purchase time), a name, a description and a price each (the sheet
   suggests small, regular, large and a pot: for instance 4.99, 9.99,
   19.99 and 49.99 PLN; the packs of 60, 150 and 400 dust for instance
   4.99, 9.99 and 19.99 PLN), then activate them. An id not created yet
   comes back from Play Billing 8 as an entry with the status "not-found"
   and no price; `billing.ts` drops it, so the sheet shows that product
   as unavailable rather than without a price. To test without being charged, add the testers' Google
   accounts under Setup, License testing, and install the build from the
   testing track or sign the local build with the upload key.
2. **App Store Connect**, the app with the bundle id `com.blockchainwares.app.mysterious.cottages`:
   under In-App Purchases, create the seven products as Consumable with
   the same product ids, a reference name, a price tier each and the
   localized display names; submit them with the first build that offers
   them (the review needs a screenshot of the sheet). The In-App Purchase
   capability is on the App ID automatically once products exist. To test
   on a device, create a Sandbox tester under Users and Access and sign
   in to it in Settings, App Store; in Xcode a StoreKit configuration file
   with the same ids lets the simulator sell them.
3. **AdMob**: an app per platform with the ids put into `.env`
   (`EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_IOS_APP_ID`,
   followed by a native rebuild), one rewarded ad unit per platform in
   `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID` /
   `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID`, and a GDPR message under
   Privacy & messaging, which the consent form shows in the EEA. The app
   asks for no App Tracking Transparency permission on iOS (the plugin
   gets no `userTrackingUsageDescription`), so iOS serves ads without the
   advertising identifier. If the iOS build ever complains about the
   Google Mobile Ads pod and frameworks, the library's answer is
   `ios.useFrameworks: "static"` in the `expo-build-properties` plugin;
   the Android build needs nothing beyond the plugin.
4. **Store listings**: both stores ask that the app's privacy policy
   mentions the ads (AdMob) and the purchases; the Data safety form on
   Play and the App Privacy answers on the App Store list the advertising
   identifier and the purchase history accordingly.

## The elf companion (prototype)

A care loop like a virtual pet, in the spirit of Pou: an egg waits in the
nest from the first visit (nothing to fill in), the seeker keeps it warm
until it hatches, names the elf and picks its element in the hatch
sheet, then feeds, plays with and bathes a
small elf whose needs fall in real time, and watches it grow through four
forms. The elf lives in its cottage, and the cottage is the whole tab: a
painted room in Skia (`src/features/elf/cottage`) framed by two strips of
solid chrome and never under them: at the top `ElfHud.tsx` (the name
with the level in a gold pill and a thin bar of the experience under
them, the form or what the elf asks for as a line between, the
activities, shop and decorating buttons, and the ledger with the egg's
countdown before the hatch), at
the bottom `ElfActionBar.tsx` (the round care buttons on the tab bar,
split around its discover key so neither covers the other, each ringed
by the need it sees to, green while comfortable and gold when the elf
would like it seen to, with the dots of its charges under it), and
`ElfSpeech.tsx`: the speech bubble over the elf's head (over its bed
while it sleeps) for what it says, a refusal, a good night, a greeting,
a quest done; the elf acts them too:
a refused care is a shake of the head and a pat on the belly (the
`refuse` clip), the return greeting a bow (`greet`), or, with an
invitation from a cottage waiting unread on the floor, a beckon towards
the door (`beckon`), and the player's support (a coffee or an ad the
support ledger counts beyond what the elf has thanked for,
`supportThanked` in its state) a sip from its cup with a thank-you
(`sip`), once the tab is in view and the greeting is over. A form whose atlas lacks a clip (one packed before
the clip existed) keeps its idle instead: the scene checks the drawn
form's manifest before it plays a reaction. A tap on the elf pets it (within the pet
cooldown it is poked instead, so it always answers), a tap on the egg
rocks it. It touches nothing of the expedition flow: no cottage, code,
story or reward knows about it, but the cottages found reach the elf:
they pay the most experience, a find while the egg waits hatches it early (finds
from before the egg appeared stay the expedition's past: no early hatch,
no cheer), a find pays
the weekend's find quest (credited to the day of the find even when the
elf is visited later), and on the first visit of a later day the elf
cheers for it by the cottage's title (several at once by their count),
never on the find's own day, which belongs to the expedition. The frame
on the wall shows the latest cottage's photo (from the expedition's
picture cache, so offline too; a tap opens its story) unless the player
picked another picture, and the shelf in the room opens the keepsake
shelf (below). Every place of the room keeps
one choice besides its default free from the start, and the rest are
unlocked by the finds, one or two at a time from the first cottage to
the eighth (`DECOR_UNLOCKS` in the rules): a locked piece stays in the
decorating catalogue dimmed, with a lock and how many more cottages it
takes, and a tap on it lets the elf say so; what a player placed before
stays.
Starting the elf over lives in the Profile tab, not in the HUD. The day's quests, the purse
(acorns and star dust) and the streak are counted by the rules and stand
in the HUD's ledger with the quests done out of three, and a tap on it
opens the day's sheet (`/elf-today`): the quests with their progress and
pay, the reward to pick (three cards face down, one turned a day), the
streak with its next milestone, and what the figures are and earn; what
an action earned the elf says in its bubble.

Star dust is the premium currency, and the shop button beside the
decorating one (the egg's countdown chip too) opens its shop
(`/elf-shop`, `ElfShopSheet.tsx`): the balance, then the two ways to get
dust beyond the rules' streaks and quest sets, a rewarded ad (the
support sheet's unit, `DUST.ad` dust a time; every rewarded ad, for dust
or a skip, counts towards `DUST.adCap` a day in the state's `ads`;
`earnAdDust`, `recordAd` in the rules) and the store's packs
(`DUST_PACKS` in `tips.ts`, sold by `SupportProvider` beside the coffees
and credited on payment with `addDust`), then the skips of the waiting
the rules allow (`ElfSkip`, `applySkip`; the provider's `skip(kind,
pay)` takes the dust of `SKIP_COST` or counts the ad first): the egg
before its hour (`skipHatch` sets `hatchReadyAt`), a care's charges back
at once (`refillCare`), the next form before its level (`growNow`;
`nextForm` says the form ahead, the level it asks for and whether the
elf is there, in which case nothing is for sale: the elf grows for free
at the player's word). The two ways to pay stand under each other as
buttons of one width. Each row shows its countdown (`duration.ts` keeps
the clock and the words, shared with the egg's chip and the elf's line
when a care has no charge back) and a skip bought closes the sheet, so
the player sees the egg ready, the dots relit or the elf grow in the
room. The last card sells the furniture and hats the finds still lock
(`shopItems` in the rules: every entry of the unlock table the player has
neither reached, been granted by the tree nor bought), each with a
thumbnail from the decorating catalogue, the cottages it still needs and
its price, ten dust per cottage of its threshold and fifteen at least; a
purchase lands in `state.items`, which `grantedItems` counts with the
tree's grants, and a threshold reached makes a piece free anyway, so the
card empties as the trail goes on. The store's orders arrive at once;
nothing in the shop is needed to play.

The elf grows in a second way, by experience (`XP` in the rules): the
cottages found pay the most, then the day's quests, the full set and
each day a streak goes on. The levels start forty points apart and
widen (`xpForLevel`, `levelOf`), each one past the first gives a point,
the level stands in a gold pill on the elf's bar with a thin bar of the
experience under the name, and the rank by level (`rankOf`: Skrzat,
Leśnik, Strażnik, Mędrzec, Legenda) heads the tree, which the name block
opens (`/elf-tree`, `ElfTreeSheet.tsx`), drawn as one. The
shape is the rules' (`ELF_TREE`, a list of nodes with their row, branch,
side and parents): a trunk at the bottom carrying the level, the roots'
node on it that every elf takes first, a fork into three branches (the
belly, the smile, the eye), each branch forking again into a pair of
nodes that merge in a hearth, a fair or a camp, which the neighbouring
branches also reach by a shortcut (the feast leads to the fair as well
as the hearth, the games to the hearth, the party to the camp, the trail
to the fair), and over each merge an archetype: the glutton, the
prankster, the tracker, the one choice that closes the other two
(`archetypeOf`, the status `taken`). A node opens when any one of its
parents is owned (`nodeStatus`, `unlockNode`), for a point each, so the
first point is never a verdict: the branch choice comes second and can
be crossed later, and only the archetype, five points up at the
soonest, settles what the elf is. Every parent-child pair is a line that
lights once both ends are owned, so the route climbed shows; a node is
a circle with its own picture (thirteen icon roles plus the acorns',
the streak's and the bath's), filled when owned, outlined and breathing
while a point waits to be spent, dim with a lock while shut; a tap
picks it and the card under the tree says what it gives and offers the
unlock. The effects are read by the rules themselves: the roots' charges
back a quarter sooner; the belly's slower hunger and the smile's longer
joy; the eye's extra sill find on a return; the pantry's fourth meal
and the feast's bigger meals; the games' third game and the party's
bigger games; the trail's streak that forgives one missed day and the
luck's streak milestones paying double dust; the hearth's fullness
holding through sleep; the fair's quests paying half as much again; the
camp's second bath; and each archetype's piece free of the finds (the
cauldron, the hammock, the antlers: `grantedItems`, which also counts
the shop's purchases, read by `decorFindsNeeded` wherever the catalogue
is gated) with its title in the rank's place on the elf's bar.
Experience also comes from every care, a letter read and the tuck-in,
so a day of looking after the elf moves the bar without a find. The
ranking's use of the rank waits for the account sync.

The forms go by the level too (`FORM_LEVELS` in the rules: Elfik at
level 3, Elf at 6, Arcyelf at 10), and the elf never grows on its own:
once the level is reached the name block says the elf may grow and its
level pill wears a dot, a card over the care band offers it ("later"
puts it off until the tab is next looked at), the tree sheet has the
same line with its button, and `growUp` changes the stored `form`,
which the room's moment and the evolution card then show as any form
reached; one form at a time (neither grows while a form's card still
waits). The shop sells the form ahead of its level for dust or an ad
(`growNow`); nothing else about time or the cottages decides a form.

The activities button on the elf's bar (shown once the elf has hatched)
opens the hub (`/elf-activities`, `ElfActivitiesSheet.tsx`), one row
per thing to do from the couch, each with a word on where it stands and
its own sheet or screen. The tricks (`/elf-tricks`, `ElfTricksSheet.tsx`;
`ELF_TRICKS`, `buyTrick`, `trainTrick` in the rules) are the first: six
of them (the wave, the twirl, the bow, the cheer, the applause, the
toast), each bought for acorns, the soft currency's first sink, then
practised once a day by an awake elf for the sessions it needs (two to
four), a session paying experience, until learned, and a learned one
shown on demand. The purchase is followed at once by the first practice
(a sleeping elf keeps the trick for the morning, the toast says so), the
row in learning says how many practices are left or that today's is
done, the hub's row names the trick whose practice waits today, and
that practice lights the activities button's dot like the peddler's
basket (`tricksToTrain`). A practice or a show closes the sheet and hands the
trick to the tab (`trickPlay` in the provider), which plays it as one of
the elf's existing reactions (`tricks.ts` maps each to its clip: the
call's wave, the twirl, the greeting's bow, the cheer, the admiring
clap, the sip) with the elf's line in its bubble; a sleeping elf refuses
both. The acorns' price and the sessions are in the rules' table.

The games (`/elf-game/[id]`, `games/ElfGameScreen.tsx` around a board;
`gamePlaysLeft`, `recordGame` in the rules) are two: catch the acorns
(`AcornsGame.tsx`: twelve spots, an acorn popping on one every so often
and vanishing unless tapped, faster and shorter-lived until the
quickest pace a minute in, no clock: three hearts, one lost for every
acorn that gets away and every tap on an empty spot, a tap right after
an acorn went excepted, and the round ends with the last; a catch is a
point) and memory (`MemoryGame.tsx`: boards
that grow, four pairs of the elf's own pictures drawn from nine distinct
ones (the meal's acorn stays out, it is the acorns' picture too), then
six, eight and ten, two cards a move, a pair stays; each board allows
as many misses as it has pairs and two more, one too many ends the
round, the last pair opens the next board; a pair is a point and a
board cleared two more). Each game has three rounds a day; a round pays
its points in acorns at the game's rate (`GAME_POINTS_PER_ACORN`: two
catches an acorn, a memory point an acorn) up to twenty (half as much
again with the fair, like a quest), five experience, and counts for the day's
quest "Zagraj z elfem w grę"; the best points are kept as a record. The
screen's card after a round shows the pay and offers once more or the
way back, and the tab greets the result with the elf's cheer (a best or
fifteen acorns and more) or its admiring clap.

The travelling peddler (`/elf-peddler`, `ElfPeddlerSheet.tsx`;
`peddlerWares`, `buyWare` in the rules) comes every day with three
wares drawn from his basket by the day (the same on every device,
different from the day before): a treat, a toy or a soap (20, 25 and 30
acorns), which go to the pantry as gifts (`gifts` in the state): a gift
mark after the charges' dots under the care button, and the care given
with it whatever the charges and the belly, with a little joy on top and
the elf's word of thanks (`performCare` returns `gift`), so a bought
treat is eaten at once, the toast naming the button; a ticket, which
adds a round to each game for the day (15); a grain of dust (60); and
a trick, ten acorns under the tricks' price (one of the six, drawn by
the day like the rest: the draw never reads what the elf owns, so a
purchase cannot re-deal the basket, and a trick the elf already has
stands as bought). Each is bought once a day; the sheet marks
what was bought, the hub's row counts what is left in the basket, and
the activities button on the bar carries a dot while the basket holds
something unbought, the day's small reason to look in.

The badges (`/elf-badges`, `ElfBadgesSheet.tsx`; `ELF_BADGES`,
`badgeProgress`, `badgeStatus`, `claimBadge` in the rules) are fifteen
things done often enough: ten and a hundred meals, ten baths, fifty
pets, ten and fifty games, five letters read, a trick learned and all
six, ten purchases from the peddler, the fifth and the tenth level, a
week and a month of visits in a row, the archetype chosen. The rules
keep lifetime counts for the care, the pets, the letters, the tricks'
sessions, the games and the wares (`counts`), and read the rest from
where it is. Each badge has a reward, acorns for the near ones and a
grain or three of dust for the long ones, taken with a tap once the
badge is reached; the sheet shows every badge with its bar and reward,
the hub's row counts the rewards waiting, and the activities button's
dot also lights for them.

The elf reaches two places outside its tab: the onboarding pager (the
welcome of a fresh install and the profile's "How to play") carries a
page about it, and the Kronika's progress card says how many virtues
the elf has learned, the cottages it has taken in (`findsCelebrated`),
which is where the two loops meet. `EXPO_PUBLIC_ELF_ENABLED=0` leaves
the elf out of a build: the Elf tab leaves the bar and takes no link,
no reminder is scheduled, the pager has no elf page, the Kronika no
count and the profile no way to start the elf over; the elf's code and
state stay in the app untouched, so a later build with the flag unset
finds them.

The rules (`packages/core`, `elf.ts`: pure functions over an immutable
state with the moment injected, so a simulation can run a year in a
second) are paced in days, not minutes: an absence never punishes, it
only leaves the elf wanting, and the charges keep a visit short. They
carry the care loop, the day's quests, the purse and the streak, plus what
the player chose: the outfit and the decor as the slots they changed
(plain strings; the catalogues live in the cottage and the provider
resolves a stored id against them, so an id the catalogue no longer knows
falls back to the slot's default) and `lastInteraction`, recorded by
every care, pet, egg, sleep and swap:

| Rule | Values |
|---|---|
| Needs | fullness, joy, clean; each 0 to 100, never under the floor of 35 |
| Drift | each need eases towards the floor over days (about two thirds of the way in 4 days for fullness, 5 for joy, 7 for clean), at half pace at night; a day away leaves the elf content, three days wanting, a week missing the player |
| Mood | asleep while asleep; misses after 5 days without an interaction; wants when a need is under 60 (the name block names it); beaming from an average of 75 with no want; otherwise content |
| Sleep | by the clock: asleep from 21:00 to 07:00; the button tucks the elf in from 19:00 (until the morning) and before that answers that it is too early; woken at night it dozes off again after 10 minutes |
| Egg | warm +18 and rock +13 warmth (a tap on the egg rocks it; the warmth shows in the egg's glow); it is ready to hatch 6 hours after it appeared, or at a cottage found while it waits, whichever comes first (the HUD counts the hours down), and then the player hatches it: the egg rocks on its own, the first tap cracks it, the second breaks it open in the room and the elf hops out with a hello, then the hatch sheet asks for its name; the day's quests stay, only an open egg quest gives way to a care one. The Elf tab wears a badge while the egg waits for its tap (or the elf for its name) and while the day's reward is unpicked, and an egg that gets ready while another screen is in front is told once in a toast with the way there |
| Care | feed fullness +25 (3 charges, refused at 90), play joy +30 (2 charges), bath clean +60 (1 charge); a charge spent comes back 4 hours later for a meal, 6 for a game, 12 for a bath (the moments spent in the state's `care`), and with none back the elf has had enough for now, saying when the next is; a refill for dust or an ad brings them all back; a gift of the peddler's in the pantry (`gifts`) is given instead whenever a charge or the belly would refuse, with joy +5 on top |
| Pet (a tap on the elf) | joy +3, 1.4 s between taps |
| Experience | a find 40 (finds from before the egg appeared pay nothing), a quest done 8, the full set 15, each day a streak goes on 5, a care 2, a letter read 10, the tuck-in 3 (once a day), a trick's practice 4, a game 5 (`XP`); level n starts at 20·(n−1)·n (0, 40, 120, 240, 400...); a point per level past the first, a node of the tree per point; ranks: Skrzat to level 2, Leśnik 3–5, Strażnik 6–8, Mędrzec 9–11, Legenda from 12 |
| Tree | sixteen nodes, any parent owned opens a node, a point each: roots (charges back in three quarters of the time); belly (fullness eases half as fast), smile (joy eases half as fast), eye (one sill find more on a return); pantry (four meals), feast (a meal +35 instead of +25), games (three games), party (a game +45 instead of +30), trail (one missed day forgiven by the streak), luck (streak milestones paying double dust); hearth (fullness holds through sleep; from the pantry, the feast or the games), fair (quest acorns one and a half times, rounded up; from the games, the party, the feast or the trail), camp (two baths; from the trail, the luck or the party); the archetypes glutton, prankster and tracker over them, one only, each granting its piece (the cauldron, the hammock, the antlers) free of the finds and its title on the bar |
| Tricks | six, for acorns: the wave 40 (2 sessions), the twirl 60 (3), the bow 60 (3), the cheer 80 (3), the applause 80 (4), the toast 100 (4); one practice session a day per trick, none asleep; learned at the last session, then shown on demand (`ELF_TRICKS`, `buyTrick`, `trainTrick`) |
| Games | catch the acorns and memory, three rounds a day each (`GAME_PLAYS_PER_DAY`); a round pays its points in acorns at the game's rate (`GAME_POINTS_PER_ACORN`: 2 catches an acorn, 1 memory point an acorn) up to 20 (`GAME_ACORNS_MAX`, half as much again with the fair) and 5 experience, and counts for the quest gameOnce (8 acorns); the best points kept per game (`gamePlaysLeft`, `recordGame`) |
| Peddler | three wares a day (`WARES_A_DAY`) drawn by the day from treat 20, toy 25, soap 30 (a gift of that care into the pantry), ticket 15 (one round more in each game today), dust 60 (one grain) and a trick the elf has not got at its price less 10; each once a day (`peddlerWares`, `buyWare`, `peddlerFresh`) |
| Badges | meals 10 (15 acorns) and 100 (2 dust), baths 10 (15), pets 50 (15), games 10 (20) and 50 (2 dust), letters read 5 (15), a trick learned (10) and all six (3 dust), wares bought 10 (20), level 5 (20) and 10 (2 dust), best streak 7 (1 dust) and 30 (3 dust), an archetype chosen (2 dust); a reward taken once (`ELF_BADGES`, `badgeStatus`, `claimBadge`) |
| Forms | baby from the hatch; the next form at a level (`FORM_LEVELS`: young at 3, adult at 6, elder at 10) and only when the player lets the elf grow (`growUp`; the stored `form`); the shop sells the form ahead of its level (`growNow`), the finds count only through their experience |
| Quests | three a day, dealt by the day and the name from a pool (feed once or twice, play, bathe, pet five or ten times, swap a piece, tuck in, tend the egg three times, an evening visit, a visit), each paying 3 to 9 acorns; on Friday, Saturday and Sunday one of the three is always "discover a cottage", paying 25 acorns and 1 star dust; the full set pays 1 star dust |
| Daily reward | one of three to pick, once a day: 15 or 30 acorns, and 20 acorns or (every third day or so) 1 star dust |
| Streak | a visit on each day in a row; a missed day ends it (the elf says so, nothing is taken away); 7 days pay 1 star dust, 30 pay 3; a device date set back is no new day (the streak and the deal stay), and a date set forward and corrected pulls every stored moment back to now, so no charge or nap waits on a day that never comes |
| Sill finds | the first visit of a day after an absence: one small thing for each calendar day away (a pine cone, a feather, a pebble, an acorn, a mushroom, an autumn leaf, berries, an ammonite), chosen by the day and the name, so settling a day twice finds the same; the newest three lie on the windowsill, every one is counted in the collection |
| Letters | due on the 2nd, 5th and 9th day after the hatch, then every 7 days; one comes with the first visit after it is due (the ones due while the player was away are not heaped up); the odd ones are from a cottage found and not written from yet, the others an invitation from the nearest cottage not found yet (from the latest find), and the forest writes when there is neither; the last 12 are kept |
| Plant | the pot on the sill grows with the days since the hatch: a seedling, a sprout at 7 days, a little plant at 30, a bush at 90, a bush in flower at 180 |
| Away card | on the first visit after an absence of two days or more, or one that brought a letter or a new stage of the plant; a single night's find is said by the elf instead |
| Reminders | only as a reaction to what happens, with no hours to choose (`elfReminders`): the egg ready to hatch (at that moment), a letter come, the plant grown, and the day's new quests on the first three days after a visit while the player has not come by yet; at most one a day (the most important, an event inside those three days mentioning the quests too), at the player's own hour (the median of the last seven first visits, 17:00 before any, kept between 8:00 and 20:30), never from 21:00 to 8:00 (an egg ready in the night waits for 8:00), nothing on a day a cottage was found, nothing four weeks after the last visit; the elf asks once, at the egg (or, for an elf hatched before, once it has its name), and the preferences hold the switch |

Every action is refused while the elf sleeps (the buttons dim and tell
assistive tech so, but stay pressable: the rules refuse and the elf says
so from its bubble, waking excepted); a care with no charge back is
refused the same way, with its dots dark before the tap; and the first
form and fresh needs are set when the egg hatches.

### What the days bring

A reason to come back that never punishes an absence: the days away
leave something in the cottage. The elf lays what it found on the
windowsill beside the plant (`cottage/RoomSprites.tsx` draws the finds at
the sill's places the room manifest gives, the plant at its stage); a
letter that came waits on the floor, sealed, until it is read. The first
visit after a longer absence opens the 'while you were away' card
(`ElfAwaySheet.tsx`, presented by `useElfCardPresenter.ts` after the hatch
sheet and the evolution card): how long it was, the finds with their
pictures and names, the letter with the way to read it, the plant's new
stage. A letter (`ElfLetterSheet.tsx`, the words in `letters.ts`) greets
the elf by name. A cottage's own words come with its story (the story
file's `letterFound` and `letterInvite`, written in the site's admin
editor, `{{elf}}` standing for the elf's name); a cottage without them
gets the dictionary's templates (three for a cottage found, which name
its motto, three for an invitation, the letter's number picking one). One
from a cottage found signs with its occupant and opens its story, an
invitation signs with the cottage's title and shows it on the map, and
the forest writes for the season of the letter's day (spring, summer,
autumn, winter, the December holidays, the start of the summer
holidays), each season with a signature of its own. The keepsake shelf (`ElfShelfSheet.tsx`, from the
shelf in the room, the finds on the sill or the day's sheet) keeps what
the journey and the days have left: the jars of the cottages found with
their occupants and mottos, each opening its story, the treasures of the
windowsill (every kind with its count, a kind not found yet dimmed and
unnamed) and the letters, newest first, the unread ones marked. The
elf's greeting after half an hour away says when a letter waits.

### The feel

What the research into the pets that do this well (Pou, Tamagotchi,
Talking Tom, Neko Atsume, Finch) says, applied in the tab:

- **The elf notices the player.** The scene's `lookAt` turns the eyes and
  the head toward a point on the screen (the sprite elf, with no separate
  head, leans towards it); a stroke over the body is the most alive input
  (eyes close, the head leans in, hearts trickle).
- **The tutorial** (`useElfTutorial.ts`, `ElfTutorial.tsx`): cards above
  the care band that a new player clicks through at their own pace, once
  for the egg (rock it, warm it, open the ledger, what hatches it) and
  once for the named elf (pet it, feed it, the charges and the night, the
  decorating, the activities, the level with the tree, growing up and
  what a cottage found brings); a step that asks for a move waits for
  it (the feed's step takes the try, a full belly's refusal included, so
  it never waits for a hunger hours away), skip ends the flow, and each
  flow is remembered per device.
- **Reduced motion** keeps a slow, shallow breath as the elf's only loop,
  so it is alive and not a statue; reactions are a blip of particles.
- **Idle fidgets** every 8 to 15 seconds (an ear twitch, a yawn, a glance
  at the fire, a shift of weight) keep it alive between actions; at
  bedtime (from 19:00, until it is tucked in) the elf gets heavy lids and
  yawns.
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
- **A clock-driven light** (`cottage/clock.ts`): the plate is lit in
  Blender, so over it only the hearth's pulse and the night tint of sleep
  are painted (`PlateLighting`); the hour will return once the pipeline
  renders a day and a night plate.

### The decorating mode

Customisation follows the pattern that works in these games: fixed places
with small catalogues and an instant live preview. The decor
(`cottage/catalogue.ts`) has one variant list per place of the room, the
fireplace excepted: the walls and the floor, which are the room's own
surfaces (the plate is rendered for every pair of them), and the pieces
drawn over the plate (the rug, the bed, the window, the picture, the
shelf, the lantern, the herbs under the beam, the basket, the corner
plant and the stool by the fire), three variants each, all rendered
(`cottage/roomAssets.ts`); the frame also offers the photo of the latest
cottage found once there is one. Of the wardrobe's five slots (hat,
outfit, neck, hand, face), whose ids are in the same catalogue and in the
stored outfit, the hat is rendered: each hat (an acorn cap, a toadstool,
a crown of flowers, a nightcap, or none) is a layer of the elf's atlas,
packed in a small grid of its own around the head and drawn over the
body from the same frame clock (`sprites/useSpriteImages.ts`:
`useSpriteLayer` decodes only the hat worn); the other wearables wait for
their layers.

The decorating button in the top strip turns the tab into its decorating
mode, inside the tab (not a route: a route would unfocus the tab and
pause the scene, and the point is the live preview). The top strip says
what the mode is and has the way back ("Gotowe"); the care band gives
way to the catalogue (`ElfDecorPanel.tsx`) on the tab bar: a row of
category tabs, each with the count of its pieces the finds have unlocked
("Łóżko 2/3"), the elf's hat first once it has hatched (the room then
brings the elf to the middle, and the elf twirls in a hat put on), the
walls and the floor next, then the pieces from the largest, and under it
a row of large cards for the active category, three
to the width, each the piece's close-up picture on a light card
(`ElfThumb.tsx`: the catalogue render art/blender/room.py makes of every
piece, wall and floor by day) with its name. A tap on a card places it at
once through the provider, which saves it, and the placed card wears a
check; a piece the finds have not unlocked yet is dimmed under a lock
with how many more cottages it takes, and a tap on it places nothing:
the elf says so. The room fills the band between the strip and the
catalogue and moves, eased, to bring the place being chosen for to the
band's middle, where it is lit (`cottage/SlotHighlight.tsx`, a soft
wash and rim breathing on the piece; the walls and the floor are the
whole room and are not lit); a tap on a piece in the room picks its
category, and a screen reader gets the places as actions of the room.
The elf admires each piece placed (`admireSlot`: it looks at it and
sparkles).

### The art

The art is rendered in Blender (`art/`, see `art/README.md`): the room
and the elf are modelled, rigged, lit and animated by script, rendered to
frames with alpha and packed into WebP; the phone draws pictures, which is
smooth on any device, and the light, the cloth and the outlines are
computed offline where they can be as rich as the renders allow. The
cottage started as vectors drawn in code (Skia paths, gradients and
effects); the owner found that look clumsy and the vectors are gone, so
the scene has one way of drawing the room and needs the elf character
registered in `sprites/manifest.ts` (a missing registration is an error
at load, not a blank room).

The room is a plate (`assets/elf/room/plate_<wall>_<floor>.webp`, the
empty room with its walls, floor, beams and the fireplace with its fire,
in the decor's wall and floor, rendered at exactly the room units) with
the furniture laid over it as transparent crops
(`assets/elf/room/manifest.json` says where each variant sits in the
plate, `cottage/RoomSprites.tsx` draws them, the rug under the elf and
the rest in their depth; `cottage/roomFiles.ts`, generated by the
packer, names every file for Metro); the plate and every crop have a
daytime twin (`_day`) drawn over the night
picture at the opacity of the cottage clock's daylight, so the room's
light turns with the hour (the elf's frames are night-lit; by day
`cottage/SpriteElf.tsx` lifts them with a colour matrix that follows the
same value). Each form of the elf is an atlas of its own
(`assets/elf/sprites/<form>/`: each clip on sheets of its own, cut to
its own box and placed by its offset in the form's frame of reference,
the young elf's 245 by 341 pixels at about 152 pixels to the metre, rendered inside the room's
own scene so the figure carries the fire's and the moon's light, the
feet as the anchor, 24 fps; the clips idle, happy, sad, pet, feed,
wave, bath, play and yawn: the care's play and bath play their own, and a
yawn among the idle fidgets plays its clip (the motion tells the scene,
`onFidget`); the forms share one scale, so the manifest's `figureUnits`
gives each its own height in the room, the hatchling small and the elder
tall, and its `headUnits` the neck above which a tap is on the head) played by `cottage/SpriteElf.tsx` on the sprite player's
UI-thread frame clock, with the figure's procedural motion (the bob, the
squash, the tilt of the reactions) layered on top as a transform of the
frame, so a pet or a feed still moves the whole figure; the evolution's
moment lights the figure up through the same colour matrix. Asleep the
elf is not on the rug but in its bed (`cottage/SleepingElf.tsx`): the
form's picture of it there, on its side with the head on the pillow and
an arm over the bed's cover, by night and by day and with the hat worn,
for the bed the decor names
(the manifest's `sleepers`), fading in as the figure on the rug fades
out, breathing with the slow breath of sleep, its picture the tap target,
and sleep puffs (a drawn cloud, not a letter) rise from above its head. What is
baked into the body frames: the face (neutral, with blinks in the idle
clip) and the hair; the hats are layers of their own on the same frame
grid. Each form looks its own (the hatchling's sprout, the grown elf's
cape and wand, the elder's beard, robe and staff; see art/README.md), and
the room keeps drawing the form the player saw last until the
evolution's moment, which shows the new form at the height of its
flash; the new form's atlas is decoded as soon as the form is reached
(`useUpcomingSprites`). Skia turns an encoded image into pixels on its
first draw, on the UI thread, so the swap's first frame holds the flash
at its height while the new sheets go up; they are not drawn ahead,
since the GPU's texture budget cannot hold two forms' sheets at once
(drawing both every frame made Skia evict and upload them in turn).
Only the form shown and the one about to be stay decoded, and each atlas
gets Skia nodes of its own, whose first cell is computed as they mount
(a node reused for another atlas would draw one frame of the new sheet
cut by the old grid).

The egg (`cottage/RenderedEgg.tsx`) comes from the room's renders like
the furniture: the back half of the nest, the egg, the front half over
the egg's foot, by night and by day, with the egg's glow (the shell lit
from within, drawn in screen blending at its warmth). The egg rocks and
hops about the point it rests on (the manifest's `eggBase`) with the
figure's motion, shows its crack after the ready egg's first tap, and
breaks on the second in the scene: it shakes, splits along its zigzag
into the base and the cap, the cap flies off in an arc, a flash of the
glow and a burst of sparkles cover the moment the rules hatch the elf
(the scene calls the tab back at that beat), and the base and the nest
fade around the elf's feet; with reduce motion the pieces only fade.
The evolution card waits for the elf's moment in the room (it rises,
brightens and is circled by sparkles) and comes once the new form has
appeared in it; the tab plays the moment a beat after the form is
reached, and on a tab just opened only once the elf is drawn and the
new form's sheets are decoded (the scene tells it, `onFigureReady` and
`onNextReady`, with a five-second fallback), so a cold start never
flashes an empty room.

The room is designed in room units (`ROOM` in `cottage/room.ts`: the
plate's pixels, 1000 wide and 1300 tall, the floor line, the rug and the
elf's feet as the manifest gives them) and `fitRoom` scales it to cover
the band between the top strip and the care band (or the catalogue),
centred, so a phone crops at most a sliver of its sides or of its top
and bottom. Depth runs the plate, the furniture
behind the elf, the elf (or the egg in its nest), the furniture in front,
the particles, then the light overlays. The figure's motion
(`cottage/motion.ts`: breath, bob, squash, tilt, blink, look and lookY,
the head's own tilt, the ears, the hood's swing, the arms, the lids,
mouth, glow, flash, a fidget scheduler and a small particle pool, written for
the vector puppet and only partly read by the sprite) lives in Reanimated
shared values that Skia reads directly, so loops and reactions run on the
UI thread; reduced motion collapses the loops to a still pose and the
reactions to a plain fade.

The elf has sounds (`useElfSounds`, mounted by the tab while it is in
view): a plop for a tap on its head, a crunch for a meal, a splash for a
bath, a whoosh for a game and for the twirl of a new hat, a yawn among
the fidgets, a snore with every breath of sleep in its bed, a hum when it
wakes or greets the player, a crack for each crack of the egg, a sparkle
for the hatch, a whoosh of magic for an evolution, a jingle for the day's
quests and a streak's milestone, a page for a letter, and the fire's
crackle as a quiet loop under the room; a pat is silent, it comes too
often. A sound asked for again within its own gap (taps in a row) is let
go. The preferences carry the one switch (`SoundsSection`, on by
default, `src/lib/sounds-store.ts`). Left out on purpose: haptics (the
product rule stands: the app vibrates only for a plaque code and a
reward, never in the elf's tab; the elf's reminders are system
notifications and ring as the phone is set).

### Measuring the elf

The elf is judged on a release build, never on the development client:
the client alone sits near 800 MB on the Atlas (its bundle is 22 MB of
unminified JavaScript and it carries the dev tools), so every ratio read
from it is wrong. The build is the repo's own release variant, signed
with the debug key like the client (`./gradlew :app:assembleRelease
-PreactNativeArchitectures=arm64-v8a` in `android/` after a prebuild),
which installs over the client and never over the store's app: the
store build is the EAS production profile with the upload keystore
(`pnpm build:android:local`, `credentialsSource: local` in `eas.json`),
same code, same bundle, a different signature.

The tools under `tools/` run with the system Python and adb against the
one device attached (or `--serial`): `ui.py` presses controls by the words
on screen and takes screenshots, `memtable.py` prints one row of memory
figures per sample (PSS, the native heap where Skia's decoded sheets
live, the graphics total with its GL and EGL parts, which the GPU keeps
until Skia's budget is hit), `sftable.py` reads the frames the cottage's
SurfaceView presented over a window (`dumpsys gfxinfo` does not see that
surface). The series, after a fresh install and a wiped state, on the
Galaxy Note 10+:

| Point | What | How |
|---|---|---|
| A | the Atlas alone, one minute after launch | `memtable.py --label A` |
| B1 | the Elf tab just entered, egg or elf | `memtable.py --label B1`, `sftable.py --label B1` |
| B | after every clip has played and ten minutes on the tab | `memtable.py --label B --every 60 --count 10` |
| C | back on the Atlas for three minutes | `memtable.py --label C --every 60 --count 3` |

Measured on a release build of 2026-10-28 (the elf redesigned with its
new clips, six sheets, 3.5 MB; the room reframed to 1000 by 1300 with
nine plates and thirty pieces by night and by day and the catalogue's
pictures, 2.2 MB), the owner's own state: a hatched elf, five cottages
found, a decorated room, by day, so the day pictures are drawn over the
night ones:

| Point | PSS | native heap | graphics (GL + EGL) | Dalvik | unknown | RSS | frames |
|---|---|---|---|---|---|---|---|
| A, the Atlas alone after a minute | 236 MB | 78 MB | 49 MB (19 + 19) | 18 MB | 21 MB | 366 MB | |
| B1, the Elf tab just entered | 486 MB | 127 MB | 234 MB (19 + 19) | 14 MB | 26 MB | 631 MB | 62.4 fps, 0 dropped of 496 in 8 s |
| D, the decorating mode, ten categories clicked through | 501 MB | 140 MB | 219 MB (19 + 19) | 17 MB | 40 MB | 648 MB | 62.4 fps, 0 dropped of 481 |
| B, after the reactions and ten minutes on the tab | 600 to 630 MB (670 right after the reactions) | 176 to 199 MB | 251 to 272 MB | 15 MB | 60 to 75 MB | 743 to 780 MB | a reaction 61.6 fps, 0 dropped |
| C, back on the Atlas for three minutes | 570 MB | 172 MB | 216 MB (34 + 34) | 17 MB | 80 MB | 716 MB | |

Read: the tab costs about 250 MB on entering (the decoded sheets and the
room's pictures in the native heap and their copies in graphics memory)
and levels off some 120 MB higher after ten minutes; leaving the tab
gives little back, as expected of Skia's texture cache. A single sample
right after a move can sit 50 to 100 MB above its neighbours while
images decode and the heaps are collected; the plateau is the figure to
compare. Against the first baseline of 2026-10-26 (493 MB on hatching,
572 MB after ten minutes, 562 MB back on the Atlas) the new cottage costs
about 40 MB more at the plateau and nothing on entering. The catalogue's
cards draw their pictures as plain images: a Skia canvas per card, the
first version, was a GPU surface each and cost about 30 MB more while
the catalogue was open. The frame rate is the display's at every point.

The egg was measured the same day on the same build from a ready egg
(nothing found since it appeared): the Atlas 239 MB, the Elf tab entered
with the egg 328 MB (native heap 118 MB, graphics 79 MB: the elf's sheets
are decoded in advance but not yet drawn, and the egg's pieces are small
stills), 62.4 fps with none dropped; the break dropped no frame either;
just after the hatch, with the name sheet open, 503 MB (graphics 220 MB,
the elf now drawn), a minute after naming 556 MB, and back on the Atlas
525 MB. The egg costs about 90 MB on entering against the elf's 250, and
the hatched elf lands where the elf's own series does.

The forms were measured on a release build of 2026-10-29 (each form its
own atlas: the hatchling's four sheets, the young elf's six, the grown
elf's eight, the elder's thirteen, decoded 48, 82, 109 and 163 MB; the
APK 113 MB), the same five cottages found plus eight seeded for the
elder, the acorn cap worn. The elder entered on a cold start: the Atlas
224 MB, the Elf tab 643 MB (graphics 399 MB), 618 to 681 MB over the
first two minutes, 62.4 fps with none dropped. Through an evolution from
the grown elf: 693 MB with the card open, 730 to 760 MB with the elder
after it (graphics 410 to 440 MB, the grown elf's textures still in
Skia's cache), 61.8 fps with none dropped, and back on the Atlas 700 MB.
The moment itself, filmed frame by frame on the device: the elf drawn
1.7 s after the tap, the flash at once, the first draw of the new sheets
holding the flash at its height for about 0.4 s (the grown elf) and
0.8 s (the elder), the new form then seen for over a second before the
card. The elder is the costly form, about 150 MB over the young elf on
entering, since its staff swung out in the happy clip widened every cell
of that atlas; the clips have had boxes of their own since, and the
atlases of 2026-11-02 (nine clips with bath, play and yawn, the
sleepers) decode to 51, 81, 109 and 151 MB, the elder's a third under
the measured one; with the four acted clips of 2026-11-03 (refuse, sip,
beckon and greet, thirteen clips in all) they decode to 74, 116, 154 and
205 MB on 13, 13, 14 and 20 sheets of the base, a clip's sheets still
drawn only once it plays, and the series below predates them. Measured
on a release build of 2026-11-03 (the atlases of 2026-11-02, the sounds,
the elf's letters and the sleepers in; the acorn cap worn; a cold start
each), the Atlas alone after a minute sits at
252 to 257 MB; the young elf's tab enters at 595 MB (graphics 291 MB),
reaches 682 MB right after every reaction and 626 to 668 MB over the
next three minutes, and the Atlas after it holds 592 to 608 MB; the
elder's tab enters at 679 MB (graphics 376 MB), 728 MB after the
reactions, 716 to 763 MB over three minutes, the Atlas after it 674 to
690 MB; 62 fps with none dropped at every point. Against the series of
October the young elf's entry is about 110 MB higher and the elder's
about the same, while both settle 40 to 80 MB higher once every clip has
played: a clip's own sheets are drawn, and kept by Skia, only once it
plays, so the tab's cost now grows with what the elf has done rather
than arriving whole on entry; the hat's layer and the sounds' players
(a decoded buffer each) are in these numbers and not in October's.
Measured again on a release build of 2026-11-04 with the atlases of the
four acted clips (the APK 140 MB, the same cold starts and reactions,
no greeting played): the Atlas alone 234 to 257 MB; the young elf's tab
enters at 537 to 578 MB, 587 to 634 MB after the reactions, 606 to
626 MB over the next three minutes and the Atlas after it 558 to
575 MB; the elder's tab enters at 674 MB, 738 MB after the reactions,
728 to 747 MB over three minutes, the Atlas after it 694 to 709 MB; 62
fps with none dropped throughout. So the five extra sheets of each
atlas cost nothing on entry and nothing after the care clips, which is
the point of drawing a clip's sheets only when it plays; the sheets of
the four new clips join the tab's cost only once a refusal, a thanks or
a greeting has played.
The development client measures far higher (787 MB on the Atlas and
1.3 GB on the tab in the first series), which is why it is not quoted
anywhere.
