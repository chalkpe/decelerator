import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import type createAuth from './auth'

export const authClient = createAuthClient({
  baseURL: 'http://localhost:5173',
  plugins: [inferAdditionalFields<Awaited<ReturnType<typeof createAuth>>>()],
})
