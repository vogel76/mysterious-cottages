import { useTranslation } from 'react-i18next'
import { Stack } from 'expo-router'
import { TabStack } from '../../../src/ui'

/* The Elf tab's own stack: the companion prototype. Its one screen is the
   full-screen cottage scene with its own floating HUD, so the native bar is
   off there and the scene runs under the status bar as the Atlas does. The
   title is still read here (and follows the language switch) so the route
   has a name for assistive tech and any screen stacked on top. */
export default function ElfLayout() {
  const { t } = useTranslation()
  return (
    <TabStack>
      <Stack.Screen name="index" options={{ title: t('mobile:elf.title'), headerShown: false }} />
    </TabStack>
  )
}
