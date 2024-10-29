import { ExcessiveCancellationsChecker } from '../src/excessive-cancellations-checker.js'

describe("Excessive Cancellations Test", () => {

    describe("constructor", () => {
        it("throws an error if no valid filePath is given", async () => {
           expect(() => new ExcessiveCancellationsChecker()).toThrow()
        });
    });

    describe("companiesInvolvedInExcessiveCancellations", () => {

        it("generates an empty the list if file contains no trades", async () => {
            const checker = new ExcessiveCancellationsChecker("./data/empty.csv")
            const companiesList = await checker.companiesInvolvedInExcessiveCancellations();
            expect(companiesList).toEqual([]);
        });
        it("generates an empty the list if file does not contain valid trades", async () => {
            const checker = new ExcessiveCancellationsChecker("./data/error_data.csv")
            const companiesList = await checker.companiesInvolvedInExcessiveCancellations();
            expect(companiesList).toEqual([]);
        });
        it("generates the list of companies that are involved in excessive cancelling in under a minute", async () => {
            const checker = new ExcessiveCancellationsChecker("./data/less_than_minute.csv")
            const companiesList = await checker.companiesInvolvedInExcessiveCancellations();
            expect(companiesList).toEqual(["Panda consulting"]);
        });
        it("generates the list of companies that are involved in excessive cancelling for one trade", async () => {
            const checker = new ExcessiveCancellationsChecker("./data/one_trade.csv")
            const companiesList = await checker.companiesInvolvedInExcessiveCancellations();
            expect(companiesList).toEqual(["Panda consulting"]);
        });

    });
    describe("totalNumberOfWellBehavedCompanies", () => {
        it("returns the total number of companies that are not involved in any excessive cancelling (small)", async () => {
            const checker = new ExcessiveCancellationsChecker("./data/one_good_company.csv")
            const companies = await checker.totalNumberOfWellBehavedCompanies();
            expect(companies).toEqual(1);
        });
        it("returns the total number of companies that are not involved in any excessive cancelling (full)", async () => {
            const checker = new ExcessiveCancellationsChecker("./data/trades.csv")
            const companies = await checker.totalNumberOfWellBehavedCompanies();
            expect(companies).toEqual(12);
        });
  });
});


