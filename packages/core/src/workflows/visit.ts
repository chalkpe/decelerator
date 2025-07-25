import { proxyActivities } from '@temporalio/workflow'
import type * as findIndexActivities from '../activities/find-index'
import type * as findNotificationActivities from '../activities/find-notification'
import type * as insertIndexActivities from '../activities/insert-index'
import type * as listStatusesActivities from '../activities/list-statuses'
import type * as updateNotificationActivities from '../activities/update-notification'

const { listStatusesActivity: listStatuses } = proxyActivities<typeof listStatusesActivities>({
  heartbeatTimeout: '10 seconds',
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '5 minutes',
    nonRetryableErrorTypes: ['MastoHttpError'],
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
const { insertIndexActivity: insertIndex } = proxyActivities<typeof insertIndexActivities>({
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
  if (notification.reactionId) return await findIndex({ where: { domain, statusId: notification.reactionId } })

  // 최근 인덱스 이후에 작성된 게시글 인덱싱
  const { accountId } = notification
  const recent = await findIndex({ where: { domain, accountId }, orderBy: { createdAt: 'desc' } })
  await insertIndex(await listStatuses({ domain, accessToken, accountId, pagination: { minId: recent?.statusId } }))

  // 반응 인덱스 찾기
  const reaction = await findIndex({
    where: { domain, accountId, createdAt: { gt: notification.createdAt }, reblogId: null },
    orderBy: { createdAt: 'asc' },
  })

  if (!reaction) return null
  await updateNotification({ where: { domain_notificationId: { domain, notificationId } }, data: { reactionId: reaction.statusId } })
  return reaction
}
