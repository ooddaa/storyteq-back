import fs from "node:fs";
import { parse } from "csv-parse";
import { finished } from "node:stream/promises";
import { calculateRatio, normalizeTrade, log } from "./utils";
import RingBuffer from "./ring-buffer" 

const BUFFER_SIZE = 60
//const updateAcc = (acc, trade) => {
//  let [timestamp, company, orderType, value] = trade;
//  const isNewOrder = orderType == "D";
//
//  if (!acc[company]) {
//    acc[company] = {
//      isExcessive: !isNewOrder,
//      state: isNewOrder
//        ? [0, value, 0, [[timestamp, value]]]
//        : [1, 0, -value, [[timestamp, -value]]],
//    };
//    return acc;
//  }
//
//  // get current state
//  let [ratio, total_d, total_f, values] = acc[company]?.state || [];
//
//  while (values.length && timestamp - values[0][0] > 59) {
//    // remove stale values from the current window
//    // eslint-disable-next-line no-unused-vars
//    const [_, value] = values.shift();
//    value <= 0 ? (total_f -= value) : (total_d -= value);
//  }
//
//  // add trade to current window
//  isNewOrder ? (total_d += value) : (total_f -= value);
//
//  // calculate ratio
//  ratio = calculateRatio(total_d, total_f);
//  acc[company].isExcessive = ratio > 1 / 3;
//
//  // update and return state
//  acc[company].state = [
//    ratio,
//    total_d,
//    total_f,
//    [...values, [timestamp, isNewOrder ? value : -value]],
//  ];
//
//  return acc;
//};

const updateAcc = (acc, trade) => {
  let [timestamp, company, orderType, value] = trade;
  const isNewOrder = orderType == "D";

  if (!acc[company]) {
    // init window buffer
    const buffer = new RingBuffer(BUFFER_SIZE)
    buffer.push([timestamp, isNewOrder ? value : -value])

    acc[company] = {
      isExcessive: !isNewOrder,
      state: isNewOrder
        ? [0, value, 0, buffer]
        : [1, 0, -value, buffer]
    };

    //log(acc)
    return acc;
  }

  // get current state
  let [ratio, total_d, total_f, buffer] = acc[company]?.state || [];
  //console.log({ when: "before", company, ratio, total_d, total_f})

  // would be more readable to check if buffer is empty

  // has it been > 60 sec from last trade == do we need to reset window?
  const lastTradeTimestamp = buffer.getTail()?.[0] || 0 // also handles empty buffer case
  const timeGap = timestamp - lastTradeTimestamp

  if (timeGap > BUFFER_SIZE) {
    acc[company].state = [
      ratio,
      total_d,
      total_f,
      buffer.reset()
    ];
  //console.log({ company })
    return acc
  }
  
  // calc where to position new trade in our window
  //const newTail = (buffer.tail + timeGap) % BUFFER_SIZE

  // update and return state
  // pushing a new trade, if it's > timeGap will 
  // yield us the stale values that no longer 
  // fall within BUFFER_SIZE/60s timeframe
  // we will restore total counters instead of 
  // reducing over the current buffer - which would also work 
  // but would take more operations to complete the task 
  //const staleValues = buffer.push([timestamp, isNewOrder ? value : -value], timeGap)
  const staleValues = buffer.push([timestamp, isNewOrder ? value : -value], timeGap, { returnOverwrites: true })
  //log(buffer)

  // again walk from index 0 to newTail and restore counters
  //for (let i = 0; i < newTail; i++) {
  //  console.log(buffer, i, buffer.get(i))
  //  const [_, value] = buffer.get(i);
  //  value <= 0 ? (total_f -= value) : (total_d -= value);
  //}
  staleValues
    .filter(Boolean)
    .forEach(element => {
    const [_, value] = element;
       //log(element) 
    value <= 0 ? (total_f -= value) : (total_d -= value);
      });

  //console.log({ when: "mid", company, ratio, total_d, total_f})
  // add trade to current window
  isNewOrder ? (total_d += value) : (total_f -= value);
  //console.log({ when: "after", company, ratio, total_d, total_f})

  // calculate ratio
  ratio = calculateRatio(total_d, total_f);
  const isExcessive = ratio > 1 / 3;
  //console.log({ ratio, company, isExcessive })
  acc[company].isExcessive = isExcessive

  // update and return state
  //buffer.push([timestamp, isNewOrder ? value : -value], timeGap)
  acc[company].state = [
    ratio,
    total_d,
    total_f,
    buffer
  ];

  //log(acc)
  return acc;
};

export class ExcessiveCancellationsChecker {
  /* 
        We provide a path to a file when initiating the class
        you have to use it in your methods to solve the task
    */
  constructor(filePath) {
    this.filePath = this.validateFilePath(filePath);
    this._isParsingComplete = false;
    this.acc = {};
    this.exessives = [];
  }

  async processFile() {
    const ctx = this;

    try {
      const parser = fs.createReadStream(this.filePath).pipe(
        parse({
          delimiter: ",",
          skipRecordsWithError: true,
          skipRecordsWithEmptyValues: true,
        }),
      );

      parser.on("readable", function () {
        let trade;
        while ((trade = parser.read()) !== null) {
          updateAcc(ctx.acc, normalizeTrade(trade));
        }
      });

      parser.on("error", function (error) {
        console.error(error);
      });

      parser.on("end", function () {
        return ctx.acc;
      });

      await finished(parser);
      return this.acc;
    } catch (err) {
      console.error("processFile crashed", err);
    }
  }

  validateFilePath(filePath) {
    if (!filePath)
      throw new Error(`no valid filePath given:\n ${JSON.stringify(filePath)}`);
    return filePath;
  }

  setExcessives(list) {
    this.exessives = list;
    return list;
  }

  /**
   * Returns the list of companies that are involved in excessive cancelling.
   * Note this should always resolve an array or throw error.
   */
  async companiesInvolvedInExcessiveCancellations() {
    this._isParsingComplete = false;
    console.time("parse")
    await this.processFile();
    console.timeEnd("parse")
    const excessives = Object.keys(this.acc).filter(
      (company) => this.acc[company].isExcessive,
    );

    this._isParsingComplete = true;
    return this.setExcessives(excessives);
  }

  /**
   * Returns the total number of companies that are not involved in any excessive cancelling.
   * Note this should always resolve a number or throw error.
   */
  async totalNumberOfWellBehavedCompanies() {
    if (!this._isParsingComplete) {
      await this.companiesInvolvedInExcessiveCancellations();
    }

    const total = Object.keys(this.acc).length;
    return total - this.exessives.length;
  }
}
