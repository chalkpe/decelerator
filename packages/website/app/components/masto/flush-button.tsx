import { RefreshCw } from 'lucide-react'
import { useRevalidator } from 'react-router'
import type InfiniteLoader from 'react-window-infinite-loader'
import { Button } from '~/components/ui/button'
import { useFlush } from '~/hooks/use-flush'
import { cn } from '~/lib/utils'

interface FlushButtonProps {
  infiniteLoaderRef: React.RefObject<InfiniteLoader | null>
}

const FlushButton = ({ infiniteLoaderRef }: FlushButtonProps) => {
  const { current, flush } = useFlush()
  const revalidator = useRevalidator()

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
      {current.length > 0 ? <span>새로고침 (+{current.length})</span> : <span>새로고침</span>}
    </Button>
  )
}

export { FlushButton }
