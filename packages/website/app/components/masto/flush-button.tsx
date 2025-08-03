import { RefreshCw } from 'lucide-react'
import { useRevalidator } from 'react-router'
import type InfiniteLoader from 'react-window-infinite-loader'
import { Button } from '~/components/ui/button'
import { useFlush } from '~/hooks/use-flush'
import { useIsMobile } from '~/hooks/use-mobile'
import { cn } from '~/lib/utils'

interface FlushButtonProps {
  infiniteLoaderRef: React.RefObject<InfiniteLoader | null>
}

const FlushButton = ({ infiniteLoaderRef }: FlushButtonProps) => {
  const { current, flush } = useFlush()
  const revalidator = useRevalidator()
  const isMobile = useIsMobile()

  return (
    <Button
      onClick={async () => {
        flush()
        await revalidator.revalidate()
        infiniteLoaderRef.current?.resetloadMoreItemsCache(true)
      }}
      disabled={revalidator.state !== 'idle'}
      className={cn(current.length > 0 && 'animate-pulse')}
    >
      <RefreshCw />
      {isMobile && current.length > 0 && <span>+{current.length}</span>}
      {!isMobile && current.length > 0 && <span>새로고침 (+{current.length})</span>}
      {!isMobile && current.length === 0 && <span>새로고침</span>}
    </Button>
  )
}

export { FlushButton }
