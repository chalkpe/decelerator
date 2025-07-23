import { log } from '@temporalio/activity'

export async function activityAA() {
  log.info('hello from workflow A activity A')
  return true
}
