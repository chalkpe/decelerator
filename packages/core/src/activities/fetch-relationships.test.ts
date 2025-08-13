import type { ServerSoftware } from '@decelerator/database'
import { MockActivityEnvironment } from '@temporalio/testing'
import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { server } from '../mocks/node.js'
import { fetchRelationshipsActivity } from './fetch-relationships.js'

describe('fetchRelationshipsActivity', () => {
  const activity = fetchRelationshipsActivity
  type ActivityResult = Awaited<ReturnType<typeof activity>>

  const domain = 'chalk.moe'
  const accessToken = 'supersecret'
  const accountId = '12345abcde'

  describe('works with mastodon', () => {
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

    test.concurrent.each(matrix)('$following, $followedBy', async ({ following, followedBy, fromMutual }) => {
      server.use(http.get(endpoint, () => HttpResponse.json([{ ...response, following, followedBy }])))

      const env = new MockActivityEnvironment()
      const res = env.run(activity, { domain, software, accessToken, accountId })
      await expect(res).resolves.toMatchObject({ fromMutual } satisfies ActivityResult)
    })
  })

  describe('works with misskey', () => {
    const software = 'MISSKEY' as const satisfies ServerSoftware
    const endpoint = `https://${domain}/api/users/relation`

    const response = {
      id: accountId,
      isFollowing: true,
      hasPendingFollowRequestFromYou: false,
      hasPendingFollowRequestToYou: false,
      isFollowed: true,
      isBlocking: false,
      isBlocked: false,
      isMuted: false,
      isRenoteMuted: false,
    }
    const matrix = [
      { isFollowing: true, isFollowed: true, fromMutual: true }, // mutual
      { isFollowing: true, isFollowed: false, fromMutual: false },
      { isFollowing: false, isFollowed: true, fromMutual: false },
      { isFollowing: false, isFollowed: false, fromMutual: false },
    ]

    test.concurrent.each(matrix)('$isFollowing, $isFollowed', async ({ isFollowing, isFollowed, fromMutual }) => {
      server.use(http.post(endpoint, () => HttpResponse.json({ ...response, isFollowing, isFollowed })))

      const env = new MockActivityEnvironment()
      const res = env.run(activity, { domain, software, accessToken, accountId })
      await expect(res).resolves.toMatchObject({ fromMutual } satisfies ActivityResult)
    })
  })
})
