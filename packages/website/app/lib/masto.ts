import type { ServerSoftware } from '@decelerator/database'
import sanitize from 'sanitize-html'

/** Mastodon 권한 */
export const scopes = 'read'

/** Misskey 권한 */
export const permissions = ['read:account', 'read:notifications', 'read:following']

export const boostMap: Record<ServerSoftware, string> = {
  MASTODON: '부스트',
  MISSKEY: '리노트',
}

export const createRedirectUri = (domain: string) => `${import.meta.env.VITE_REDIRECT_URL}/api/auth/oauth2/callback/${domain}`

export const sanitizeContent = (content: string, emojis?: PrismaJson.CustomEmoji[], size = 6) =>
  emojis?.length
    ? sanitize(content).replace(/:([a-z0-9_]+):/gi, (match) => {
        const emoji = emojis.find((emoji) => emoji.shortcode === match.slice(1, -1))
        return emoji ? `<img class="inline h-${size} aspect-auto not-prose" src="${emoji.url}" alt="${emoji.shortcode}" />` : match
      })
    : sanitize(content)
