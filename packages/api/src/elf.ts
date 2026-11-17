import type { Session } from '@supabase/supabase-js'
import type { ChatynkowoClient } from './client'
import type { Json } from './database.types'

/* The elf on the account: one record an account, the elf's whole state
   as the app keeps it (core's ElfState, opaque here) with a revision the
   writes raise by one. A write names the revision it was made over and
   goes through only if the account still stands at it, so two phones
   never write over each other unseen: the one that came second is told,
   reads the account again and decides anew (core's syncElf). The state is
   the client's word, as the finds' times are: nothing here checks what is
   in it. Every function throws when the backend refused or is
   unreachable. */

export type ElfRecord = {
  /* The elf's state as it was written; the reader normalises it. */
  state: unknown
  rev: number
}

/* The account's elf, or null when it holds none. */
export async function fetchElf(client: ChatynkowoClient, session: Session): Promise<ElfRecord | null> {
  const { data, error } = await client.from('elves').select('state, rev').eq('user_id', session.user.id).maybeSingle()
  if (error) throw error
  return data ? { state: data.state, rev: data.rev } : null
}

/* Postgres' code for a row that is already there. */
const UNIQUE_VIOLATION = '23505'

/* Writes the elf over the revision `baseRev` (0: the account holds none
   yet). Resolves to the new revision, or to null when the account has
   moved on since (another phone wrote first): the caller reads it again. */
export async function pushElf(client: ChatynkowoClient, session: Session, state: Json, changedAt: number, baseRev: number): Promise<number | null> {
  const changed_at = new Date(changedAt).toISOString()
  if (baseRev === 0) {
    const { data, error } = await client.from('elves').insert({ user_id: session.user.id, state, changed_at, rev: 1 }).select('rev')
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return null
      throw error
    }
    return data[0]?.rev ?? null
  }
  const { data, error } = await client
    .from('elves')
    .update({ state, changed_at, rev: baseRev + 1, updated_at: new Date().toISOString() })
    .eq('user_id', session.user.id)
    .eq('rev', baseRev)
    .select('rev')
  if (error) throw error
  return data[0]?.rev ?? null
}
