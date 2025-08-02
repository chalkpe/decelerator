import type { ServerSoftware } from '@decelerator/database'
import { sleep } from '@temporalio/activity'
import { createRestAPIClient } from 'masto'
import { api } from 'misskey-js'

export interface FetchRelationshipsParams {
  domain: string
  software: ServerSoftware
  accessToken: string
  accountId: string
}

export interface FetchRelationshipsResult {
  fromMutual: boolean
}

export async function fetchRelationshipsActivity(params: FetchRelationshipsParams): Promise<FetchRelationshipsResult> {
  const { domain, software, accessToken, accountId } = params

  switch (software) {
    case 'MASTODON': {
      const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
      const relationships = await masto.v1.accounts.relationships.fetch({ id: [accountId] })

      const target = relationships.find((r) => r.id === accountId)
      const fromMutual = target ? target.following && target.followedBy : false

      await sleep('3 seconds')
      return { fromMutual }
    }

    case 'MISSKEY': {
      const client = new api.APIClient({ origin: `https://${domain}`, credential: accessToken })
      const relationships = await client.request('users/relation', { userId: accountId })

      const target = (Array.isArray(relationships) ? relationships : [relationships]).find((r) => r.id === accountId)
      const fromMutual = target ? target.isFollowing && target.isFollowed : false

      await sleep('3 seconds')
      return { fromMutual }
    }
  }
}
