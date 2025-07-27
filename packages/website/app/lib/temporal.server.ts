import { Client, Connection } from '@temporalio/client'

async function createTemporalClient() {
  return new Client({ connection: await Connection.connect({ address: import.meta.env.VITE_TEMPORAL_ADDRESS }) })
}

const globalForTemporal = globalThis as typeof globalThis & { temporal?: Client }
export const temporal = globalForTemporal.temporal ?? (await createTemporalClient())

globalForTemporal.temporal = temporal
