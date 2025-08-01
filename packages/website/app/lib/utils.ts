import { getDateDistance, getDateDistanceText, kstFormat } from '@toss/date'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface FormatDistanceOptions {
  type: 'abbreviated' | 'full'
  date: Date
  now?: Date
  suffix: string
  immediateText?: string
  absoluteTooOld?: boolean
}

export function formatDistance({
  type,
  date,
  now = new Date(),
  suffix,
  immediateText = '방금',
  absoluteTooOld = false,
}: FormatDistanceOptions) {
  const distance = getDateDistance(date, now)
  if (absoluteTooOld && distance.days >= 14) return kstFormat(date, 'yyyy년 M월 d일에')

  const result = getDateDistanceText(
    distance,
    type === 'abbreviated'
      ? {
          hours: (t) => t.days === 0,
          minutes: (t) => t.days === 0 && t.hours === 0,
          seconds: (t) => t.days === 0 && t.hours === 0 && t.minutes === 0,
        }
      : undefined,
  )

  return result ? `${result} ${suffix}` : immediateText
}
