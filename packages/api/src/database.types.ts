/* Database schema types — written by hand in the shape that
   `supabase gen types typescript` produces. Once the schema grows, replace
   this file with the generated one:
     supabase gen types typescript --linked > packages/api/src/database.types.ts
   The source of truth for the schema is the Supabase project itself; see
   supabase/README.md. */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          public_id: string
          display_name: string
          avatar_url: string | null
          completed_at: string | null
          created_at: string
          /* Whether the account is in the support ranking: true or false
             once the seeker answered, null until then. */
          listed_as_supporter: boolean | null
        }
        Insert: {
          id: string
          public_id: string
          display_name: string
          avatar_url?: string | null
          completed_at?: string | null
          created_at?: string
          listed_as_supporter?: boolean | null
        }
        Update: {
          id?: string
          public_id?: string
          display_name?: string
          avatar_url?: string | null
          completed_at?: string | null
          created_at?: string
          listed_as_supporter?: boolean | null
        }
        Relationships: []
      }
      /* What an account gave (coffees bought, ads watched to the end), one
         row per device it gave from, since each device keeps its own
         ledger; the board adds the rows up. */
      support_ledgers: {
        Row: {
          user_id: string
          device_id: string
          coffees: number
          ads: number
          last_at: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          device_id: string
          coffees?: number
          ads?: number
          last_at?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          device_id?: string
          coffees?: number
          ads?: number
          last_at?: string | null
          updated_at?: string
        }
        /* user_id references auth.users, like finds. */
        Relationships: []
      }
      finds: {
        Row: {
          user_id: string
          slug: string
          found_at: string
        }
        Insert: {
          user_id: string
          slug: string
          found_at?: string
        }
        Update: {
          user_id?: string
          slug?: string
          found_at?: string
        }
        /* user_id references auth.users, not profiles, so PostgREST exposes no
           relationship between the two tables. */
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      /* The leaderboard() SQL function of the project. elapsed_seconds is a
         bigint, which PostgREST serialises as a number within JS range. */
      leaderboard: {
        Args: { p_total?: number }
        Returns: {
          public_id: string
          display_name: string
          avatar_url: string | null
          found: number
          completed: boolean
          elapsed_seconds: number | null
          first_found: string
          last_found: string
        }[]
      }
      /* The supporters_board() SQL function: the accounts that chose to be
         listed, with what they gave added up over their devices, the most
         ads first. The sums are bigints, numbers within JS range. */
      supporters_board: {
        Args: Record<never, never>
        Returns: {
          public_id: string
          display_name: string
          avatar_url: string | null
          coffees: number
          ads: number
        }[]
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
