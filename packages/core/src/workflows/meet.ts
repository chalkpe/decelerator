import { proxyActivities } from '@temporalio/workflow'
import type * as listNotificationsActivities from '../activities/list-notifications'

const { listNotificationsActivity: list } = proxyActivities<typeof listNotificationsActivities>({
  heartbeatTimeout: '5 seconds',
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['MastoHttpError'] },
})

export interface MeetWorkflowInput {
  domain: string
  accessToken: string
  maxId?: string
}

export async function meetWorkflow(input: MeetWorkflowInput) {
  const { domain, accessToken, maxId } = input
  return await list({ domain, accessToken, pagination: { maxId } })
}
