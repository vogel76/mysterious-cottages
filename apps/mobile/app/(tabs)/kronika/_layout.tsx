import { useTranslation } from 'react-i18next'
import { Stack } from 'expo-router'
import { TabStack } from '../../../src/ui'

/* The Kronika tab's own stack: the collection under a standard title, and
   the Ranking and the support ranking pushed on top under their own
   titles with the native back button. The collection's title is the reward config's treasury title,
   so index.tsx sets it with Stack.Screen once the content is known; the
   Ranking's short title is read here so it follows the language switch
   (the screen sets it again with its header items). */
/* The collection stays under the Ranking also when a link from another
   tab lands on the Ranking first (the account screen's row asks for it
   with `withAnchor`): without the anchor the stack would begin at the
   Ranking, with no back button to the Kronika. */
export const unstable_settings = { anchor: 'index' }

export default function KronikaLayout() {
  const { t } = useTranslation()
  return (
    <TabStack>
      <Stack.Screen name="index" />
      <Stack.Screen name="ranking" options={{ title: t('mobile:ranking.headerTitle') }} />
      <Stack.Screen name="supporters" options={{ title: t('mobile:supporters.title') }} />
    </TabStack>
  )
}
