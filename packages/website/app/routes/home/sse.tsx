import type { FlushUpdateArgs, FlushUpdateResult } from '@decelerator/core/workflows'
import { redirect } from 'react-router'
import { eventStream } from 'remix-utils/sse/server'
import { clearIntervalAsync, setIntervalAsync } from 'set-interval-async/fixed'
import { createAuth } from '~/lib/auth.server'
import { temporal } from '~/lib/temporal.server'
import type { Route } from './+types'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const intervalMs = 15000 // 15 seconds
  const { domain, mastodonId: userId } = session.user

  return eventStream(request.signal, (send) => {
    console.log('Starting SSE interval for user', userId, 'on domain', domain)
    const interval = setIntervalAsync(
      async (domain: string, userId: string) => {
        try {
          const handle = temporal.workflow.getHandle(`daemon-${domain}`)
          const updateId = `${domain}-${userId}-${Math.floor(Date.now() / intervalMs)}`
          const result = await handle.executeUpdate<FlushUpdateResult, FlushUpdateArgs>('flush', { updateId, args: [{ userId }] })
          send({ event: 'flush', data: JSON.stringify(result.map((item) => item.notificationId)) })
        } catch (error) {
          send({ event: 'error', data: error instanceof Error ? error.message : 'Unknown error' })
        }
      },
      intervalMs,
      domain,
      userId,
    )
    return () => {
      console.log('SSE connection closed, clearing interval', interval)
      clearIntervalAsync(interval)
    }
  })
}
