import { getDateDistance, getDateDistanceText } from '@toss/date'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRelativeTime(date: Date, now: Date = new Date()) {
  return getDateDistanceText(getDateDistance(date, now), {
    hours: (t) => t.days === 0,
    minutes: (t) => t.days === 0 && t.hours === 0,
    seconds: (t) => t.days === 0 && t.hours === 0 && t.minutes === 0,
  })
}
