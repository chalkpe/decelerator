import { type FC, use } from 'react'
import { useNavigate } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { authClient } from '~/lib/auth-client'

interface HomeSessionSelectorProps {
  promise: Promise<{ id: string; image: string; name: string; sessionToken: string }[]>
}

export const HomeSessionSelector: FC<HomeSessionSelectorProps> = ({ promise }) => {
  if (typeof window === 'undefined') {
    throw new Error('HomeSessionSelector can only be used in the browser')
  }

  const navigate = useNavigate()
  const sessions = use(promise)
  if (sessions.length === 0) return null

  return (
    <>
      <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
        <span className="relative z-10 bg-background px-2 text-muted-foreground">기존 계정으로 로그인</span>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {sessions.map((session) => (
          <Button
            key={session.id}
            variant="outline"
            className="flex items-center gap-2 h-14"
            onClick={async (e) => {
              e.preventDefault()
              await authClient.multiSession.setActive({ sessionToken: session.sessionToken })
              navigate('/home')
            }}
          >
            <Avatar>
              <AvatarImage src={session.image} alt={session.name} />
              <AvatarFallback>{session.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </Button>
        ))}
      </div>
    </>
  )
}
