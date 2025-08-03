import { type FC, use } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { DropdownMenuCheckboxItem } from '~/components/ui/dropdown-menu'
import { authClient } from '~/lib/auth-client'

interface SessionChangerProps {
  promise: Promise<{ id: string; image: string; name: string; sessionToken: string }[]>
}

export const SessionChanger: FC<SessionChangerProps> = ({ promise }) => {
  if (typeof window === 'undefined') {
    throw new Error('SessionChanger can only be used in the browser')
  }

  const { data } = authClient.useSession()
  const sessions = use(promise)

  return (
    <>
      {sessions.map((session) => (
        <DropdownMenuCheckboxItem
          key={session.id}
          checked={session.id === data?.session.userId}
          onCheckedChange={async () => {
            await authClient.multiSession.setActive({ sessionToken: session.sessionToken })
            window.location.reload() // TODO: better way to refresh the session
          }}
        >
          <Avatar className="size-4">
            <AvatarImage src={session.image} alt={session.name} />
            <AvatarFallback>{session.name.charAt(0)}</AvatarFallback>
          </Avatar>
          {session.name}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  )
}
