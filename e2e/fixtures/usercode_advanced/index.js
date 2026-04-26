class MyExecutor {
  async run(block, ctx) {
    return {
      ...block,
      state: 'completed',
      errors: [],
      error: null,
    }
  }
}

class MyOrchestrator {
  async orchestrate(data, blocks) {
    return blocks
  }
}

module.exports = {
  runWithCustomOrchestrator: (data) => {
    return data
  },
  setup: (xgsd) => {
    xgsd.executor(MyExecutor)
    xgsd.orchestrator(MyOrchestrator)
  },
}
