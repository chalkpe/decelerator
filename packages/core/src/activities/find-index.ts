import { prisma, type StatusIndexOrderByWithRelationInput, type StatusIndexWhereInput } from '@decelerator/database'

export interface FindIndexParams {
  where: StatusIndexWhereInput
  orderBy?: StatusIndexOrderByWithRelationInput
}

export async function findIndexActivity(params: FindIndexParams) {
  const { where, orderBy } = params
  return await prisma.statusIndex.findFirst({ where, orderBy })
}
