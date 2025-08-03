import type { ServerSoftware } from '@decelerator/database'
import { continueAsNew, defineUpdate, executeChild, proxyActivities, setHandler, workflowInfo } from '@temporalio/workflow'
import Denque from 'denque'
import ms from 'ms'
import type * as findAccountsActivities from '../activities/find-accounts.js'
import type * as findNotificationsActivities from '../activities/find-notifications.js'
import { maxReactionDelay } from '../constants.js'
import type { fetchNotificationsWorkflow } from './fetch-notifications.js'
import type { fetchReactionWorkflow } from './fetch-reaction.js'

const { findAccountsActivity: findAccounts } = proxyActivities<typeof findAccountsActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { findNotificationsActivity: findNotifications } = proxyActivities<typeof findNotificationsActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})

export type DaemonQueueItem = { userId: string; notificationId: string }

export type FlushUpdateArgs = [{ userId: string }]
export type FlushUpdateResult = DaemonQueueItem[]

export const flush = defineUpdate<FlushUpdateResult, FlushUpdateArgs>('flush')

export interface DaemonWorkflowInput {
  domain: string
  software: ServerSoftware
  queue?: DaemonQueueItem[]
}

export async function daemonWorkflow({ domain, software, queue: _queue }: DaemonWorkflowInput) {
  const queue = new Denque<DaemonQueueItem>(_queue ?? [])
  const reactions: Record<string, Denque<DaemonQueueItem>> = {}

  setHandler(flush, ({ userId }) => {
    if (!reactions[userId]) return []
    const list = reactions[userId].toArray()
    reactions[userId].clear()
    return list
  })

  while (true) {
    // 모든 계정의 신규 알림들을 가져와서 큐에 추가
    for (const { accountId: userId } of await findAccounts({ where: { providerId: domain }, orderBy: { createdAt: 'desc' } })) {
      const { notificationIds } = await executeChild<typeof fetchNotificationsWorkflow>('fetchNotificationsWorkflow', {
        workflowId: `fetch-notifications-${domain}-${userId}`,
        args: [{ domain, software, userId }],
      })
      for (const notificationId of notificationIds) queue.push({ userId, notificationId })
    }

    // 모든 계정의 기존 알림 중 아직 미확정 상태의 알림들을 찾아서 큐에 추가
    for (const { userId, notificationId } of await findNotifications({
      where: { domain, reactions: { none: {} }, createdAt: { gt: new Date(Date.now() - ms(maxReactionDelay)) } },
      select: { userId: true, notificationId: true },
    })) {
      queue.push({ userId, notificationId })
    }

    // 큐의 모든 알림들의 반응을 가져오기
    while (true) {
      if (workflowInfo().continueAsNewSuggested) {
        // 지금까지의 큐 내용을 넘기면서 새로 시작
        return await continueAsNew<typeof daemonWorkflow>({
          domain,
          software,
          queue: queue.toArray(),
        })
      }

      const current = queue.shift()
      if (!current) break

      try {
        const { userId, notificationId } = current
        await executeChild<typeof fetchReactionWorkflow>('fetchReactionWorkflow', {
          workflowId: `fetch-reaction-${domain}-${notificationId}`,
          args: [{ domain, software, notificationId }],
        })

        reactions[userId] ??= new Denque<DaemonQueueItem>()
        reactions[userId].push(current)
      } catch (_) {
        // 반응이 없는 알림은 무시
      }
    }
  }
}
