import type { visitWorkflow } from '@decelerator/core/workflows'
import { prisma } from '@decelerator/database'
import { AvatarImage } from '@radix-ui/react-avatar'
import { redirect, useFetcher } from 'react-router'
import sanitizeHtml from 'sanitize-html'
import { Avatar } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import createAuth from '~/lib/auth'
import { globalForTemporal } from '~/lib/temporal'
import { cn, getRelativeTime } from '~/lib/utils'
import type { Route } from './+types/index'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()

  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const notifications = await prisma.reblogNotification.findMany({
    where: { userId: session.user.mastodonId },
    orderBy: { createdAt: 'desc' },
    include: { reaction: true },
  })

  return { notifications }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher()
  const { notifications } = loaderData

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted">
      <div className="container flex flex-col items-center justify-center gap-8 p-4">
        <ul className="w-full flex flex-col items-center justify-center gap-4">
          {notifications.map(({ data: notification, reaction }) => (
            <li key={notification.id} className="w-full">
              <Card className={cn(reaction ? '' : 'bg-muted')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={notification.account.avatar} alt={notification.account.displayName} />
                    </Avatar>
                    {notification.account.displayName}
                  </CardTitle>
                  <CardDescription>
                    {getRelativeTime(new Date(notification.createdAt))} 전에 부스트함
                    {reaction && ` · ${getRelativeTime(new Date(notification.createdAt), new Date(reaction.createdAt))} 후에 작성함`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  {reaction && (
                    /** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */
                    <p dangerouslySetInnerHTML={{ __html: sanitizeHtml(reaction.data.content ?? '') }} />
                  )}
                  <Card className={cn(reaction ? '' : 'bg-muted')}>
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
                <CardFooter>
                  <fetcher.Form method="post" className="w-full">
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <Button type="submit" disabled={fetcher.state !== 'idle'}>
                      찾기
                    </Button>
                  </fetcher.Form>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const notificationId = formData.get('notificationId')?.toString()
  if (!notificationId) return null

  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return null

  const domain = session.user.domain
  const { accessToken } = await auth.api.getAccessToken({ body: { providerId: domain, userId: session.user.id } })

  const temporal = globalForTemporal.temporal
  if (!temporal) return null

  try {
    return await temporal.workflow.execute<typeof visitWorkflow>('visitWorkflow', {
      taskQueue: 'decelerator',
      workflowId: `visit-${domain}`,
      args: [{ accessToken, domain, notificationId }],
    })
  } catch (error) {
    console.error('Visit workflow failed:', error)
    return null
  }
}
