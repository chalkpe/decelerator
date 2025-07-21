import { AvatarImage } from '@radix-ui/react-avatar'
import { getDateDistance, getDateDistanceText } from '@toss/date'
import { createRestAPIClient } from 'masto'
import type { Notification } from 'masto/mastodon/entities/v1/notification.js'
import type { Status } from 'masto/mastodon/entities/v1/status.js'
import { useCallback, useState } from 'react'
import { redirect } from 'react-router'
import sanitizeHtml from 'sanitize-html'
import { Avatar } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import createAuth from '~/lib/auth'
import { authClient } from '~/lib/auth-client'
import type { Route } from './+types/index'

type NotificationWithData = Notification & {
  nextStatus: Status
}

async function findNextStatus(masto: ReturnType<typeof createRestAPIClient>, notification: Notification): Promise<Status | null> {
  try {
    let lastStatus: Status | null = null

    for await (const statuses of masto.v1.accounts.$select(notification.account.id).statuses.list({
      excludeReplies: true,
      excludeReblogs: false,
    })) {
      for (const status of statuses.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))) {
        if (status.reblog?.id === notification.status?.id) return lastStatus
        if (status.createdAt <= notification.createdAt) return null
        lastStatus = status
      }
    }

    return null
  } catch (error) {
    console.error('Failed to find next status:', error)
    return null
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  return (await auth.api.getSession(request)) ? undefined : redirect('/')
}

export default function Home() {
  const { data: session, isPending } = authClient.useSession()

  const [isFetching, setIsFetching] = useState(false)
  const [notifications, setNotifications] = useState<NotificationWithData[]>([])

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
          const nextStatus = await findNextStatus(masto, notification)
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
  }, [isFetching, isPending, session, notifications])

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
