import { zodResolver } from '@hookform/resolvers/zod'
import { createRestAPIClient } from 'masto'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Form as RouterForm, redirect, useNavigate, useSubmit } from 'react-router'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import createAuth from '~/lib/auth'
import { authClient } from '~/lib/auth-client'
import { createRedirectUri, scopes } from '~/lib/masto'
import prisma from '~/lib/prisma'
import pkg from '../../package.json'
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
      <div className="text-balance text-center text-xs text-muted-foreground">
        로그인함으로써{' '}
        <Link to="/terms" className="underline underline-offset-4 hover:text-primary">
          이용약관
        </Link>{' '}
        및{' '}
        <Link to="/privacy" className="underline underline-offset-4 hover:text-primary">
          개인정보 처리방침
        </Link>
        에 동의합니다.
      </div>
    </div>
  )
}

export async function action({ request }: Route.ActionArgs) {
  const result = formSchema.safeParse(Object.fromEntries(await request.formData()))
  if (!result.success) throw new Error('올바른 도메인을 입력하세요.')

  const { domain } = result.data
  let app = await prisma.app.findUnique({ where: { domain } })

  if (!app) {
    const redirectUri = createRedirectUri(domain)
    const masto = createRestAPIClient({ url: `https://${domain}` })
    const { clientId, clientSecret } = await masto.v1.apps.create({ clientName: pkg.name, scopes, redirectUris: redirectUri })

    if (!clientId || !clientSecret) throw new Error('앱 생성에 실패했습니다.')
    app = await prisma.app.create({ data: { domain, clientId, clientSecret, redirectUri } })
  }

  const auth = await createAuth()
  const { url } = await auth.api.signInWithOAuth2({ body: { providerId: app.domain, callbackURL: '/home' } })
  return redirect(url)
}
