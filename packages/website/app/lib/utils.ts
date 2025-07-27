import { getDateDistance, getDateDistanceText } from '@toss/date'
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
}

export function formatDistance({ type, date, now = new Date(), suffix, immediateText = '방금' }: FormatDistanceOptions) {
  const result = getDateDistanceText(
    getDateDistance(date, now),
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
