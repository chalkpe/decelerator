import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import type { createAuth } from './auth.server'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_REDIRECT_URL,
  plugins: [inferAdditionalFields<Awaited<ReturnType<typeof createAuth>>>()],
})
