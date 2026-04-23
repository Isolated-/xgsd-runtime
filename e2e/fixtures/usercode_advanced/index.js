class MyExecutor {
  async run(block, ctx) {}
}
class MyOrchestrator {
  async orchestrate(data, blocks) {
    return blocks
  }
}

module.exports = {
  runWithCustomOrchestrator: (data) => {},
  setup: (xgsd) => {
    xgsd.executor(MyExecutor)
    xgsd.orchestrator(MyOrchestrator)
  },
}
