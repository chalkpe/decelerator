import { log } from '@temporalio/activity'

export async function activityAB() {
  log.info('hello from workflow A activity B')
  return true
}
