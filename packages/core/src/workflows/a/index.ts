import { log, proxyActivities, sleep } from '@temporalio/workflow'
import type * as activitiesAA from './activities/a'
import type * as activitiesAB from './activities/b'

const { activityAA } = proxyActivities<typeof activitiesAA>({
  startToCloseTimeout: '1 minute',
})
const { activityAB } = proxyActivities<typeof activitiesAB>({
  startToCloseTimeout: '1 minute',
})

export async function workflowA() {
  log.info('Hello from WorkflowA')

  const res1 = await activityAA()
  await sleep(100)
  const res2 = await activityAB()

  return `A: ${res1} | B: ${res2}`
}
