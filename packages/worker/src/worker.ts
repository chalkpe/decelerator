import 'dotenv/config'
import * as activities from '@decelerator/core/activities'
import { NativeConnection, Worker } from '@temporalio/worker'

async function run() {
  const workflowsPath = require.resolve('@decelerator/core/workflows')
  const connection = await NativeConnection.connect({ address: process.env.TEMPORAL_ADDRESS, tls: false })
  const worker = await Worker.create({ connection, activities, taskQueue: 'decelerator', workflowsPath })

  console.log('Worker started, waiting for tasks...')
  await worker.run()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
