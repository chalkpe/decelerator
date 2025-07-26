import { proxyActivities } from '@temporalio/workflow'
import type * as syncNotificationsActivities from '../activities/sync-notifications'

const { syncNotificationsActivity: syncNotifications } = proxyActivities<typeof syncNotificationsActivities>({
  heartbeatTimeout: '30 seconds',
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '5 minutes',
    nonRetryableErrorTypes: ['MastoHttpError', 'PrismaClientKnownRequestError'],
  },
})

export interface MeetWorkflowInput {
  domain: string
  accessToken: string
}

export async function meetWorkflow(input: MeetWorkflowInput) {
  const { domain, accessToken } = input
  await syncNotifications({ domain, accessToken })
}
