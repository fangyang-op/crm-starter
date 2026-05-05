export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: []
}

// Permissive stub — replaced wholesale by `supabase gen types typescript ...` in Phase 0.7.
// Until then, queries are loosely typed; cast row shapes inline with `.single<T>()` or
// `.returns<T[]>()` at the call site when you need them.
export type Database = {
  public: {
    Tables: Record<string, GenericTable>
    Views: Record<string, GenericTable>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
