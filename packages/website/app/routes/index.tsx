import { prisma } from '@decelerator/database'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRestAPIClient } from 'masto'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Form as RouterForm, redirect, useNavigate, useSubmit } from 'react-router'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import { createRedirectUri, scopes } from '~/lib/masto'
import pkg from '../../../../package.json'
import type { Route } from './+types'

const formSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1, '도메인을 입력하세요.')
    .regex(/^[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})+$/, '유효하지 않은 도메인입니다.'),
})

export default function Home() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  const form = useForm<z.infer<typeof formSchema>>({
    mode: 'onSubmit',
    resolver: zodResolver(formSchema),
    defaultValues: { domain: '' },
  })

  useEffect(() => {
    if (!isPending && session) navigate('/home')
  }, [session, isPending, navigate])

  const submit = useSubmit()
  const onSubmit = form.handleSubmit(async (_, event) => {
    if (event?.target) await submit(event.target)
  })

  return (
    <div className="flex flex-col gap-6 min-h-svh items-center justify-center p-6 md:p-10 bg-muted">
      <div className="w-full max-w-sm border rounded-lg bg-background">
        <div className="flex flex-col gap-6">
          <Form {...form}>
            <RouterForm method="post" onSubmit={onSubmit} className="p-6 md:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">{pkg.displayName}</h1>
                  <p className="text-balance text-muted-foreground">{pkg.description}</p>
                </div>
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>서버</FormLabel>
                      <FormControl>
                        <Input placeholder="chalk.moe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  로그인
                </Button>
              </div>
            </RouterForm>
          </Form>
        </div>
      </div>
      <footer className="flex flex-col gap-2">
        <div className="text-balance text-center text-xs text-muted-foreground">
          현재{' '}
          <a href="https://joinmastodon.org/" className="underline underline-offset-4 hover:text-primary">
            마스토돈
          </a>{' '}
          및{' '}
          <a href="https://misskey-hub.net" className="underline underline-offset-4 hover:text-primary">
            미스키
          </a>{' '}
          서버를 지원합니다.
          <br />
        </div>
        <div className="text-balance text-center text-xs text-muted-foreground">
          <a href={pkg.repository.url} className="underline underline-offset-4 hover:text-primary">
            GitHub
          </a>
          에서 소스코드를 확인하거나 기여할 수 있습니다.
        </div>
      </footer>
    </div>
  )
}

const nodeinfoProtocolSchema = z.object({
  links: z.array(z.object({ rel: z.string(), href: z.url() })),
})

const nodeinfoSchema = z.object({
  software: z.object({ name: z.string(), version: z.string() }),
  metadata: z.object({ nodeName: z.string() }),
})

async function prepareApp(domain: string) {
  const existingApp = await prisma.app.findUnique({ where: { domain } })
  if (existingApp) return existingApp

  const protocol = nodeinfoProtocolSchema.safeParse(await fetch(`https://${domain}/.well-known/nodeinfo`).then((res) => res.json()))
  if (!protocol.success) throw new Error('서버 정보를 확인할 수 없습니다.')

  const link = protocol.data.links.find((link) => link.rel === 'http://nodeinfo.diaspora.software/ns/schema/2.0')
  if (!link) throw new Error('지원하지 않는 서버입니다. Nodeinfo 2.0을 제공하지 않습니다.')

  const nodeinfo = nodeinfoSchema.safeParse(await fetch(link.href).then((res) => res.json()))
  if (!nodeinfo.success) throw new Error('지원하지 않는 서버입니다. Nodeinfo 2.0 파싱에 실패했습니다.')

  const originUrl = `https://${domain}`
  const redirectUri = createRedirectUri(domain)

  switch (nodeinfo.data.software.name) {
    case 'mastodon': {
      const masto = createRestAPIClient({ url: originUrl })

      const { clientId, clientSecret } = await masto.v1.apps.create({ clientName: pkg.displayName, scopes, redirectUris: redirectUri })
      if (!clientId || !clientSecret) throw new Error('앱 생성에 실패했습니다.')

      return await prisma.app.create({ data: { domain, software: 'MASTODON', clientId, clientSecret, redirectUri } })
    }

    case 'misskey':
    case 'cherrypick': {
      return await prisma.app.create({ data: { domain, software: 'MISSKEY', clientId: redirectUri, clientSecret: '', redirectUri } })
    }

    default:
      throw new Error('지원하지 않는 서버입니다. 마스토돈 또는 미스키 서버만 지원합니다.')
  }
}

export async function action({ request }: Route.ActionArgs) {
  const result = formSchema.safeParse(Object.fromEntries(await request.formData()))
  if (!result.success) throw new Error('올바른 도메인을 입력하세요.')

  const domain = result.data.domain.trim().toLowerCase()
  const app = await prepareApp(domain)

  const auth = await createAuth()
  const { url } = await auth.api.signInWithOAuth2({ body: { providerId: app.domain, callbackURL: '/home' } })
  return redirect(url)
}
