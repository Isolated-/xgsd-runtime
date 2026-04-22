const thisBlockAlwaysFails = async (data) => {
  throw new Error('something went wrong')
}

// export actions/hooks
module.exports = {
  thisBlockAlwaysFails,
}
