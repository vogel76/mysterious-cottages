import { useEffect, useRef } from 'react'
import { useRouter, useSegments } from 'expo-router'
import { STORAGE_KEYS } from '../../config'
import { readJson, writeJson } from '../../lib/storage'
import { useSession } from '../../providers'

/* Asks a signed-in seeker, once, whether they want to be on the
   supporters' board: the sheet at /supporters-ask. Mounted once, under
   the providers; it draws nothing.

   The question is for an account that has not answered (the profile says
   so; an answer given on another phone counts) and that this device has
   not asked before: a seeker who swipes the sheet away is not asked
   again here, and can still join from the board or the account screen.
   It waits for a quiet moment: a tab in front (not the welcome, not
   another sheet, not the nickname prompt a sign-in may have opened) that
   has stayed in front for a moment. */

const QUIET_MS = 1500

export function SupportersPrompt() {
  const router = useRouter()
  const segments = useSegments()
  const { session, profile, nameRequested } = useSession()
  const userId = session?.user.id ?? null
  /* Strictly null: a backend that does not know the board yet answers
     nothing here, and then nobody is asked. */
  const unanswered = profile?.listed_as_supporter === null
  const quiet = segments[0] === '(tabs)' && !nameRequested
  const decided = useRef<string | null>(null)
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  useEffect(() => {
    if (!userId || !unanswered || !quiet || decided.current === userId) return
    const timer = setTimeout(() => {
      decided.current = userId
      void readJson<string>(STORAGE_KEYS.supportersAsked).then((asked) => {
        if (asked === userId || !mounted.current) return
        void writeJson(STORAGE_KEYS.supportersAsked, userId)
        router.push('/supporters-ask')
      })
    }, QUIET_MS)
    return () => clearTimeout(timer)
  }, [userId, unanswered, quiet, router])

  return null
}
