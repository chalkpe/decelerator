import { prisma, type ServerSoftware } from '@decelerator/database'
import { sleep } from '@temporalio/activity'
import { createRestAPIClient } from 'masto'
import type { CustomEmoji } from 'masto/mastodon/entities/v1/custom-emoji.js'
import type { Status } from 'masto/mastodon/entities/v1/status.js'
import { acct, api } from 'misskey-js'
import type { Note } from 'misskey-js/entities.js'

function createCustomEmojiFromMasto(emoji: CustomEmoji): PrismaJson.CustomEmoji {
  return {
    url: emoji.url,
    shortcode: emoji.shortcode,
  }
}

function createDataFromMasto(status: Status): PrismaJson.StatusIndexData {
  return {
    id: status.id,
    createdAt: status.createdAt,
    visibility: status.visibility,
    account: {
      acct: status.account.acct,
      avatar: status.account.avatar,
      displayName: status.account.displayName,
      emojis: status.account.emojis.map(createCustomEmojiFromMasto),
    },
    content: status.content,
    emojis: status.emojis.map(createCustomEmojiFromMasto),
    mediaAttachments: status.mediaAttachments.map((attachment) => ({
      id: attachment.id,
      url: attachment.url ?? '',
      description: attachment.description ?? '',
    })),
  }
}

const misskeyVisibilityMap = {
  public: 'public',
  home: 'unlisted',
  followers: 'private',
  specified: 'direct',
} as const

function createCustomEmojisFromMisskey(emojis: Record<string, string>): PrismaJson.CustomEmoji[] {
  return Object.entries(emojis).map(([shortcode, url]) => ({ shortcode, url }))
}

function createDataFromMisskey(note: Note): PrismaJson.StatusIndexData {
  return {
    id: note.id,
    createdAt: note.createdAt,
    visibility: misskeyVisibilityMap[note.visibility],
    account: {
      acct: acct.toString({ username: note.user.username, host: note.user.host }),
      avatar: note.user.avatarUrl ?? '',
      displayName: note.user.name ?? note.user.username,
      emojis: createCustomEmojisFromMisskey(note.user.emojis),
    },
    content: note.text ?? '',
    emojis: createCustomEmojisFromMisskey(note.emojis ?? {}),
    mediaAttachments: note.files?.map((file) => ({ id: file.id, url: file.url ?? '', description: file.comment ?? '' })) ?? [],
  }
}

export interface SyncIndexParams {
  domain: string
  software: ServerSoftware
  accessToken: string
  accountId: string
  minId?: string
  maxId?: string
}

export interface SyncIndexResult {
  count: number
}

export async function syncIndexActivity(params: SyncIndexParams): Promise<SyncIndexResult> {
  const { domain, software, accessToken, accountId, minId, maxId } = params

  switch (software) {
    case 'MASTODON': {
      const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
      const statuses = await masto.v1.accounts
        .$select(accountId)
        .statuses.list({ excludeReplies: true, excludeReblogs: false, minId, maxId })

      const { count } = await prisma.statusIndex.createMany({
        skipDuplicates: true,
        data: statuses.flatMap((status) => [
          {
            domain,
            statusId: status.id,
            createdAt: new Date(status.createdAt),
            accountId: status.account.id,
            reblogId: status.reblog?.id ?? null,
            data: createDataFromMasto(status),
          },
          ...(status.reblog
            ? [
                {
                  domain,
                  statusId: status.reblog.id,
                  createdAt: new Date(status.reblog.createdAt),
                  accountId: status.reblog.account.id,
                  reblogId: null,
                  data: createDataFromMasto(status.reblog),
                },
              ]
            : []),
        ]),
      })

      await sleep('3 seconds')
      return { count }
    }

    case 'MISSKEY': {
      const client = new api.APIClient({ origin: `https://${domain}`, credential: accessToken })
      const notes = await client.request('users/notes', {
        userId: accountId,
        withReplies: false,
        withRenotes: true,
        sinceId: minId,
        untilId: maxId,
      })

      const { count } = await prisma.statusIndex.createMany({
        skipDuplicates: true,
        data: notes.flatMap((note) => [
          {
            domain,
            statusId: note.id,
            createdAt: new Date(note.createdAt),
            accountId: note.userId,
            reblogId: note.renoteId ?? null,
            data: createDataFromMisskey(note),
          },
          ...(note.renote
            ? [
                {
                  domain,
                  statusId: note.renote.id,
                  createdAt: new Date(note.renote.createdAt),
                  accountId: note.renote.userId,
                  reblogId: null,
                  data: createDataFromMisskey(note.renote),
                },
              ]
            : []),
        ]),
      })

      await sleep('3 seconds')
      return { count }
    }
  }
}
