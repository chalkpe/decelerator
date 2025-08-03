import { ClockArrowDown, Repeat2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { useIsMobile } from '~/hooks/use-mobile'
import type { TimelineSortBy } from '~/stores/filter'

interface TimelineSortBySelectProps {
  sortBy: TimelineSortBy
  setSortBy: (value: TimelineSortBy) => void
}

const TimelineSortBySelect = ({ sortBy, setSortBy }: TimelineSortBySelectProps) => {
  const isMobile = useIsMobile()

  const options = [
    {
      icon: <ClockArrowDown />,
      label: '최신순',
      value: 'createdAt' satisfies TimelineSortBy,
    },
    {
      icon: <Repeat2 />,
      label: '인기순',
      value: 'boost' satisfies TimelineSortBy,
    },
  ]

  return (
    <Select value={sortBy} onValueChange={(s) => setSortBy(s as TimelineSortBy)}>
      <SelectTrigger>
        {isMobile ? options.find((option) => option.value === sortBy)?.icon : <SelectValue placeholder="선택" />}
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

export { TimelineSortBySelect }
