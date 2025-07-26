import { prisma } from '@decelerator/database'
import { heartbeat, log, sleep } from '@temporalio/activity'
import { createRestAPIClient, MastoHttpError } from 'masto'
import ms from 'ms'

export interface SyncIndexParams {
  domain: string
  accessToken: string
  accountId: string
  limit?: ms.StringValue
}

export interface SyncIndexResult {
  rateLimitExceeded: boolean
}

export async function syncIndexActivity(params: SyncIndexParams): Promise<SyncIndexResult> {
  const { domain, accessToken, accountId, limit = '30 days' } = params
  log.info('Fetching data', { domain, accountId, limit })

  const past = Date.now() - ms(limit)
  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const paginator = masto.v1.accounts.$select(accountId).statuses.list({ excludeReplies: true, excludeReblogs: false })

  try {
    for await (const statuses of paginator) {
      log.info('Fetched data', { count: statuses.length })

      const data = statuses.flatMap((status) => [
        {
          domain,
          statusId: status.id,
          createdAt: new Date(status.createdAt),
          accountId: status.account.id,
          reblogId: status.reblog?.id ?? null,
          data: status,
        },
        ...(status.reblog
          ? [
              {
                domain: status.reblog.account.acct.includes('@') ? status.reblog.account.acct.split('@')[1] : domain,
                statusId: status.reblog.id,
                createdAt: new Date(status.reblog.createdAt),
                accountId: status.reblog.account.id,
                reblogId: null,
                data: status,
              },
            ]
          : []),
      ])

      const { count } = await prisma.statusIndex.createMany({ data, skipDuplicates: true })
      if (count < data.length) {
        log.info('Existing data found, stopping fetch', { count })
        break
      }

      if (statuses.some((n) => new Date(n.createdAt).getTime() < past)) {
        log.info('Reached past limit, stopping fetch', { past })
        break
      }

      heartbeat()
      await sleep(1000)
    }
  } catch (error) {
    if (error instanceof MastoHttpError && error.statusCode === 429) {
      log.warn('Rate limit exceeded', { domain })
      return { rateLimitExceeded: true }
    }
    throw error
  }
  return { rateLimitExceeded: false }
}
