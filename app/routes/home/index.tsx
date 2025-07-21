import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { authClient } from '~/lib/auth-client'

export async function loader() {}

export default function Index() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && !session) {
      navigate('/')
    }
  }, [session, isPending, navigate])

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1 className="text-2xl font-bold">Welcome to the App!</h1>
      {session ? <p className="mt-4">Hello, {session.user.name || 'User'}!</p> : <p className="mt-4">You are not logged in.</p>}
    </main>
  )
}
