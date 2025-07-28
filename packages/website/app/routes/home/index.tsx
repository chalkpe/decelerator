import { ExternalLink, Home, Repeat2 } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, redirect, useRevalidator } from 'react-router'
import AutoSizer from 'react-virtualized-auto-sizer'
import { FixedSizeList as List } from 'react-window'
import { Avatar, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import { temporal } from '~/lib/temporal.server'
import { formatDistance } from '~/lib/utils'
import pkg from '../../../../../package.json'
import type { Route } from './+types'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const handle = temporal.workflow.getHandle(`daemon-${session.user.domain}`)
  const history = await handle.fetchHistory()

  return {
    events:
      history.events
        ?.toReversed()
        ?.filter((event) =>
          [
            'timerStartedEventAttributes',
            'timerFiredEventAttributes',
            'activityTaskScheduledEventAttributes',
            'startChildWorkflowExecutionInitiatedEventAttributes',
          ].some((key) => key in event && !!event[key as keyof typeof event]),
        )
        .slice(0, 20)
        .map((event) => ({
          eventId: event.eventId?.low ?? '',
          eventTime: event.eventTime?.seconds?.low ? new Date(1000 * event.eventTime.seconds.low) : new Date(),
          timerStartedEventAttributes: !!event.timerStartedEventAttributes,
          timerFiredEventAttributes: !!event.timerFiredEventAttributes,
          activityTaskScheduledEventAttributes: event.activityTaskScheduledEventAttributes?.activityType?.name ?? '',
          startChildWorkflowExecutionInitiatedEventAttributes:
            event.startChildWorkflowExecutionInitiatedEventAttributes?.workflowType?.name ?? '',
        })) ?? [],
    now: new Date(),
  }
}

export default function HomeIndex({ loaderData }: Route.ComponentProps) {
  const { events, now } = loaderData
  const { data: session } = authClient.useSession()

  const revalidator = useRevalidator()
  useEffect(() => {
    const interval = setTimeout(() => revalidator.revalidate(), 5000)
    return () => clearTimeout(interval)
  }, [revalidator])

  return (
    <div className="flex flex-col items-stretch flex-auto">
      <header className="flex items-center justify-between bg-background z-20 p-6 shadow">
        <nav className="flex items-center gap-2">
          <span className="text-2xl font-bold">{pkg.displayName}</span>
        </nav>
        <nav className="flex items-center gap-2">
          <Button onClick={() => window.open('https://github.com/chalkpe/decelerator', '_blank')}>
            <ExternalLink />
            레포지토리
          </Button>
        </nav>
      </header>
      {session && (
        <article className="flex flex-col items-center p-6 shadow gap-4">
          <div className="flex items-center gap-2">
            <Avatar className="size-12">
              <AvatarImage src={session.user.image ?? ''} alt={session.user.name} />
            </Avatar>
            <div>
              <div className="text-lg font-semibold">{session.user.name}</div>
              <div className="text-sm text-muted-foreground">
                @{session.user.username}@{session.user.domain}
              </div>
            </div>
          </div>
          <div className="text-center break-keep text-balance">
            <div className="flex flex-row flex-wrap items-stretch justify-center gap-3">
              <NavLink to="/home/timeline" className="flex-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <Home className="inline" /> 반응 타임라인
                    </CardTitle>
                    <CardDescription>모든 반응을 시간순으로 확인할 수 있습니다.</CardDescription>
                  </CardHeader>
                </Card>
              </NavLink>
              <NavLink to="/home/posts" className="flex-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <Repeat2 className="inline" /> 부스트된 게시글
                    </CardTitle>
                    <CardDescription>부스트된 게시글의 반응을 각각 확인할 수 있습니다.</CardDescription>
                  </CardHeader>
                </Card>
              </NavLink>
            </div>
            <div className="mt-4">
              <Repeat2 className="inline size-6 mr-2 animate-spin" />
              처음 로그인하셨다면 데이터를 가져오는 데 시간이 걸릴 수 있습니다!
            </div>
          </div>
        </article>
      )}
      <div className="flex-auto">
        <AutoSizer>
          {({ width, height }) => (
            <List width={width} height={height} itemSize={60} itemCount={events.length}>
              {({ index, style }) => (
                <div key={events[index].eventId} style={style} className="flex flex-col items-center justify-end">
                  <div className="text-sm text-gray-500">
                    {formatDistance({ type: 'full', date: events[index].eventTime, now, suffix: '전', absoluteTooOld: true })}
                  </div>
                  {events[index].activityTaskScheduledEventAttributes && (
                    <strong>
                      {{
                        '': '뭔가',
                        findAccountsActivity: '계정 목록을',
                        findNotificationsActivity: '알림 목록을',
                      }[events[index].activityTaskScheduledEventAttributes] ?? '뭔가'}{' '}
                      확인 중입니다...
                    </strong>
                  )}
                  {events[index].timerStartedEventAttributes && <strong className="text-red-400">쉬는 중!</strong>}
                  {events[index].timerFiredEventAttributes && <strong>다시 시작합니다...</strong>}
                  {events[index].startChildWorkflowExecutionInitiatedEventAttributes && (
                    <strong>
                      {{
                        '': '뭔가',
                        fetchNotificationsWorkflow: '알림 동기화를',
                      }[events[index].startChildWorkflowExecutionInitiatedEventAttributes] ?? '뭔가'}{' '}
                      시작합니다...
                    </strong>
                  )}
                </div>
              )}
            </List>
          )}
        </AutoSizer>
      </div>
    </div>
  )
}
