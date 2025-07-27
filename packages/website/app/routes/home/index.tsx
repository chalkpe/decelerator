import type { daemonWorkflow } from '@decelerator/core/workflows'
import { prisma } from '@decelerator/database'
import { AvatarImage } from '@radix-ui/react-avatar'
import { redirect } from 'react-router'
import sanitizeHtml from 'sanitize-html'
import { Avatar } from '~/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import createAuth from '~/lib/auth'
import { globalForTemporal } from '~/lib/temporal'
import { cn, getAbbreviatedTime, getFullTime } from '~/lib/utils'
import type { Route } from './+types/index'

export async function loader({ request }: Route.LoaderArgs) {
  const temporal = globalForTemporal.temporal
  if (!temporal) return redirect('/')

  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  await temporal.workflow.start<typeof daemonWorkflow>('daemonWorkflow', {
    taskQueue: 'decelerator',
    workflowId: `daemon-${session.user.domain}`,
    workflowIdConflictPolicy: 'USE_EXISTING',
    args: [{ domain: session.user.domain }],
  })

  const notifications = await prisma.reblogNotification.findMany({
    where: { userId: session.user.mastodonId, domain: session.user.domain, reactionId: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: { reaction: true },
  })

  return {
    notifications: notifications.filter(
      (n) => n.reaction && n.reaction.createdAt.getTime() - n.createdAt.getTime() < 1000 * 60 * 2, // 2분 이내에 작성된 반응만 필터링
    ),
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
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
                    {getAbbreviatedTime(new Date(notification.createdAt))} 부스트함
                    {reaction && ` · ${getFullTime(new Date(notification.createdAt), new Date(reaction.createdAt))} 작성함`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  {reaction && (
                    <p
                      /** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(reaction.data.reblog?.content || reaction.data.content) }}
                    />
                  )}
                  <Card className={cn(reaction ? '' : 'bg-muted')}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Avatar>
                          <AvatarImage src={notification.status?.account.avatar} alt={notification.status?.account.displayName} />
                        </Avatar>
                        {notification.status?.account.displayName}
                      </CardTitle>
                      <CardDescription>{getAbbreviatedTime(new Date(notification.status?.createdAt))} 작성함</CardDescription>
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
      </div>
    </main>
  )
}
