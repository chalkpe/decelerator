import { RefreshCw } from 'lucide-react'
import { useRevalidator } from 'react-router'
import { Button } from '~/components/ui/button'
import { useFlush } from '~/hooks/use-flush'
import { cn } from '~/lib/utils'

const FlushButton = () => {
  const { current, flush } = useFlush()
  const revalidator = useRevalidator()

  return (
    <Button
      onClick={() => {
        flush()
        revalidator.revalidate()
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
