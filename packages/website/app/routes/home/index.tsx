import type { meetWorkflow, visitWorkflow } from '@decelerator/core/workflows'
import { prisma } from '@decelerator/database'
import { AvatarImage } from '@radix-ui/react-avatar'
import { getDateDistance, getDateDistanceText } from '@toss/date'
import { createRestAPIClient } from 'masto'
import type { Notification } from 'masto/mastodon/entities/v1/notification.js'
import type { Status } from 'masto/mastodon/entities/v1/status.js'
import { useCallback, useState } from 'react'
import { redirect, useFetcher } from 'react-router'
import sanitizeHtml from 'sanitize-html'
import { set, z } from 'zod'
import { Avatar } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import createAuth from '~/lib/auth'
import { authClient } from '~/lib/auth-client'
import { globalForTemporal } from '~/lib/temporal'
import type { Route } from './+types/index'

const formSchema = z.object({
  notificationId: z.string(),
})

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()

  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const notifications = await prisma.reblogNotification.findMany({
    where: { userId: session.user.mastodonId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  if (notifications.length === 0) {
    const domain = session.user.domain
    const { accessToken } = await auth.api.getAccessToken({ body: { providerId: domain, userId: session.user.id } })

    try {
      await globalForTemporal.temporal?.workflow.execute<typeof meetWorkflow>('meetWorkflow', {
        taskQueue: 'decelerator',
        workflowId: `meet-${domain}`,
        args: [{ domain, accessToken }],
      })
    } catch (error) {
      console.error('Meet workflow failed:', error)
    }
  }

  return { notifications }
}

interface Item {
  reaction: Status
  notification: Notification
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { data: session } = authClient.useSession()

  const { notifications } = loaderData
  const [list, setList] = useState<Item[]>([])

  const fetcher = useFetcher<typeof action>()

  const fetchNotifications = useCallback(async () => {
    if (!session) return
    const { data, error } = await authClient.getAccessToken({ providerId: session.user.domain, userId: session.user.id })

    if (error) return
    const masto = createRestAPIClient({ url: `https://${session.user.domain}`, accessToken: data.accessToken })

    for await (const { notificationId, reactionId } of notifications) {
      const reaction = await new Promise<Status | null>((resolve) => {
        if (reactionId) return resolve(masto.v1.statuses.$select(reactionId).fetch())

        const check = () =>
          fetcher.state === 'idle'
            ? resolve(fetcher.data ? masto.v1.statuses.$select(fetcher.data.statusId).fetch() : null)
            : setTimeout(check, 100)

        fetcher.submit({ notificationId }, { method: 'post' })
        setTimeout(check, 100)
      })
      if (!reaction) continue

      const hasNextStatusContent = reaction.content.trim().length > 0
      if (!hasNextStatusContent) continue

      const notification = await masto.v1.notifications.$select(notificationId).fetch()
      const isNextStatusFresh = new Date(reaction.createdAt).getTime() - new Date(notification.createdAt).getTime() < 60 * 60 * 1000 // 1 hour
      if (!isNextStatusFresh) continue

      setList((prev) => [...prev, { notification, reaction }])
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Rate limit handling
    }
  }, [fetcher, notifications, session])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted">
      <div className="container flex flex-col items-center justify-center gap-8 p-4">
        <ul className="w-full flex flex-col items-center justify-center gap-4">
          {list.map(({ notification, reaction }) => (
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
                    {getDateDistanceText(getDateDistance(new Date(notification.createdAt), new Date(reaction.createdAt)))} 후에 작성함
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-6">
                  {/** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */}
                  <p dangerouslySetInnerHTML={{ __html: sanitizeHtml(reaction.content ?? '') }} />
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
          {fetcher.state === 'submitting' || fetcher.state === 'loading' ? '로딩 중...' : `새로운 알림 가져오기 ${notifications.length}`}
        </Button>
      </div>
    </main>
  )
}

export async function action({ request }: Route.ActionArgs) {
  const result = formSchema.safeParse(Object.fromEntries(await request.formData()))
  if (!result.success) throw new Error('올바른 알림 ID를 입력하세요.')
  const { notificationId } = result.data

  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) throw new Error('로그인이 필요합니다.')

  const domain = session.user.domain
  const { accessToken } = await auth.api.getAccessToken({ body: { providerId: domain, userId: session.user.id } })

  try {
    return await globalForTemporal.temporal?.workflow.execute<typeof visitWorkflow>('visitWorkflow', {
      taskQueue: 'decelerator',
      workflowId: `visit-${domain}`,
      args: [{ domain, accessToken, notificationId }],
    })
  } catch (error) {
    console.error('Visit workflow failed:', error)
    return null
  }
}
