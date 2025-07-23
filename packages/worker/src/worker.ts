import activities from '@decelerator/core/activities'
import { Worker } from '@temporalio/worker'

async function run() {
  const worker = await Worker.create({
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
