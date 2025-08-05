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

export interface FetchReactionWorkflowOutput {
  found: boolean
  result?: { statusId: string; reactionId: string }
}

export async function fetchReactionWorkflow({
  domain,
  software,
  notificationId,
}: FetchReactionWorkflowInput): Promise<FetchReactionWorkflowOutput> {
  // 알림 찾기
  const notification = await findNotification({ where: { domain, notificationId } })
  if (!notification) throw ApplicationFailure.nonRetryable('Notification not found', 'NotificationNotFound')

  // 계정 찾기
  const account = await findAccount({ where: { providerId: domain, accountId: notification.userId }, select: { accessToken: true } })
  if (!account?.accessToken) throw ApplicationFailure.nonRetryable('Unauthorized', 'Unauthorized')

  // 인덱스 동기화
  const { accountId, statusId, createdAt: gt } = notification
  await syncIndex({ domain, software, accessToken: account.accessToken, accountId, minId: statusId })

  // 부스트 인덱스 찾기
  const reblog = await findIndex({ where: { domain, accountId, reblogId: statusId }, orderBy: { createdAt: 'asc' } })
  if (!reblog) return { found: false }

  // 반응 인덱스 찾기
  const reaction = await findIndex({ where: { domain, accountId, createdAt: { gt }, reblogId: null }, orderBy: { createdAt: 'asc' } })
  if (!reaction) return { found: false }

  // 사용자 반응 매핑 생성
  const { fromMutual } = await fetchRelationships({ domain, software, accessToken: account.accessToken, accountId: reaction.accountId })
  const { reactionId } = await createUserReaction({
    data: {
      domain,
      statusId,
      reactionId: reaction.statusId,
      notificationId,
      createdAt: notification.createdAt,
      reactedAt: reaction.createdAt,
      fromMutual,
    },
  })

  return { found: true, result: { statusId, reactionId } }
}
