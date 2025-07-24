import { Client, Connection } from '@temporalio/client'

export const globalForTemporal = globalThis as typeof globalThis & { temporal?: Client }

if (!globalForTemporal.temporal) {
  Connection.connect({ address: 'temporal:7233' }).then((connection) => {
    globalForTemporal.temporal = new Client({ connection })
  })
}
