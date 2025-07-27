import { prisma, type StatusIndexFindFirstArgs } from '@decelerator/database'

export type FindIndexParams = StatusIndexFindFirstArgs

export async function findIndexActivity(params: FindIndexParams) {
  return await prisma.statusIndex.findFirst(params)
}
