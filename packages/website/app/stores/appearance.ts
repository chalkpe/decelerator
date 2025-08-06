import { atomWithStorage } from 'jotai/utils'
import pkg from '../../package.json'

export type Theme = 'system' | 'light' | 'dark'

export const themeAtom = atomWithStorage<Theme>(`${pkg.name}/Theme`, 'system')
