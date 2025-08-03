import type { ServerSoftware } from '@decelerator/database'
import { ExternalLink, Globe, Lock, Mail, Moon } from 'lucide-react'
import { Children, type ComponentProps, createContext, type FC, Fragment, type Key, useContext, useMemo } from 'react'
import { Avatar, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardTitle } from '~/components/ui/card'
import { ScrollArea, ScrollBar } from '~/components/ui/scroll-area'
import { useIsMobile } from '~/hooks/use-mobile'
import { boostMap, sanitizeContent } from '~/lib/masto'
import { cn, formatDistance } from '~/lib/utils'

type StatusCardContextValue = { status: PrismaJson.StatusIndexData; domain: string; software: ServerSoftware }
const StatusCardContext = createContext<StatusCardContextValue>({} as StatusCardContextValue)

function useStatusCard() {
  const context = useContext(StatusCardContext)
  if (!context) throw new Error('useStatusCard must be used within a StatusCardProvider')
  return context
}

const StatusCardTitle: FC<ComponentProps<'div'>> = ({ children, className, ...props }) => {
  const { status } = useStatusCard()
  const displayName = useMemo(() => sanitizeContent(status.account.displayName, status.account.emojis, 5), [status.account])

  return (
    <CardTitle className={cn('flex items-center gap-2 overflow-auto', className)} {...props}>
      <Avatar>
        <AvatarImage src={status.account.avatar} alt={status.account.displayName} />
      </Avatar>
      <div className="flex flex-row flex-wrap items-center gap-1 overflow-auto">
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */}
        <span className="max-w-full truncate" dangerouslySetInnerHTML={{ __html: displayName }} />
        <span className="max-w-full truncate text-muted-foreground text-sm">@{status.account.acct}</span>
      </div>
      {children}
    </CardTitle>
  )
}

const divider = (key: Key) => <Fragment key={key}>&nbsp;&middot;&nbsp;</Fragment>

const visibilityIconClassName = 'size-4 inline align-sub mr-0.5'
const visibilityMap = {
  public: {
    icon: <Globe className={visibilityIconClassName} />,
    label: '공개',
  },
  unlisted: {
    icon: <Moon className={visibilityIconClassName} />,
    label: '조용한 공개',
  },
  private: {
    icon: <Lock className={visibilityIconClassName} />,
    label: '팔로워',
  },
  direct: {
    icon: <Mail className={visibilityIconClassName} />,
    label: '개인 멘션',
  },
}

const VisibilityIcon: FC<{ visibility: PrismaJson.StatusIndexData['visibility'] }> = ({ visibility }) => {
  const isMobile = useIsMobile()
  const v = visibilityMap[visibility]
  return isMobile ? v.icon : [v.icon, ' ', v.label]
}

const StatusCardDescription: FC<ComponentProps<'div'>> = ({ children, ...props }) => {
  const { status } = useStatusCard()
  return (
    <CardDescription {...props}>
      <VisibilityIcon visibility={status.visibility} />
      {divider('divider-0')}
      <span suppressHydrationWarning>
        {formatDistance({ type: 'abbreviated', date: new Date(status.createdAt), suffix: '전에', absoluteTooOld: true })} 작성함
      </span>
      {Children.toArray(children).flatMap((child, index) => [divider(index), child])}
    </CardDescription>
  )
}

const StatusCardDescriptionWithTimeout: FC<ComponentProps<'div'> & { timeout: [Date, Date] }> = ({ timeout, children, ...props }) => {
  const { status, software } = useStatusCard()
  const [date, now] = [new Date(timeout[0]), new Date(timeout[1])]
  return (
    <CardDescription {...props}>
      <VisibilityIcon visibility={status.visibility} />
      {divider('divider-0')}
      <span suppressHydrationWarning>
        {formatDistance({ type: 'abbreviated', date, suffix: '전에', absoluteTooOld: true })} {boostMap[software]}함
      </span>
      {divider('divider-1')}
      <span>{formatDistance({ type: 'full', date, now, suffix: '후에', immediateText: '바로' })} 작성함</span>
      {Children.toArray(children).flatMap((child, index) => [divider(index), child])}
    </CardDescription>
  )
}

const StatusCardAction: FC<ComponentProps<'div'>> = ({ children, className, ...props }) => {
  const { status, domain, software } = useStatusCard()
  return (
    <CardAction className={cn('flex flex-row items-center gap-2', className)} {...props}>
      {domain && (
        <Button
          variant="outline"
          onClick={(e) => {
            e.preventDefault()
            switch (software) {
              case 'MASTODON':
                window.open(`https://${domain}/@${status.account.acct}/${status.id}`, '_blank')
                break
              case 'MISSKEY':
                window.open(`https://${domain}/notes/${status.id}`, '_blank')
                break
            }
          }}
        >
          <ExternalLink />
        </Button>
      )}
      {children}
    </CardAction>
  )
}

const StatusCardContent: FC<ComponentProps<'div'>> = ({ children, className, ...props }) => {
  const { status } = useStatusCard()

  const content = useMemo(() => sanitizeContent(status.content, status.emojis, 8), [status])
  const mediaAttachments = status.mediaAttachments.flatMap(({ url, ...media }) => (url ? [{ url, ...media }] : []))

  return (
    <CardContent className={cn('flex flex-col gap-6', className)} {...props}>
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */}
      <p className="prose break-all max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
      {mediaAttachments.length > 0 && (
        <ScrollArea>
          <div className="flex flex-nowrap gap-2">
            {mediaAttachments.map((media) => (
              <img
                key={media.id}
                src={media.url}
                alt={media.description ?? 'no alt'}
                className="h-24 aspect-video rounded-lg object-cover border border-muted"
                loading="lazy"
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      {children}
    </CardContent>
  )
}

const StatusCard: FC<ComponentProps<'div'> & StatusCardContextValue> = ({ status, domain, software, ...props }) => {
  const contextValue = useMemo<StatusCardContextValue>(() => ({ status, domain, software }), [status, domain, software])
  return (
    <StatusCardContext.Provider value={contextValue}>
      <Card {...props} />
    </StatusCardContext.Provider>
  )
}

export { StatusCard, StatusCardTitle, StatusCardDescription, StatusCardDescriptionWithTimeout, StatusCardAction, StatusCardContent }
