import { ChevronUp } from 'lucide-react'
import type { RefObject } from 'react'
import type { VariableSizeList as List } from 'react-window'

interface ScrollToTopButtonProps {
  listRef: RefObject<List | null>
}

export const ScrollToTopButton = ({ listRef }: ScrollToTopButtonProps) => {
  return (
    <div className="fixed bottom-10 right-10 z-10 flex gap-4 items-center justify-center">
      <button
        type="button"
        onClick={() => listRef.current?.scrollToItem(0, 'start')}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-card border shadow-lg opacity-50"
      >
        <ChevronUp className="h-7 w-7 text-card-foreground" />
        <span className="sr-only">맨 위로 스크롤</span>
      </button>
    </div>
  )
}
