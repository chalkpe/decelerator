import { proxyActivities } from '@temporalio/workflow'
import type * as findIndexActivities from '../activities/find-index'
import type * as findNotificationActivities from '../activities/find-notification'
import type * as syncIndexActivities from '../activities/sync-index'
import type * as updateNotificationActivities from '../activities/update-notification'

const { findIndexActivity: findIndex } = proxyActivities<typeof findIndexActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { syncIndexActivity: syncIndex } = proxyActivities<typeof syncIndexActivities>({
  heartbeatTimeout: '30 seconds',
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '5 minutes',
    nonRetryableErrorTypes: ['MastoHttpError', 'PrismaClientKnownRequestError'],
  },
})
const { findNotificationActivity: findNotification } = proxyActivities<typeof findNotificationActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { updateNotificationActivity: updateNotification } = proxyActivities<typeof updateNotificationActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})

export interface FetchReactionWorkflowInput {
  domain: string
  accessToken: string
  notificationId: string
}

export async function fetchReactionWorkflow({ domain, accessToken, notificationId }: FetchReactionWorkflowInput) {
  // 알림 찾기
  const notification = await findNotification({ where: { domain, notificationId } })
  if (!notification) throw new Error(`Notification with ID ${notificationId} not found`)

  // 인덱스 동기화
  const { accountId, statusId: minId } = notification
  await syncIndex({ domain, accessToken, accountId, minId })

  // 반응 인덱스 찾기
  const reaction = await findIndex({
    where: { domain, accountId, createdAt: { gt: notification.createdAt }, reblogId: null },
    orderBy: { createdAt: 'asc' },
  })

  if (!reaction) throw new Error(`Reaction for notification ${notificationId} not found`)

  // 알림에 반응 ID 업데이트
  await updateNotification({
    where: { domain_notificationId: { domain, notificationId } },
    data: { reactionId: reaction.statusId },
  })
}
