import { proxyActivities } from '@temporalio/workflow'
import type * as findIndexActivities from '../activities/find-index'
import type * as findNotificationActivities from '../activities/find-notification'
import type * as syncIndexActivities from '../activities/sync-index'
import type * as updateNotificationActivities from '../activities/update-notification'

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
const { findIndexActivity: findIndex } = proxyActivities<typeof findIndexActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})

export interface VisitWorkflowInput {
  domain: string
  accessToken: string
  notificationId: string
}

export async function visitWorkflow(input: VisitWorkflowInput) {
  const { domain, accessToken, notificationId } = input

  const notification = await findNotification({ where: { domain, notificationId } })
  if (!notification) return null

  // 이미 계산해 둔 반응 인덱스가 있다면 바로 반환
  if (notification.reaction) return notification.reaction

  // 게시글 인덱싱
  const { accountId } = notification
  await syncIndex({ domain, accessToken, accountId })

  // 반응 인덱스 찾기
  const reaction = await findIndex({
    where: { domain, accountId, createdAt: { gt: notification.createdAt }, reblogId: null },
    orderBy: { createdAt: 'asc' },
  })

  // 반응 인덱스가 생겼다면 업데이트
  if (reaction) {
    await updateNotification({
      where: { domain_notificationId: { domain, notificationId } },
      data: { reactionId: reaction.statusId },
    })
  }

  return reaction
}
