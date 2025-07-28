import type { CustomEmoji } from 'masto/mastodon/entities/v1/custom-emoji.js'
import sanitize from 'sanitize-html'

export const scopes = 'read'

export const createRedirectUri = (domain: string) => `${import.meta.env.VITE_REDIRECT_URL}/api/auth/oauth2/callback/${domain}`

export const sanitizeContent = (content: string, emojis?: CustomEmoji[], size = 6) =>
  emojis?.length
    ? sanitize(content).replace(/:([a-z0-9_]+):/gi, (match) => {
        const emoji = emojis.find((emoji) => emoji.shortcode === match.slice(1, -1))
        return emoji ? `<img class="inline h-${size} aspect-auto not-prose" src="${emoji.url}" alt="${emoji.shortcode}" />` : match
      })
    : sanitize(content)
