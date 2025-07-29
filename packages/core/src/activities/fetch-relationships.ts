import { sleep } from '@temporalio/activity'
import { createRestAPIClient } from 'masto'

export interface FetchRelationshipsParams {
  domain: string
  accessToken: string
  accountIds: string[]
}

export interface FetchRelationshipsResult {
  relationships: Record<string, boolean>
}

export async function fetchRelationshipsActivity(params: FetchRelationshipsParams): Promise<FetchRelationshipsResult> {
  const { domain, accessToken, accountIds } = params

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const relationships = await masto.v1.accounts.relationships.fetch({ id: accountIds })

  await sleep('3 seconds')
  return { relationships: Object.fromEntries(relationships.map(({ id, following, followedBy }) => [id, following && followedBy])) }
}
