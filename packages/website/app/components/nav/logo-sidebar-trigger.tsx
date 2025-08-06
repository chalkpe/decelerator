import { MenuIcon } from 'lucide-react'
import { LogoIcon } from '~/components/logo-icon'
import { Button } from '~/components/ui/button'
import { useSidebar } from '~/components/ui/sidebar'

export const LogoSidebarTrigger = () => {
  const { toggleSidebar } = useSidebar()

  return (
    <Button variant="ghost" size="icon" className="size-9" onClick={toggleSidebar}>
      <LogoIcon className="size-7">
        <MenuIcon />
      </LogoIcon>
    </Button>
  )
}
