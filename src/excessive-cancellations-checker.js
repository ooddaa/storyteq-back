import fs from "node:fs";
import { parse } from "csv-parse";
import { finished } from "node:stream/promises";
import { calculateRatio, normalizeTrade } from "./utils";
import RingBuffer from "./ring-buffer";

const BUFFER_SIZE = 60;

const updateAcc = (acc, trade) => {
  let [timestamp, company, orderType, value] = trade;
  const isNewOrder = orderType == "D";

  if (!acc[company]) {
    // init window buffer
    const buffer = new RingBuffer(BUFFER_SIZE);
    buffer.push([timestamp, isNewOrder ? value : -value]);

    acc[company] = {
      isExcessive: !isNewOrder,
      state: isNewOrder ? [0, value, 0, buffer] : [1, 0, -value, buffer],
    };

    return acc;
  }

  // get current state
  let [ratio, total_d, total_f, buffer] = acc[company]?.state || [];

  // has it been > 60 sec from last trade == do we need to reset window?
  // TODO: would be more readable to check if buffer is empty?
  const lastTradeTimestamp = buffer.getTail()?.[0] || 0; // also handles empty buffer case
  const timeGap = timestamp - lastTradeTimestamp;

  if (timeGap > BUFFER_SIZE) {
    buffer.reset().push([timestamp, isNewOrder ? value : -value]);
    acc[company].state = isNewOrder
      ? [0, value, 0, buffer]
      : [1, 0, -value, buffer];

    return acc;
  }

  // clean up stale walues
  const staleValues = buffer.push(
    [timestamp, isNewOrder ? value : -value],
    timeGap,
    { returnOverwrites: true },
  );

  // restore counters
  staleValues.filter(Boolean).forEach((element) => {
    const [_, value] = element;
    value <= 0 ? (total_f -= value) : (total_d -= value);
  });

  // add trade to current window
  isNewOrder ? (total_d += value) : (total_f -= value);

  // calculate ratio
  ratio = calculateRatio(total_d, total_f);
  const isExcessive = ratio > 1 / 3;
  acc[company].isExcessive = isExcessive;

  // update and return state
  acc[company].state = [ratio, total_d, total_f, buffer];

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
    await this.processFile();
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
