import { taskQueue } from '@decelerator/core/constants'
import type { daemonWorkflow } from '@decelerator/core/workflows'
import { prisma } from '@decelerator/database'
import { useAtomValue } from 'jotai'
import { ChevronUp, Home, Loader, LogOut, Plus, Repeat2 } from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet, redirect, useNavigate } from 'react-router'
import { SessionChanger } from '~/components/session-changer'
import { Avatar, AvatarImage } from '~/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from '~/components/ui/sidebar'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import { boostMap } from '~/lib/masto'
import { temporal } from '~/lib/temporal.server'
import { timelineSortByAtom } from '~/stores/filter'
import pkg from '../../../../../package.json'
import type { Route } from './+types/layout'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const app = await prisma.app.findUnique({ where: { domain: session.user.domain } })
  if (!app) return redirect('/')

  await temporal.workflow.start<typeof daemonWorkflow>('daemonWorkflow', {
    taskQueue,
    workflowId: `daemon-${app.domain}`,
    workflowIdConflictPolicy: 'USE_EXISTING',
    args: [{ domain: app.domain, software: app.software }],
  })

  const { domain, mastodonId: userId } = session.user

  const [timelineCount, postsCount] = await Promise.all([
    prisma.userReaction.count({
      where: { domain, status: { accountId: userId } },
    }),
    prisma.statusIndex.count({
      where: { domain, accountId: userId, referenced: { some: {} } },
    }),
  ])

  return { software: app.software, timelineCount, postsCount }
}

export default function HomeLayout({ loaderData }: Route.ComponentProps) {
  const { software, timelineCount, postsCount } = loaderData

  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  const sortBy = useAtomValue(timelineSortByAtom)
  const items = [
    { title: '반응 타임라인', url: '/home/timeline', icon: Home, count: timelineCount },
    { title: `${boostMap[software]}된 게시글`, url: `/home/posts/${sortBy}`, icon: Repeat2, count: postsCount },
  ]

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{pkg.displayName}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavLink to={item.url}>
                      {({ isPending }) => (
                        <>
                          <SidebarMenuButton>
                            {isPending ? <Loader className="animate-spin" /> : <item.icon />}
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                          <SidebarMenuBadge>{item.count.toLocaleString()}</SidebarMenuBadge>
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild style={{ padding: '0 !important' }}>
                  <SidebarMenuButton>
                    <Avatar>
                      <AvatarImage src={session?.user?.image ?? ''} alt={session?.user?.name ?? 'User Avatar'} />
                    </Avatar>
                    {session?.user?.name}
                    <ChevronUp className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  <DropdownMenuItem onClick={() => navigate('/')}>
                    <span>
                      <Plus className="mr-2 inline" />
                      계정 추가
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <Suspense
                    fallback={
                      <DropdownMenuItem disabled>
                        <span>
                          <Loader className="mr-2 inline animate-spin" />
                          계정 불러오는 중...
                        </span>
                      </DropdownMenuItem>
                    }
                  >
                    <SessionChanger
                      promise={authClient.multiSession.listDeviceSessions().then(({ data, error }) =>
                        error
                          ? []
                          : data.map((session) => ({
                              id: session.user.id,
                              name: session.user.name,
                              image: session.user.image ?? '',
                              sessionToken: session.session.token,
                            })),
                      )}
                    />
                  </Suspense>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => authClient.signOut().then(() => navigate('/'))}>
                    <span>
                      <LogOut className="mr-2 inline" />
                      전부 로그아웃
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="max-w-full max-h-screen overflow-x-auto">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
