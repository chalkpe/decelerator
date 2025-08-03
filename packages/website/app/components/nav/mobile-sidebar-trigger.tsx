import { MenuIcon } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { useSidebar } from '~/components/ui/sidebar'

export const MobileSidebarTrigger = () => {
  const { isMobile, toggleSidebar } = useSidebar()

  if (!isMobile) return null
  return (
    <Button variant="ghost" size="icon" className="size-9" onClick={toggleSidebar}>
      <MenuIcon />
    </Button>
  )
}
