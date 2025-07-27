import { prisma } from '@decelerator/database'
import { AvatarImage } from '@radix-ui/react-avatar'
import { ExternalLink } from 'lucide-react'
import { redirect } from 'react-router'
import sanitizeHtml from 'sanitize-html'
import { Avatar } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { createAuth } from '~/lib/auth.server'
import { cn, formatDistance } from '~/lib/utils'
import type { Route } from './+types/timeline'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

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

export default function HomeTimeline({ loaderData }: Route.ComponentProps) {
  const { notifications } = loaderData

  return (
    <ul className="w-full flex flex-col items-stretch justify-center gap-4 p-6">
      {notifications.map(({ data: notification, reaction, fromMutual }) => (
        <li key={notification.id} className="w-full">
          <Card className={cn(reaction ? '' : 'bg-muted', fromMutual ? '' : 'border-2 border-red-500')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={notification.account.avatar} alt={notification.account.displayName} />
                </Avatar>
                {notification.account.displayName}
              </CardTitle>
              <CardDescription>
                {formatDistance({ type: 'abbreviated', date: new Date(notification.createdAt), suffix: '전에' })} 부스트함
                {reaction &&
                  ` · ${formatDistance({ type: 'full', date: new Date(notification.createdAt), now: new Date(reaction.createdAt), suffix: '후에', immediateText: '바로' })} 작성함`}
              </CardDescription>
              {reaction?.data.url && (
                <CardAction>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!reaction.data.url) return
                      open(reaction.data.url, '_blank', 'noopener,noreferrer')
                    }}
                  >
                    <ExternalLink />
                  </Button>
                </CardAction>
              )}
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
                  <CardDescription>
                    {formatDistance({ type: 'abbreviated', date: new Date(notification.status?.createdAt), suffix: '전에' })} 작성함
                  </CardDescription>
                  {notification.status?.url && (
                    <CardAction>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!notification.status?.url) return
                          open(notification.status.url, '_blank', 'noopener,noreferrer')
                        }}
                      >
                        <ExternalLink />
                      </Button>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent
                  /** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(notification.status?.content ?? '') }}
                />
              </Card>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
