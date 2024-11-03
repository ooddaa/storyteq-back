import { ExcessiveCancellationsChecker } from "./src/excessive-cancellations-checker.js";
import { memoryUsage, stdout } from "node:process";

async function main(limit = 10) {
  let heaps = [];
  for (let i = 0; i < limit; ++i) {
    const checker = new ExcessiveCancellationsChecker("./data/trades.csv");
    gc();
    const { heapUsed: memoryStart } = memoryUsage();
    const companiesList =
      await checker.companiesInvolvedInExcessiveCancellations();
    const { heapUsed: memoryStop } = memoryUsage();
    heaps.push(memoryStop - memoryStart);
  }
  return heaps;
}

function average(list) {
  return list.reduce((a, b) => (a += b), 0) / list.length;
}

main(10).then((heaps) =>
  console.log("Avg Heap usage (Mb):", average(heaps) / 1e6),
);
