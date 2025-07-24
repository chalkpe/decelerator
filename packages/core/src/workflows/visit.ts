import type { StatusIndex } from '@decelerator/database'
import { log, proxyActivities, sleep } from '@temporalio/workflow'
import type * as findIndexActivities from '../activities/find-index'
import type * as listStatusesActivities from '../activities/list-statuses'
import type * as saveIndexActivities from '../activities/save-index'

const { listStatusesActivity: list } = proxyActivities<typeof listStatusesActivities>({
  heartbeatTimeout: '10 seconds',
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '5 minutes',
    nonRetryableErrorTypes: ['MastoHttpError'],
  },
})

const { findIndexActivity: find } = proxyActivities<typeof findIndexActivities>({
  startToCloseTimeout: '15 seconds',
})
const { saveIndexActivity: save } = proxyActivities<typeof saveIndexActivities>({
  startToCloseTimeout: '15 seconds',
})

export interface VisitWorkflowInput {
  domain: string
  accessToken: string
  accountId: string
  reblogId: string
  reblogCreatedAt: string // Never use Date directly in workflows
}

export async function visitWorkflow(input: VisitWorkflowInput): Promise<StatusIndex | null> {
  const { domain, accessToken, accountId, reblogId, reblogCreatedAt } = input

  while (true) {
    await sleep(1000)

    log.info('대상 계정이 작성한 대상 게시글의 부스트 인덱스를 찾습니다.')
    const reblogIndex = await find({ where: { domain, accountId, reblogId }, orderBy: { createdAt: 'desc' } })

    if (reblogIndex) {
      log.info('부스트 인덱스를 찾았습니다. 해당 인덱스의 생성 시간 이후에 대상 계정이 작성한 게시글 인덱스를 찾습니다.', { reblogIndex })
      const rightAfterReblogIndex = await find({
        where: { domain, accountId, reblogId: null, createdAt: { gt: reblogIndex.createdAt } },
        orderBy: { createdAt: 'asc' },
      })

      if (rightAfterReblogIndex) {
        log.info('게시글 인덱스가 존재합니다. 해당 인덱스를 반환합니다.')
        return rightAfterReblogIndex
      }
    }

    log.info('부스트 인덱스를 찾지 못했습니다. 대상 계정의 가장 오래된 인덱스와 가장 최근 인덱스를 찾습니다.')
    const [oldestIndex, newestIndex] = await Promise.all([
      find({ where: { domain, accountId }, orderBy: { createdAt: 'asc' } }),
      find({ where: { domain, accountId }, orderBy: { createdAt: 'desc' } }),
    ])

    if (oldestIndex && newestIndex) {
      log.info('가장 오래된 인덱스와 가장 최근 인덱스를 찾았습니다.', { oldestIndex, newestIndex })

      if (newestIndex.createdAt.toISOString() < reblogCreatedAt) {
        log.info('인덱스들이 부스트 시점보다 과거입니다. 가장 최근 인덱스부터 미래 방향으로 인덱스를 생성합니다.')
        await save(await list({ domain, accessToken, accountId, pagination: { minId: newestIndex.statusId } }))
        continue
      }

      if (oldestIndex.createdAt.toISOString() > reblogCreatedAt) {
        log.info('인덱스들이 부스트 시점보다 미래입니다. 가장 오래된 인덱스부터 과거 방향으로 인덱스를 생성합니다.')
        await save(await list({ domain, accessToken, accountId, pagination: { maxId: oldestIndex.statusId } }))
        continue
      }

      log.info('인덱스들이 부스트 시점에 걸쳐 있습니다. 부스트 시점 근처의 인덱스들을 찾습니다.')
      const [beforeReblogIndex, afterReblogIndex] = await Promise.all([
        find({ where: { domain, accountId, createdAt: { lt: reblogCreatedAt } }, orderBy: { createdAt: 'desc' } }),
        find({ where: { domain, accountId, createdAt: { gt: reblogCreatedAt } }, orderBy: { createdAt: 'asc' } }),
      ])

      if (beforeReblogIndex && afterReblogIndex) {
        log.info('부스트 시점 근처 인덱스들 사이 범위로 인덱스를 생성합니다.', { beforeReblogIndex, afterReblogIndex })
        await save(
          await list({
            domain,
            accessToken,
            accountId,
            pagination: { minId: beforeReblogIndex.statusId, maxId: afterReblogIndex.statusId },
          }),
        )
      }
    }

    log.info('인덱스가 없습니다. 대상 계정의 인덱스를 처음부터 생성합니다.')
    await save(await list({ domain, accessToken, accountId }))
  }
}
