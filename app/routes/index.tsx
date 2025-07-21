import { createRestAPIClient } from 'masto'
import { useEffect } from 'react'
import { Form, redirect, useNavigate } from 'react-router'
import createAuth from '~/lib/auth'
import { authClient } from '~/lib/auth-client'
import { createRedirectUri, scopes } from '~/lib/masto'
import prisma from '~/lib/prisma'
import pkg from '../../package.json'
import type { Route } from './+types'

export default function Home() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && session) {
      navigate('/home')
    }
  }, [session, isPending, navigate])

  return (
    <main>
      <Form method="post">
        <input name="username" type="text" placeholder="사용자명" />
        <input name="domain" type="text" placeholder="도메인" />
        <input type="submit" value="제출" />
      </Form>
    </main>
  )
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()

  const username = formData.get('username')
  const domain = formData.get('domain')

  if (typeof username !== 'string' || typeof domain !== 'string') {
    throw new Error('유효하지 않은 입력입니다.')
  }

  let app = await prisma.app.findUnique({ where: { domain } })
  if (!app) {
    const redirectUri = createRedirectUri(domain)
    const masto = createRestAPIClient({ url: `https://${domain}` })
    const { clientId, clientSecret } = await masto.v1.apps.create({ clientName: pkg.name, scopes, redirectUris: redirectUri })

    if (!clientId || !clientSecret) throw new Error('앱 생성에 실패했습니다.')
    app = await prisma.app.create({ data: { domain, clientId, clientSecret, redirectUri } })
  }

  const auth = await createAuth()
  const response = await auth.api.signInWithOAuth2({ body: { providerId: app.domain, callbackURL: '/home' } })
  return redirect(response.url)
}
