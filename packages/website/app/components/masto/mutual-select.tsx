import { Star, UserRoundSearch, Users } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import type { MutualMode } from '~/stores/filter'

const MutualSelect = ({ mutualMode, setMutualMode }: { mutualMode: MutualMode; setMutualMode: (value: MutualMode) => void }) => {
  const options = [
    {
      label: (
        <>
          <Users /> 모두
        </>
      ),
      value: 'all',
    },
    {
      label: (
        <>
          <Star /> 툿친
        </>
      ),
      value: 'mutual',
    },
    {
      label: (
        <>
          <UserRoundSearch /> 탐넘
        </>
      ),
      value: 'foreigner',
    },
  ]

  return (
    <Select value={mutualMode} onValueChange={setMutualMode}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="선택" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value.toString()} value={option.value.toString()}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { MutualSelect }
