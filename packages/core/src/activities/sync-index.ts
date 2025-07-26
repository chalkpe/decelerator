import { prisma } from '@decelerator/database'
import { sleep } from '@temporalio/activity'
import { createRestAPIClient } from 'masto'

export interface SyncIndexParams {
  domain: string
  accessToken: string
  accountId: string
  minId?: string
  maxId?: string
}

export async function syncIndexActivity(params: SyncIndexParams) {
  const { domain, accessToken, accountId, minId, maxId } = params

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const statuses = await masto.v1.accounts.$select(accountId).statuses.list({ excludeReplies: true, excludeReblogs: false, minId, maxId })

  const result = await prisma.statusIndex.createMany({
    skipDuplicates: true,
    data: statuses.flatMap((status) => [
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
    ]),
  })

  await sleep('3 seconds')
  return result
}
