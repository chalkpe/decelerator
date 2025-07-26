import { prisma, type ReblogNotificationOrderByWithRelationInput, type ReblogNotificationWhereInput } from '@decelerator/database'

export interface FindNotificationsParams {
  where: ReblogNotificationWhereInput
  orderBy?: ReblogNotificationOrderByWithRelationInput
}

export async function findNotificationsActivity(params: FindNotificationsParams) {
  const { where, orderBy } = params
  return await prisma.reblogNotification.findMany({ where, orderBy, include: { reaction: true } })
}
