import { workflows } from '@decelerator/core'
import { AvatarImage } from '@radix-ui/react-avatar'
import { getDateDistance, getDateDistanceText } from '@toss/date'
import { createRestAPIClient } from 'masto'
import type { Notification } from 'masto/mastodon/entities/v1/notification.js'
import type { Status } from 'masto/mastodon/entities/v1/status.js'
import { useCallback, useState } from 'react'
import { redirect, useFetcher } from 'react-router'
import sanitizeHtml from 'sanitize-html'
import { z } from 'zod'
import { Avatar } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import createAuth from '~/lib/auth'
import { authClient } from '~/lib/auth-client'
import { temporal } from '~/lib/temporal.server'
import type { Route } from './+types/index'

const formSchema = z.object({
  accountId: z.string(),
  reblogId: z.string(),
  reblogCreatedAt: z.iso.datetime(),
})

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  return (await auth.api.getSession(request)) ? undefined : redirect('/')
}

type NotificationWithData = Notification & {
  nextStatus: Status
}

export default function Home() {
  const { data: session, isPending } = authClient.useSession()

  const [isFetching, setIsFetching] = useState(false)
  const [notifications, setNotifications] = useState<NotificationWithData[]>([])

  const fetcher = useFetcher()
  const findNextStatus = useCallback(
    async (notification: Notification): Promise<Status | null> =>
      new Promise((resolve, reject) => {
        if (!notification.status) return resolve(null)
        fetcher.submit({
          accountId: notification.account.id,
          reblogId: notification.status.id,
          reblogCreatedAt: notification.createdAt,
        })
        setInterval(() => {
          if (fetcher.state === 'idle') {
            if (fetcher.data) resolve(fetcher.data as Status)
            else reject(new Error('Failed to fetch next status'))
          }
        }, 100)
      }),
    [fetcher],
  )

  const fetchNotifications = useCallback(async () => {
    if (isPending || !session || isFetching) return
    setIsFetching(true)

    try {
      const { data, error } = await authClient.getAccessToken({ providerId: session.user.domain })
      if (error) {
        console.error('Failed to fetch access token:', error)
        return
      }

      const masto = createRestAPIClient({ url: `https://${session.user.domain}`, accessToken: data.accessToken })
      const lastNotificationId =
        notifications.length > 0 ? notifications.map((n) => n.id).sort((a, b) => Number(a) - Number(b))[0] : undefined

      let count = 0
      const limit = 40

      for await (const list of masto.v1.notifications.list({
        limit,
        types: ['reblog'],
        ...(typeof lastNotificationId === 'string' ? { maxId: lastNotificationId } : {}),
      })) {
        for (const notification of list.toSorted((a, b) => Number(b.id) - Number(a.id))) {
          const nextStatus = await findNextStatus(notification)
          if (!nextStatus) continue

          const hasNextStatusContent = nextStatus.content.trim().length > 0
          if (!hasNextStatusContent) continue

          const isNextStatusFresh = new Date(nextStatus.createdAt).getTime() - new Date(notification.createdAt).getTime() < 60 * 60 * 1000 // 1 hour
          if (!isNextStatusFresh) continue

          setNotifications((prev) => [...prev, { ...notification, nextStatus }])
          await new Promise((resolve) => setTimeout(resolve, 10_000)) // Throttle requests to avoid rate limiting
        }

        if (++count >= limit) break
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsFetching(false)
    }
  }, [isFetching, isPending, session, notifications, findNextStatus])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted">
      <div className="container flex flex-col items-center justify-center gap-8 p-4">
        <ul className="w-full flex flex-col items-center justify-center gap-4">
          {notifications.map((notification) => (
            <li key={notification.id} className="w-full">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={notification.account.avatar} alt={notification.account.displayName} />
                    </Avatar>
                    {notification.account.displayName}
                  </CardTitle>
                  <CardDescription>
                    {getDateDistanceText(getDateDistance(new Date(notification.createdAt), new Date()), {
                      hours: (t) => t.days === 0,
                      minutes: (t) => t.days === 0 && t.hours === 0,
                      seconds: (t) => t.days === 0 && t.hours === 0 && t.minutes === 0,
                    })}{' '}
                    전에 부스트함 &middot;{' '}
                    {getDateDistanceText(getDateDistance(new Date(notification.createdAt), new Date(notification.nextStatus.createdAt)))}{' '}
                    후에 작성함
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-6">
                  {/** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */}
                  <p dangerouslySetInnerHTML={{ __html: sanitizeHtml(notification.nextStatus?.content ?? '') }} />
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Avatar>
                          <AvatarImage src={notification.status?.account.avatar} alt={notification.status?.account.displayName} />
                        </Avatar>
                        {notification.status?.account.displayName}
                      </CardTitle>
                      <CardContent
                        /** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(notification.status?.content ?? '') }}
                        className="px-0"
                      />
                    </CardHeader>
                  </Card>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
        <Button onClick={fetchNotifications} disabled={isFetching}>
          {isFetching ? 'Fetching...' : 'Fetch Notifications'}
        </Button>
      </div>
    </main>
  )
}

export async function action({ request }: Route.ActionArgs) {
  const result = formSchema.safeParse(Object.fromEntries(await request.formData()))
  if (!result.success) return null
  const { accountId, reblogId, reblogCreatedAt } = result.data

  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return null

  const domain = session.user.domain
  const { accessToken } = await auth.api.getAccessToken({ body: { providerId: domain } })

  const index = await temporal.workflow.execute(workflows.visitWorkflow, {
    taskQueue: 'decelerator',
    workflowId: `visit-${session.user.domain}`,
    args: [{ domain, accessToken, accountId, reblogId, reblogCreatedAt }],
  })
  if (!index) return null

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  return await masto.v1.statuses.$select(index.statusId).fetch()
}
