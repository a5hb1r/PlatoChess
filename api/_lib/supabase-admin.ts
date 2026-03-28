import { createClient } from '@supabase/supabase-js'

function getRequiredServerEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function hasSupabaseAdminEnv(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
  )
}

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL')
  }

  return createClient(supabaseUrl, getRequiredServerEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
