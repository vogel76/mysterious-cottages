/* App entry. The polyfills come first (supabase-js needs crypto.getRandomValues
   and a complete URL, the cottage panel Intl.DisplayNames, i18next
   Intl.PluralRules for the Polish forms), then expo-router mounts the app/
   directory. */
import 'react-native-get-random-values'
import 'react-native-url-polyfill/auto'
import './src/lib/intl'
import 'expo-router/entry'
