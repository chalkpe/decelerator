import { prisma } from '@decelerator/database'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { type GenericOAuthConfig, genericOAuth } from 'better-auth/plugins'
import { api } from 'misskey-js'
import { permissions, scopes } from '~/lib/masto'
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
        config: apps.map(
          (app) =>
            ({
              providerId: app.domain,
              clientId: app.clientId,
              clientSecret: app.clientSecret,
              redirectURI: app.redirectUri,
              overrideUserInfo: true,
              ...(app.software === 'MISSKEY'
                ? ({
                    pkce: true,
                    scopes: permissions,
                    authorizationUrl: `https://${app.domain}/oauth/authorize`,
                    tokenUrl: `https://${app.domain}/oauth/token`,
                    getUserInfo: async ({ accessToken }) => {
                      const client = new api.APIClient({ origin: `https://${app.domain}`, credential: accessToken })
                      const i = await client.request('i', {})
                      return {
                        id: i.id,
                        name: i.name ?? i.username,
                        email: `${i.username}@${app.domain}`,
                        image: i.avatarUrl,
                        emailVerified: true,
                        createdAt: new Date(i.createdAt),
                        updatedAt: new Date(i.updatedAt ?? i.createdAt),
                        domain: app.domain,
                        username: i.username,
                        mastodonId: i.id,
                      }
                    },
                  } satisfies Partial<GenericOAuthConfig>)
                : ({
                    scopes: scopes.split(' '),
                    authorizationUrl: `https://${app.domain}/oauth/authorize`,
                    tokenUrl: `https://${app.domain}/oauth/token`,
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
                  } satisfies Partial<GenericOAuthConfig>)),
            }) satisfies GenericOAuthConfig,
        ),
      }),
    ],
  })
}
