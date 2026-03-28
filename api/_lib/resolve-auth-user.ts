import type { VercelRequest } from '@vercel/node'
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from './supabase-admin'

export type ResolvedAuthUser = {
  id: string
  email: string | null
}

function readBearerToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return null
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

export async function resolveAuthenticatedUser(
  req: VercelRequest,
): Promise<ResolvedAuthUser | null> {
  if (!hasSupabaseAdminEnv()) {
    return null
  }

  const token = readBearerToken(req)
  if (!token) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return null
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  }
}
