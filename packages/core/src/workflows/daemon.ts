import { continueAsNew, executeChild, log, proxyActivities, sleep, workflowInfo } from '@temporalio/workflow'
import type * as findAccountsActivities from '../activities/find-accounts'
import type { fetchNotificationsWorkflow } from './fetch-notifications'
import type { fetchReactionWorkflow } from './fetch-reaction'

const { findAccountsActivity: findAccounts } = proxyActivities<typeof findAccountsActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})

export interface DaemonWorkflowInput {
  domain: string
}

export async function daemonWorkflow({ domain }: DaemonWorkflowInput) {
  while (!workflowInfo().continueAsNewSuggested) {
    const queue = new Set<{ notificationId: string; accessToken: string }>()

    // 모든 계정의 신규 알림 찾기
    for (const { user, accessToken } of await findAccounts({ where: { providerId: domain } })) {
      if (!accessToken) continue
      const userId = user.mastodonId

      // 새 알림들을 찾아서 큐에 추가
      const { notificationIds } = await executeChild<typeof fetchNotificationsWorkflow>('fetchNotificationsWorkflow', {
        workflowId: `fetch-notifications-${domain}-${userId}`,
        args: [{ domain, accessToken, userId }],
      })
      for (const notificationId of notificationIds) queue.add({ notificationId, accessToken })
    }

    // 새 알림들의 반응 인덱스를 업데이트
    const sortedQueue = Array.from(queue).toSorted((a, b) => b.notificationId.localeCompare(a.notificationId))
    for (const { notificationId, accessToken } of sortedQueue) {
      try {
        await executeChild<typeof fetchReactionWorkflow>('fetchReactionWorkflow', {
          workflowId: `fetch-reaction-${domain}-${notificationId}`,
          args: [{ domain, accessToken, notificationId }],
        })
      } catch (error) {
        console.error(error)
        log.warn(`Failed to fetch reaction for notification ${notificationId}`)
      }
    }

    await sleep('1 minute')
  }
  return await continueAsNew({ domain })
}
