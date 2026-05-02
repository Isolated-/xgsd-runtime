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
  constructor(ctx) {
    this.ctx = ctx
  }

  async orchestrate(data, blocks) {
    return {
      ...this.ctx,
      state: 'completed',
    }
  }
}

module.exports = {
  runWithCustomOrchestrator: (data) => {
    return data
  },
  setup: (xgsd) => {
    xgsd.executor(MyExecutor)
    xgsd.orchestrator((ctx) => new MyOrchestrator(ctx))
  },
}
