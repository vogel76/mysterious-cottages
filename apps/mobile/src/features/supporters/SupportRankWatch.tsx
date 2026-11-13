import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { onSupportExported } from '../../lib/support-export'
import { getBoard, loadBoard } from '../../lib/supporters-board'
import { useSession, useToast } from '../../providers'
import { useSupportStanding } from './useSupportStanding'

/* Keeps the seeker's standing in the support ranking current wherever
   they are in the app, and says so when it gets better: the ranking is
   read once a listed account is known and again whenever the standing
   may have moved (the ledger reached the account, the seeker joined or
   left), and a climb, or the first entry, is a toast. That is the moment
   the ranking is for: an ad watched anywhere in the game, and the place
   it bought. Joining says nothing here (the question's sheet and the
   account's switch have their own word): the first read after it only
   sets the place to climb from. Mounted once, under the providers; it
   draws nothing. */

/* The news stays longer than a toast usually does: it is the ad's reward. */
const NEWS_MS = 5000

export function SupportRankWatch() {
  const { t } = useTranslation()
  const toast = useToast()
  const { profile } = useSession()
  const standing = useSupportStanding()
  const myId = profile?.public_id ?? null
  const listed = standing.listed === true

  useEffect(() => {
    if (listed) void loadBoard()
  }, [listed, myId])

  useEffect(() => onSupportExported(() => void loadBoard()), [])

  /* The place the seeker was last seen at, once the rows were in: a first
     read tells nothing new, a later better place does. */
  const seen = useRef<{ id: string; place: number | null } | null>(null)
  const place = standing.place
  useEffect(() => {
    if (!myId || !listed) {
      seen.current = null
      return
    }
    if (getBoard().updatedAt === null) return
    const before = seen.current
    seen.current = { id: myId, place }
    if (!before || before.id !== myId || place === null) return
    if (before.place === null) toast.show({ tone: 'success', text: t('mobile:supporters.entered', { place }), durationMs: NEWS_MS })
    else if (place < before.place) toast.show({ tone: 'success', text: t('mobile:supporters.rankUp', { place }), durationMs: NEWS_MS })
  }, [myId, listed, place, toast, t])

  return null
}
