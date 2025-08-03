import { PrismaClient } from './generated/prisma/client.js'

declare global {
  namespace PrismaJson {
    type CustomEmoji = {
      shortcode: string
      url: string
    }

    type StatusIndexData = {
      id: string
      createdAt: string
      visibility: 'public' | 'unlisted' | 'private' | 'direct'
      account: { acct: string; avatar: string; displayName: string; emojis: CustomEmoji[] }
      content: string
      spoilerText?: string
      emojis: CustomEmoji[]
      mediaAttachments: { id: string; url: string; description: string }[]
    }
  }
}

const client = new PrismaClient()
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? client
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export type * from './generated/prisma/client.d.ts'
export type * from './generated/prisma/models.d.ts'
