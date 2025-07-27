import { prisma, type ReblogNotificationFindFirstArgs } from '@decelerator/database'

export type FindNotificationParams = ReblogNotificationFindFirstArgs

export async function findNotificationActivity(params: FindNotificationParams) {
  return await prisma.reblogNotification.findFirst(params)
}
