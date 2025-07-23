import createAuth from '~/lib/auth'
import type { Route } from './+types/catch'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  return await auth.handler(request)
}

export async function action({ request }: Route.ActionArgs) {
  const auth = await createAuth()
  return await auth.handler(request)
}
