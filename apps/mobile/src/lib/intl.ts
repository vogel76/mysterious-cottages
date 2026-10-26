/* Hermes ships without Intl.DisplayNames, which the cottage panel uses to
   name a cottage's country the way the site does, and without
   Intl.PluralRules, which i18next needs to pick the Polish forms for two
   to four (odkrycia, Chatynki, żołędzie) instead of the many form; FormatJS
   fills both in for the languages the app ships. Imported once, from the
   entry point, before i18next is set up. */
import '@formatjs/intl-getcanonicallocales/polyfill'
import '@formatjs/intl-locale/polyfill'
import '@formatjs/intl-pluralrules/polyfill'
import '@formatjs/intl-pluralrules/locale-data/pl'
import '@formatjs/intl-pluralrules/locale-data/en'
import '@formatjs/intl-displaynames/polyfill'
import '@formatjs/intl-displaynames/locale-data/pl'
import '@formatjs/intl-displaynames/locale-data/en'
