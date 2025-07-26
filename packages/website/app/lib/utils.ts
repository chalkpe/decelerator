import { getDateDistance, getDateDistanceText } from '@toss/date'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAbbreviatedTime(date: Date, now = new Date()) {
  const result = getDateDistanceText(getDateDistance(date, now), {
    hours: (t) => t.days === 0,
    minutes: (t) => t.days === 0 && t.hours === 0,
    seconds: (t) => t.days === 0 && t.hours === 0 && t.minutes === 0,
  })
  return result ? `${result} 전에` : '방금'
}

export function getFullTime(date: Date, now = new Date()) {
  const result = getDateDistanceText(getDateDistance(date, now))
  return result ? `${result} 후에` : '즉시'
}
