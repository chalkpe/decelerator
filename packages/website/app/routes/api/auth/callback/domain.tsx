import { createAuth } from '~/lib/auth.server'
import type { Route } from './+types/domain'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  return await auth.handler(request)
}

export async function action({ request }: Route.ActionArgs) {
  const auth = await createAuth()
  return await auth.handler(request)
}
