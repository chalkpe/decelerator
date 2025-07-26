import { prisma } from '@decelerator/database'
import { AvatarImage } from '@radix-ui/react-avatar'
import { redirect } from 'react-router'
import sanitizeHtml from 'sanitize-html'
import { Avatar } from '~/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import createAuth from '~/lib/auth'
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

// interface Item {
//   notification: ReblogNotification['data']
//   reaction?: StatusIndex['data']
// }

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
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
