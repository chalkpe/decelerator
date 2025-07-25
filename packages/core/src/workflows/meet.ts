import { proxyActivities } from '@temporalio/workflow'
import type * as findNotificationActivities from '../activities/find-notification'
import type * as identifyActivities from '../activities/identify'
import type * as insertNotificationActivities from '../activities/insert-notification'
import type * as listNotificationsActivities from '../activities/list-notifications'

const { findNotificationActivity: find } = proxyActivities<typeof findNotificationActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { identifyActivity: identify } = proxyActivities<typeof identifyActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['MastoHttpError'] },
})
const { insertNotificationActivity: insert } = proxyActivities<typeof insertNotificationActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { listNotificationsActivity: list } = proxyActivities<typeof listNotificationsActivities>({
  heartbeatTimeout: '5 seconds',
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['MastoHttpError'] },
})

export interface MeetWorkflowInput {
  domain: string
  accessToken: string
}

export async function meetWorkflow(input: MeetWorkflowInput) {
  const { domain, accessToken } = input

  const { user } = await identify({ domain, accessToken })
  const recent = await find({ where: { domain, userId: user.id }, orderBy: { createdAt: 'desc' } })

  await insert(await list({ domain, accessToken, pagination: { minId: recent?.notificationId } }))
}
