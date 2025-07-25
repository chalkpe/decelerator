import { prisma, type StatusIndexCreateManyInput } from '@decelerator/database'
import { log } from '@temporalio/activity'

export interface InsertIndexParams {
  indicies: StatusIndexCreateManyInput[]
}

export async function insertIndexActivity(params: InsertIndexParams) {
  const { indicies } = params
  log.info('Inserting status indices', { count: indicies.length })
  return await prisma.statusIndex.createMany({ data: indicies, skipDuplicates: true })
}
