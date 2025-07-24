import { prisma, type StatusIndexCreateManyInput } from '@decelerator/database'
import { log } from '@temporalio/activity'

export interface SaveIndexParams {
  indicies: StatusIndexCreateManyInput[]
}

export async function saveIndexActivity(params: SaveIndexParams) {
  const { indicies } = params
  log.info('Saving status indices', { count: indicies.length })
  return await prisma.statusIndex.createMany({ data: indicies, skipDuplicates: true })
}
