import { prisma } from '@decelerator/database'
import { useState } from 'react'
import { redirect } from 'react-router'
import sanitize from 'sanitize-html'
import { Avatar, AvatarImage } from '~/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { createAuth } from '~/lib/auth.server'
import { getAbbreviatedTime } from '~/lib/utils'
import type { Route } from './+types/index'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const groups = await prisma.reblogNotification.groupBy({
    by: ['statusId'],
    where: { userId: session.user.mastodonId, domain: session.user.domain, reactionId: { not: null } },
    _count: { statusId: true },
    orderBy: { _count: { statusId: 'desc' } },
  })

  const statuses = await prisma.statusIndex.findMany({
    where: { statusId: { in: groups.map((group) => group.statusId) } },
    select: { data: true },
  })

  return { statuses, groups }
}

export default function HomeIndex({ loaderData }: Route.ComponentProps) {
  const { statuses, groups } = loaderData

  const [sortBy, setSortBy] = useState('createdAt')

  return (
    <div>
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="정렬" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="createdAt">최신순</SelectItem>
          <SelectItem value="boost">인기순</SelectItem>
        </SelectContent>
      </Select>

      <ul>
        {statuses
          .map(({ data }) => ({ data, count: groups.find((group) => group.statusId === data.id)?._count.statusId ?? 0 }))
          .sort((a, b) => b.count - a.count || new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime())
          .map(({ data: status, count }) => (
            <li key={status.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={status.account.avatar} alt={status.account.displayName} />
                    </Avatar>
                    {status.account.displayName}
                  </CardTitle>
                  <CardDescription>
                    {getAbbreviatedTime(new Date(status.createdAt))} 작성함 · {count}번 부스트됨
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */}
                  <p dangerouslySetInnerHTML={{ __html: sanitize(status.content) }} />
                </CardContent>
              </Card>
            </li>
          ))}
      </ul>
    </div>
  )
}
