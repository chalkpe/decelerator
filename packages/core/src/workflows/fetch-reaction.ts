import type { ServerSoftware } from '@decelerator/database'
import { ApplicationFailure, proxyActivities } from '@temporalio/workflow'
import type * as createUserReactionActivities from '../activities/create-user-reaction.js'
import type * as fetchRelationshipsActivities from '../activities/fetch-relationships.js'
import type * as findAccountActivities from '../activities/find-account.js'
import type * as findIndexActivities from '../activities/find-index.js'
import type * as findNotificationActivities from '../activities/find-notification.js'
import type * as syncIndexActivities from '../activities/sync-index.js'

const { findAccountActivity: findAccount } = proxyActivities<typeof findAccountActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { findIndexActivity: findIndex } = proxyActivities<typeof findIndexActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { syncIndexActivity: syncIndex } = proxyActivities<typeof syncIndexActivities>({
  heartbeatTimeout: '30 seconds',
  startToCloseTimeout: '3 minutes',
  retry: {
    initialInterval: '5 minutes',
    nonRetryableErrorTypes: ['MastoHttpError', 'PrismaClientKnownRequestError'],
  },
})
const { fetchRelationshipsActivity: fetchRelationships } = proxyActivities<typeof fetchRelationshipsActivities>({
  startToCloseTimeout: '1 minutes',
  retry: { nonRetryableErrorTypes: ['MastoHttpError'] },
})
const { findNotificationActivity: findNotification } = proxyActivities<typeof findNotificationActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { createUserReactionActivity: createUserReaction } = proxyActivities<typeof createUserReactionActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})

export interface FetchReactionWorkflowInput {
  domain: string
  software: ServerSoftware
  notificationId: string
}

export async function fetchReactionWorkflow({ domain, software, notificationId }: FetchReactionWorkflowInput) {
  // 알림 찾기
  const notification = await findNotification({ where: { domain, notificationId } })
  if (!notification) throw ApplicationFailure.nonRetryable('Notification not found', 'NotificationNotFound')

  // 계정 찾기
  const account = await findAccount({ where: { providerId: domain, accountId: notification.userId }, select: { accessToken: true } })
  if (!account?.accessToken) throw ApplicationFailure.nonRetryable('Unauthorized', 'Unauthorized')

  // 인덱스 동기화
  const { accountId, statusId: minId, createdAt: gt } = notification
  await syncIndex({ domain, software, accessToken: account.accessToken, accountId, minId })

  // 부스트 인덱스 찾기
  const reblog = await findIndex({
    where: { domain, accountId, reblogId: notification.statusId },
    orderBy: { createdAt: 'asc' },
  })
  if (!reblog) throw ApplicationFailure.nonRetryable('Reblog not found', 'ReblogNotFound')

  // 반응 인덱스 찾기
  const reaction = await findIndex({ where: { domain, accountId, createdAt: { gt }, reblogId: null }, orderBy: { createdAt: 'asc' } })
  if (!reaction) throw ApplicationFailure.nonRetryable('Reaction not found', 'ReactionNotFound')

  const { fromMutual } = await fetchRelationships({ domain, software, accessToken: account.accessToken, accountId: reaction.accountId })

  // 알림에 반응 ID 업데이트
  await createUserReaction({
    data: {
      domain,
      statusId: notification.statusId,
      reactionId: reaction.statusId,
      notificationId: notification.notificationId,
      createdAt: notification.createdAt,
      reactedAt: reaction.createdAt,
      fromMutual,
    },
  })
}
