import type { Session } from '@supabase/supabase-js'
import type { ChatynkowoClient } from './client'
import type { Database } from './database.types'
import type { Profile } from './ranking'

/* The support ranking: who watched how many ads for Chatynkowo and
   bought the elves how many coffees, for the accounts that chose to be in
   it.

   The counts are a client's own ledger (the app keeps one per device),
   sent as that device's row and added up by the board, so two phones on
   one account never overwrite each other. They are the client's word:
   nothing here checks a purchase or an ad with the store or the ad
   network, which will do for a ranking played for the place alone and
   not for anything of value. Nothing is sent for an account that is not
   listed, and leaving the ranking takes its rows away. Every function throws when the backend
   refused or is unreachable. */

export type SupporterRow = Database['public']['Functions']['supporters_board']['Returns'][number]

/* What one device has given: the app's support ledger. */
export type SupportCounts = {
  coffees: number
  ads: number
  /* When the last one was given, in milliseconds since the epoch; 0 for
     none. */
  lastAt: number
}

/* The ranking, in its order: the most ads first, then the most coffees. */
export async function fetchSupporters(client: ChatynkowoClient): Promise<SupporterRow[]> {
  const { data, error } = await client.rpc('supporters_board')
  if (error) throw error
  return data ?? []
}

/* One device's ledger, written over that device's row: the same counts
   sent twice change nothing. */
export async function pushSupportLedger(client: ChatynkowoClient, session: Session, deviceId: string, counts: SupportCounts): Promise<void> {
  const { error } = await client.from('support_ledgers').upsert(
    {
      user_id: session.user.id,
      device_id: deviceId,
      coffees: counts.coffees,
      ads: counts.ads,
      last_at: counts.lastAt ? new Date(counts.lastAt).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_id' },
  )
  if (error) throw error
}

/* The seeker's answer to "do you want to be on the board". A no takes the
   account's ledgers out of the backend first, every device's, so nothing
   it did not agree to show stays there; a later yes sends them again. */
export async function setListedAsSupporter(client: ChatynkowoClient, session: Session, listed: boolean): Promise<Profile> {
  if (!listed) {
    const { error } = await client.from('support_ledgers').delete().eq('user_id', session.user.id)
    if (error) throw error
  }
  const { data, error } = await client.from('profiles').update({ listed_as_supporter: listed }).eq('id', session.user.id).select('*').single()
  if (error) throw error
  return data
}
