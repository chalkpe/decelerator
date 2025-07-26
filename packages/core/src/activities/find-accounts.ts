import { type AccountFindManyArgs, prisma } from '@decelerator/database'

export type FindAccountsParams = AccountFindManyArgs

export async function findAccountsActivity(params: FindAccountsParams) {
  return await prisma.account.findMany({ ...params, include: { user: true } })
}
