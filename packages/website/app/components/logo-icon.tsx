import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import pkg from '../../../../package.json'

const LogoIcon = ({ children = 'D', ...props }: React.ComponentProps<typeof Avatar>) => {
  return (
    <Avatar {...props}>
      <AvatarImage src="/logo_black.png" alt={`${pkg.displayName} 로고`} className="dark:hidden" />
      <AvatarImage src="/logo_white.png" alt={`${pkg.displayName} 로고`} className="hidden dark:block" />
      <AvatarFallback className="bg-transparent">{children}</AvatarFallback>
    </Avatar>
  )
}

export { LogoIcon }
