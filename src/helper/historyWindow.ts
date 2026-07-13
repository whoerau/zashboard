export const getHistoryTimeWindow = (latest: number, samples: number) => ({
  min: latest - Math.max(samples - 1, 0) * 1000,
  max: latest,
})
