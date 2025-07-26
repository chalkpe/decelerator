import { Client, Connection } from '@temporalio/client'

export const globalForTemporal = globalThis as typeof globalThis & { temporal?: Client }

if (!globalForTemporal.temporal) {
  Connection.connect({ address: import.meta.env.VITE_TEMPORAL_ADDRESS }).then((connection) => {
    globalForTemporal.temporal = new Client({ connection })
  })
}
