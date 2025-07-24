import { PrismaClient } from './generated/prisma/client.js'

const client = new PrismaClient()
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? client
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export type * from './generated/prisma/client.d.ts'
export type * from './generated/prisma/models.d.ts'
