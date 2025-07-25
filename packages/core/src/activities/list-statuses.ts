import type { StatusIndexCreateManyInput } from '@decelerator/database'
import { heartbeat, log, sleep } from '@temporalio/activity'
import { createRestAPIClient, MastoHttpError } from 'masto'
import ms from 'ms'

export interface ListStatusesParams {
  domain: string
  accessToken: string
  accountId: string
  pagination?: { minId?: string; maxId?: string }
  limit?: ms.StringValue
}

export interface ListStatusesResult {
  indicies: StatusIndexCreateManyInput[]
  rateLimitExceeded: boolean
}

export async function listStatusesActivity(params: ListStatusesParams): Promise<ListStatusesResult> {
  const { domain, accessToken, accountId, pagination, limit = '30 days' } = params
  log.info('Fetching statuses', { domain, accountId, pagination, limit })

  const past = Date.now() - ms(limit)
  const indicies: ListStatusesResult['indicies'] = []

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const paginator = masto.v1.accounts.$select(accountId).statuses.list({ ...pagination, excludeReplies: true, excludeReblogs: false })

  try {
    for await (const statuses of paginator) {
      log.info('Fetched statuses', { count: statuses.length })
      indicies.push(
        ...statuses.flatMap((status) => [
          {
            domain,
            statusId: status.id,
            createdAt: new Date(status.createdAt),
            accountId: status.account.id,
            reblogId: status.reblog?.id ?? null,
          },
          ...(status.reblog
            ? [
                {
                  domain: status.reblog.account.acct.includes('@') ? status.reblog.account.acct.split('@')[1] : domain,
                  statusId: status.reblog.id,
                  createdAt: new Date(status.reblog.createdAt),
                  accountId: status.reblog.account.id,
                  reblogId: null,
                },
              ]
            : []),
        ]),
      )

      if (indicies.some((n) => new Date(n.createdAt).getTime() < past)) {
        log.info('Reached past limit, stopping fetching notifications', { past })
        break
      }

      await sleep(1000)
      heartbeat()
    }
  } catch (error) {
    if (error instanceof MastoHttpError && error.statusCode === 429) {
      log.warn('Rate limit exceeded', { domain })
      return { indicies, rateLimitExceeded: true }
    }
    throw error
  }

  log.info('Finished fetching statuses', { count: indicies.length })
  return { indicies, rateLimitExceeded: false }
}
