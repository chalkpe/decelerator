import { taskQueue } from '@decelerator/core/constants'
import type { daemonWorkflow } from '@decelerator/core/workflows'
import { prisma } from '@decelerator/database'
import { ChevronUp, Home, Loader, Repeat2, User2 } from 'lucide-react'
import { NavLink, Outlet, redirect, useNavigate } from 'react-router'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from '~/components/ui/sidebar'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import { boostMap } from '~/lib/masto'
import { temporal } from '~/lib/temporal.server'
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

  return { software: app.software }
}

export default function HomeLayout({ loaderData }: Route.ComponentProps) {
  const { software } = loaderData

  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  const items = [
    { title: '반응 타임라인', url: '/home/timeline', icon: Home },
    { title: `${boostMap[software]}된 게시글`, url: '/home/posts', icon: Repeat2 },
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
                        <SidebarMenuButton>
                          {isPending ? <Loader className="animate-spin" /> : <item.icon />}
                          <span>{item.title}</span>
                        </SidebarMenuButton>
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
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <User2 /> {session?.user?.name}
                    <ChevronUp className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  <DropdownMenuItem onClick={() => authClient.signOut().then(() => navigate('/'))}>
                    <span>로그아웃</span>
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
