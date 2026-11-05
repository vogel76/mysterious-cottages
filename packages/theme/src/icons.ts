/* The icon vocabulary's roles: the semantic names both clients export from
   their icons.ts, so a design decision (which glyph plays which role) is
   made once and a role missing on one side fails compilation. The glyphs
   themselves come from @phosphor-icons/react on the site and
   phosphor-react-native in the app. */

export const SHARED_ICON_ROLES = [
  /* Interface */
  'CloseIcon',
  'BackIcon',
  'ForwardIcon',
  'PreviousIcon',
  'NextIcon',
  'ExpandIcon',
  'CheckIcon',
  'PlayIcon',
  'PauseIcon',
  'SoundOnIcon',
  'SoundOffIcon',
  'ZoomInIcon',
  'ZoomOutIcon',
  'ResetViewIcon',
  'LocateIcon',
  'SpinnerIcon',
  'SearchIcon',
  /* The expedition */
  'CottageIcon',
  'FoundIcon',
  'PinIcon',
  'NavigateIcon',
  'AtlasIcon',
  'TrailIcon',
  'KeyIcon',
  'SealIcon',
  'QrIcon',
  'ShieldIcon',
  /* The Kronika and the lore */
  'ChronicleIcon',
  'RewardIcon',
  'NotebookIcon',
  'StoryAudioIcon',
  'LoreIcon',
  'CreedIcon',
  'ElfIcon',
  'ForestIcon',
  /* The account */
  'ProfileIcon',
  'SignOutIcon',
  /* Brands */
  'InstagramIcon',
  'FacebookIcon',
] as const

/* Roles only the app has a surface for. */
export const MOBILE_ICON_ROLES = [
  'CameraIcon',
  'OfflineIcon',
  'SyncIcon',
  'DownloadIcon',
  'WarningIcon',
  'LanguageIcon',
  'ShareIcon',
  'TorchIcon',
  'TorchOffIcon',
  'InfoIcon',
  /* The arrow of the nearest-cottage beacon, turned to the heading. */
  'BearingIcon',
  /* The elf's shop of star dust on its bar. */
  'ShopIcon',
  /* The three paths of the elf's tree of development: the glutton, the
     prankster, the tracker. */
  'PathGluttonIcon',
  'PathPranksterIcon',
  'PathTrackerIcon',
  /* The nodes of the tree, one picture each (the fair, the luck and the
     camp reuse AcornsIcon, StreakIcon and BathIcon). */
  'SlowHungerIcon',
  'BigMealIcon',
  'ExtraMealIcon',
  'CauldronIcon',
  'SoundSleepIcon',
  'LongJoyIcon',
  'ExtraGameIcon',
  'HammockIcon',
  'BigGameIcon',
  'SharpEyeIcon',
  'QuickHandsIcon',
  'AntlersIcon',
  'ForgivingStreakIcon',
  /* The elf's activities: the hub on the bar and the tricks, one picture
     each. */
  'ActivitiesIcon',
  'TricksIcon',
  'TrickWaveIcon',
  'TrickTwirlIcon',
  'TrickBowIcon',
  'TrickCheerIcon',
  'TrickApplauseIcon',
  'TrickToastIcon',
  /* The games from the couch, the memory of pairs and the forest echo. */
  'GamesIcon',
  'MemoryGameIcon',
  'EchoGameIcon',
  /* The travelling peddler, his ticket to the games and his gifts (a
     treat, a toy, a soap in the pantry, marked under the care buttons). */
  'PeddlerIcon',
  'CocoaIcon',
  'GiftIcon',
  /* The badges: the collection's medal, a level reached, the archetype chosen. */
  'BadgesIcon',
  'LevelBadgeIcon',
  'ArchetypeBadgeIcon',
  /* Supporting Chatynkowo (apps/mobile/src/features/support): a coffee
     for the elf, a rewarded ad watched instead. */
  'CoffeeIcon',
  'WatchAdIcon',
  /* The elf companion (apps/mobile/src/features/elf): the egg, the needs,
     the care actions, the purse, the streak, the day's quests, the jars of
     the cottages found and the lock on a piece they have not unlocked. */
  'EggIcon',
  'WarmIcon',
  'LullabyIcon',
  'FeedIcon',
  'ToyIcon',
  'BathIcon',
  'SleepIcon',
  'WakeIcon',
  'JoyIcon',
  'AcornsIcon',
  'DustIcon',
  'StreakIcon',
  'QuestIcon',
  'JarIcon',
  'LockIcon',
  /* The cottage's decor edit mode. */
  'DecorIcon',
  /* A letter from the cottages, sealed and opened. */
  'LetterIcon',
  'LetterOpenIcon',
] as const

/* Roles only the site has a surface for. */
export const WEB_ICON_ROLES = [
  /* The invitation to install the app (apps/web/src/App.tsx). */
  'AppIcon',
  'GooglePlayIcon',
  'AppStoreIcon',
] as const

export type SharedIconRole = (typeof SHARED_ICON_ROLES)[number]
export type MobileIconRole = (typeof MOBILE_ICON_ROLES)[number]
export type WebIconRole = (typeof WEB_ICON_ROLES)[number]

/* Type-checks a vocabulary against its role list without changing it:
   `const vocabulary = defineIcons<Icon, SharedIconRole>()({ ... })`. */
export function defineIcons<Glyph, Role extends string>() {
  return <T extends Record<Role, Glyph>>(vocabulary: T & Record<Exclude<keyof T, Role>, never>) => vocabulary
}
