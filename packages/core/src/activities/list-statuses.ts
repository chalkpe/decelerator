import type { StatusIndexCreateManyInput } from '@decelerator/database'
import { heartbeat, log, sleep } from '@temporalio/activity'
import { createRestAPIClient, MastoHttpError } from 'masto'

export interface ListStatusesParams {
  domain: string
  accessToken: string
  accountId: string
  pagination?: { minId?: string; maxId?: string }
}

export interface ListStatusesResult {
  indicies: StatusIndexCreateManyInput[]
  rateLimitExceeded: boolean
}

export async function listStatusesActivity(params: ListStatusesParams): Promise<ListStatusesResult> {
  const indicies: ListStatusesResult['indicies'] = []
  const { domain, accessToken, accountId, pagination } = params
  log.info('Fetching statuses', { accountId, domain, pagination })

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const paginator = masto.v1.accounts.$select(accountId).statuses.list({ ...pagination, excludeReplies: true, excludeReblogs: false })

  try {
    for await (const statuses of paginator) {
      log.info('Fetched statuses', { count: statuses.length, accountId, domain })
      indicies.push(
        ...statuses.flatMap((status) => [
          {
            domain,
            statusId: status.id,
            accountId: status.account.id,
            visibility: status.visibility,
            reblogId: status.reblog?.id ?? null,
            createdAt: new Date(status.createdAt),
          },
          ...(status.reblog
            ? [
                {
                  domain: status.reblog.account.acct.includes('@') ? status.reblog.account.acct.split('@')[1] : domain,
                  statusId: status.reblog.id,
                  accountId: status.reblog.account.id,
                  visibility: status.reblog.visibility,
                  reblogId: null,
                  createdAt: new Date(status.reblog.createdAt),
                },
              ]
            : []),
        ]),
      )

      await sleep(1000)
      heartbeat()
    }
  } catch (error) {
    if (error instanceof MastoHttpError && error.statusCode === 429) {
      log.warn('Rate limit exceeded', { accountId, domain })
      return { indicies, rateLimitExceeded: true }
    }
    throw error
  }

  log.info('Finished fetching statuses', { accountId, domain, count: indicies.length })
  return { indicies, rateLimitExceeded: false }
}
