import { ExcessiveCancellationsChecker } from "./src/excessive-cancellations-checker.js";
import { memoryUsage, hrtime } from "node:process";

async function main(limit = 10) {
  let times = [];
  let heaps = [];
  for (let i = 0; i < limit; ++i) {
    const checker = new ExcessiveCancellationsChecker("./data/trades.csv");

    gc();

    const startTime = hrtime.bigint();
    const { heapUsed: memoryStart } = memoryUsage();

    await checker.companiesInvolvedInExcessiveCancellations();

    const stopTime = hrtime.bigint();
    const { heapUsed: memoryStop } = memoryUsage();

    times.push(stopTime - startTime);
    heaps.push(memoryStop - memoryStart);
  }
  return [times, heaps];
}

function averageTime(list) {
  return list.reduce((a, b) => (a += b), BigInt(0)) / BigInt(list.length);
}
function averageHeap(list) {
  return list.reduce((a, b) => (a += b), 0) / list.length;
}

main(10).then(([times, heaps]) =>
  console.table({
    "runs": times.length,
    "Avg time (ms):": Number(averageTime(times) / BigInt(1e6)),
    "Avg Heap usage (Mb):": Number((averageHeap(heaps) / 1e6).toFixed(2)),
  }),
);
