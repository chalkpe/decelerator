import { prisma, type ReblogNotificationCreateManyInput } from '@decelerator/database'
import { log } from '@temporalio/activity'

export interface InsertNotificationParams {
  notifications: ReblogNotificationCreateManyInput[]
}

export async function insertNotificationActivity(params: InsertNotificationParams) {
  const { notifications } = params
  log.info('Inserting reblog notifications', { count: notifications.length })
  return await prisma.reblogNotification.createMany({ data: notifications, skipDuplicates: true })
}
