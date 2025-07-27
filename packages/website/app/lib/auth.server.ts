import { prisma } from '@decelerator/database'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { genericOAuth } from 'better-auth/plugins'
import { scopes } from '~/lib/masto'
import pkg from '../../../../package.json'

export async function createAuth() {
  const apps = await prisma.app.findMany()
  return betterAuth({
    appName: pkg.name,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    user: {
      additionalFields: {
        domain: { type: 'string' },
        username: { type: 'string' },
        mastodonId: { type: 'string' },
      },
    },
    plugins: [
      genericOAuth({
        config: apps.map((app) => ({
          providerId: app.domain,
          clientId: app.clientId,
          clientSecret: app.clientSecret,
          scopes: scopes.split(' '),
          authorizationUrl: `https://${app.domain}/oauth/authorize`,
          tokenUrl: `https://${app.domain}/oauth/token`,
          redirectURI: app.redirectUri,
          userInfoUrl: `https://${app.domain}/api/v1/accounts/verify_credentials`,
          mapProfileToUser: (profile) => ({
            name: profile.display_name,
            email: `${profile.username}@${app.domain}`,
            image: profile.avatar,
            emailVerified: true,
            domain: app.domain,
            username: profile.username,
            mastodonId: profile.id,
          }),
        })),
      }),
    ],
  })
}
