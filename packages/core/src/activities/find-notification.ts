import { prisma, type ReblogNotificationOrderByWithRelationInput, type ReblogNotificationWhereInput } from '@decelerator/database'

export interface FindNotificationParams {
  where: ReblogNotificationWhereInput
  orderBy?: ReblogNotificationOrderByWithRelationInput
}

export async function findNotificationActivity(params: FindNotificationParams) {
  const { where, orderBy } = params
  return await prisma.reblogNotification.findFirst({ where, orderBy, include: { reaction: true } })
}
