import { prisma, type ReblogNotificationFindManyArgs } from '@decelerator/database'

export type FindNotificationsParams = ReblogNotificationFindManyArgs

export async function findNotificationsActivity(params: FindNotificationsParams) {
  return await prisma.reblogNotification.findMany(params)
}
