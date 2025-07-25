import { prisma, type ReblogNotificationUpdateArgs } from '@decelerator/database'

export type UpdateNotificationParams = ReblogNotificationUpdateArgs

export async function updateNotificationActivity(params: UpdateNotificationParams) {
  return await prisma.reblogNotification.update(params)
}
