import { prisma, type UserReactionCreateArgs } from '@decelerator/database'

export type CreateUserReactionParams = UserReactionCreateArgs

export async function createUserReactionActivity(params: CreateUserReactionParams) {
  return await prisma.userReaction.create(params)
}
