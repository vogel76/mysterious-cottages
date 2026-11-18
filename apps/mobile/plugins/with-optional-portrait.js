/* Declares the upright screen as a feature the app can do without.

   The app is drawn for an upright phone (`orientation: portrait` in
   app.json, which becomes `android:screenOrientation="portrait"` on its
   activities). Android reads that attribute as a requirement of the
   feature `android.hardware.screen.portrait`, so Google Play hides the app
   from every device that does not declare the feature (some tablets,
   desktops and headsets) and the Play Console warns about it on every
   release. Nothing in the app needs the feature: on such a device the
   system shows an upright app in a letterbox. This plugin writes the
   `<uses-feature>` element with `android:required="false"` into the
   generated AndroidManifest.xml, the way the Android documentation says
   to lift a requirement implied by `screenOrientation`. It is safe to run
   repeatedly (it replaces its own element). */
const { withAndroidManifest } = require('expo/config-plugins')

const FEATURE = 'android.hardware.screen.portrait'

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    const others = (manifest['uses-feature'] ?? []).filter((item) => item.$?.['android:name'] !== FEATURE)
    manifest['uses-feature'] = [...others, { $: { 'android:name': FEATURE, 'android:required': 'false' } }]
    return config
  })
}
