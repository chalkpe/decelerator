import * as activities from '@decelerator/core/activities'
import { NativeConnection, Worker } from '@temporalio/worker'

async function run() {
  const worker = await Worker.create({
    connection: await NativeConnection.connect({ address: 'temporal:7233', tls: false }),
    activities,
    taskQueue: 'decelerator',
    workflowsPath: require.resolve('@decelerator/core/workflows'),
  })
  await worker.run()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
