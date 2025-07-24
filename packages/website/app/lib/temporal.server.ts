import { Client, Connection } from '@temporalio/client'

const client = new Client({ connection: await Connection.connect({ address: 'temporal:7233' }) })
const globalForTemporal = globalThis as typeof globalThis & { temporal?: Client }

export const temporal: Client = globalForTemporal.temporal ?? client
if (process.env.NODE_ENV !== 'production') globalForTemporal.temporal = temporal
