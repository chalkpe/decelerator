import type { meetWorkflow, visitWorkflow } from '@decelerator/core/workflows'
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
import { globalForTemporal } from '~/lib/temporal'
import type { Route } from './+types/index'

const formSchema = z.object({
  accountId: z.string(),
  reblogId: z.string(),
  reblogCreatedAt: z.iso.datetime(),
})

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()

  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const domain = session.user.domain
  const { accessToken } = await auth.api.getAccessToken({ body: { providerId: domain, userId: session.user.id } })

  return await globalForTemporal.temporal?.workflow.execute<typeof meetWorkflow>('meetWorkflow', {
    taskQueue: 'decelerator',
    workflowId: `meet-${domain}`,
    args: [{ domain, accessToken }],
  })
}

type NotificationWithData = Notification & {
  nextStatus: Status
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [notifications, setNotifications] = useState<NotificationWithData[]>([])

  const fetcher = useFetcher()

  const fetchNotifications = useCallback(async () => {
    for await (const notification of loaderData?.notifications ?? []) {
      const nextStatus = await new Promise<Status | null>((resolve) => {
        fetcher.submit(
          { accountId: notification.account.id, reblogId: notification.id, reblogCreatedAt: notification.createdAt },
          { method: 'post' },
        )

        const check = () => (fetcher.state === 'idle' ? resolve(fetcher.data) : setTimeout(check, 100))
        check()
      })
      if (!nextStatus) continue

      const hasNextStatusContent = nextStatus.content.trim().length > 0
      if (!hasNextStatusContent) continue

      const isNextStatusFresh = new Date(nextStatus.createdAt).getTime() - new Date(notification.createdAt).getTime() < 60 * 60 * 1000 // 1 hour
      if (!isNextStatusFresh) continue

      setNotifications((prev) => [...prev, { ...notification, nextStatus }])
    }
  }, [fetcher, loaderData])

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
        <Button
          className="w-full"
          variant="outline"
          onClick={fetchNotifications}
          disabled={fetcher.state === 'submitting' || fetcher.state === 'loading'}
        >
          {fetcher.state === 'submitting' || fetcher.state === 'loading' ? '로딩 중...' : '새로운 알림 가져오기'}
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
  const { accessToken } = await auth.api.getAccessToken({ body: { providerId: domain, userId: session.user.id } })

  const index = await globalForTemporal.temporal?.workflow.execute<typeof visitWorkflow>('visitWorkflow', {
    taskQueue: 'decelerator',
    workflowId: `visit-${domain}`,
    args: [{ domain, accessToken, accountId, reblogId, reblogCreatedAt }],
  })
  if (!index) return null

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  return await masto.v1.statuses.$select(index.statusId).fetch()
}
