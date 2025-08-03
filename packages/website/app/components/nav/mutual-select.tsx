import { Star, UserRoundSearch, Users } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { useIsMobile } from '~/hooks/use-mobile'
import type { MutualMode } from '~/stores/filter'

const MutualSelect = ({ mutualMode, setMutualMode }: { mutualMode: MutualMode; setMutualMode: (value: MutualMode) => void }) => {
  const isMobile = useIsMobile()

  const options = [
    {
      icon: <Users />,
      label: '모두',
      value: 'all',
    },
    {
      icon: <Star />,
      label: '연친',
      value: 'mutual',
    },
    {
      icon: <UserRoundSearch />,
      label: '탐넘',
      value: 'foreigner',
    },
  ]

  return (
    <Select value={mutualMode} onValueChange={setMutualMode}>
      <SelectTrigger className="w-full">
        {isMobile ? options.find((option) => option.value === mutualMode)?.icon : <SelectValue placeholder="선택" />}
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value.toString()} value={option.value.toString()}>
            {option.icon} {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function filterMutualMode(mutualMode: MutualMode, fromMutual: boolean): boolean {
  return mutualMode === 'all' || (mutualMode === 'mutual' && fromMutual) || (mutualMode === 'foreigner' && !fromMutual)
}

export { MutualSelect, filterMutualMode }
