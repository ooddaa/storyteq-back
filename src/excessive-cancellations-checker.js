import fs from "node:fs";
import { parse } from "csv-parse";
import { finished } from "node:stream/promises";
import { calculateRatio, normalizeTrade } from "./utils.js";

const updateAcc = (acc, trade) => {
  let [timestamp, company, orderType, value] = trade;
  const isNewOrder = orderType == "D";

  if (!acc[company]) {
    acc[company] = {
      isExcessive: !isNewOrder,
      state: isNewOrder
        ? [0, value, 0, [[timestamp, value]]]
        : [1, 0, -value, [[timestamp, -value]]],
    };
    return acc;
  }

  // get current state
  let [ratio, total_d, total_f, values] = acc[company]?.state || [];

  while (values.length && timestamp - values[0][0] > 59) {
    // remove stale values from the current window
    // eslint-disable-next-line no-unused-vars
    const [_, value] = values.shift();
    value <= 0 ? (total_f -= value) : (total_d -= value);
  }

  // add trade to current window
  isNewOrder ? (total_d += value) : (total_f -= value);

  // calculate ratio
  ratio = calculateRatio(total_d, total_f);
  acc[company].isExcessive = ratio > 1 / 3;

  // update and return state
  acc[company].state = [
    ratio,
    total_d,
    total_f,
    [...values, [timestamp, isNewOrder ? value : -value]],
  ];

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
