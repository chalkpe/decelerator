import { type AccountFindFirstArgs, prisma } from '@decelerator/database'

export type FindAccountParams = AccountFindFirstArgs

export async function findAccountActivity(params: FindAccountParams) {
  return await prisma.account.findFirst(params)
}
