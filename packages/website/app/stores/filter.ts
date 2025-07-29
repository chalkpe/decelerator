import { atomWithStorage } from 'jotai/utils'
import pkg from '../../package.json'

export type MutualMode = 'all' | 'mutual' | 'foreigner'
export type TimelineSortBy = 'createdAt' | 'boost'

export const timeoutAtom = atomWithStorage<number>(`${pkg.name}/Timeout`, 1000 * 60 * 2)
export const mutualModeAtom = atomWithStorage<MutualMode>(`${pkg.name}/MutualMode`, 'mutual')
export const timelineSortByAtom = atomWithStorage<TimelineSortBy>(`${pkg.name}/TimelineSortBy`, 'createdAt')
