import { prisma } from '@decelerator/database'
import { heartbeat, sleep } from '@temporalio/activity'
import { createRestAPIClient, MastoHttpError } from 'masto'
import ms from 'ms'

export interface SyncIndexParams {
  domain: string
  accessToken: string
  accountId: string
  minId?: string
  maxId?: string
  limit?: ms.StringValue
}

export interface SyncIndexResult {
  rateLimitExceeded: boolean
}

export async function syncIndexActivity(params: SyncIndexParams): Promise<SyncIndexResult> {
  const { domain, accessToken, accountId, minId, maxId, limit = '10 years' } = params

  try {
    const past = new Date(Date.now() - ms(limit))
    const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
    const paginator = masto.v1.accounts.$select(accountId).statuses.list({ excludeReplies: true, excludeReblogs: false, minId, maxId })

    for await (const statuses of paginator) {
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
                domain,
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
      if (count < data.length) break
      if (data.some((s) => s.createdAt < past)) break

      heartbeat()
      await sleep(1000)
    }
  } catch (error) {
    if (error instanceof MastoHttpError && error.statusCode === 429) return { rateLimitExceeded: true }
    throw error
  }
  return { rateLimitExceeded: false }
}
