import type { ServerSoftware } from '@decelerator/database'
import { MockActivityEnvironment } from '@temporalio/testing'
import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { server } from '../mocks/node.js'
import { fetchRelationshipsActivity } from './fetch-relationships.js'

describe('fetchRelationshipsActivity', () => {
  const activity = fetchRelationshipsActivity
  type ActivityResult = Awaited<ReturnType<typeof activity>>

  const accessToken = 'supersecret'
  const accountId = '12345abcde'

  describe('works with mastodon', () => {
    const domain = 'chalk.moe'
    const software = 'MASTODON' as const satisfies ServerSoftware

    const endpoint = `https://${domain}/api/v1/accounts/relationships`
    const response = {
      id: accountId,
      following: true,
      showingReblogs: true,
      notifying: false,
      languages: null,
      followedBy: true,
      blocking: false,
      blockedBy: false,
      muting: false,
      mutingNotifications: false,
      requested: false,
      requestedBy: false,
      domainBlocking: false,
      endorsed: false,
      note: '',
    }

    const matrix = [
      { following: true, followedBy: true, fromMutual: true }, // mutual
      { following: true, followedBy: false, fromMutual: false },
      { following: false, followedBy: true, fromMutual: false },
      { following: false, followedBy: false, fromMutual: false },
    ]

    test.concurrent.each(matrix)('following $following, followedBy $followedBy', async ({ following, followedBy, fromMutual }) => {
      server.use(http.get(endpoint, () => HttpResponse.json([{ ...response, following, followedBy }])))

      const env = new MockActivityEnvironment()
      const res = env.run(activity, { domain, software, accessToken, accountId })
      await expect(res).resolves.toMatchObject({ fromMutual } satisfies ActivityResult)
    })
  })
})
