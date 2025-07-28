import { Clock4 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

const TimeoutSelect = ({ timeout, setTimeout }: { timeout: number; setTimeout: (value: number) => void }) => {
  const options = [
    { label: '30초', value: 1000 * 30 },
    { label: '1분', value: 1000 * 60 },
    { label: '2분', value: 1000 * 60 * 2 },
    { label: '5분', value: 1000 * 60 * 5 },
    { label: '10분', value: 1000 * 60 * 10 },
  ]

  return (
    <Select value={timeout.toString()} onValueChange={(value) => setTimeout(Number(value))}>
      <Tooltip>
        <TooltipTrigger>
          <SelectTrigger className="w-full">
            <Clock4 /> <SelectValue placeholder="선택" />
          </SelectTrigger>
        </TooltipTrigger>
        <TooltipContent>
          내 글에 대한 반응이라고 단정할 수 있는 최대 지연 기간입니다.
          <br /> 1분으로 설정하면, 내 글을 부스트하고 1분 이내로 작성된 글만 표시됩니다.
        </TooltipContent>
      </Tooltip>
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

export { TimeoutSelect }
