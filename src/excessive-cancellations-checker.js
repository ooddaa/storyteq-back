import fs from "node:fs"
import { parse } from 'csv-parse'
import { finished } from 'node:stream/promises'
import { calculateRatio, normalizeTrade } from './utils'


const updateAcc = (acc, trade) => {
  let [ timestamp, company, orderType, value ] = trade
  const isNewOrder = orderType == "D"

  if (!acc[company]) {
    acc[company] = { isExcessive: !isNewOrder, data: isNewOrder ? [0, value, 0, [[timestamp, value]]] : [1, 0, -value, [[timestamp, -value]]]
    }  
    return acc 
  }


    let [ratio, tot_d, tot_f, values] = acc[company]?.data

    while (values.length && ((timestamp - values[0][0]) > 59)) {
      // shift and restore ratio   
      const [t, v] = values.shift()
      tot_d = v < 0 ? tot_d : tot_d - v
      tot_f = v > 0 ? tot_f : tot_f - v
    }
     
    // add current trade and update state
    tot_d = isNewOrder ? tot_d + value : tot_d
    tot_f = isNewOrder ? tot_f : tot_f - value
    ratio = calculateRatio(tot_d, tot_f)
    
    acc[company].isExcessive = ratio > 1/3 
  
    acc[company].data = [ratio, tot_d, tot_f, [...values, [timestamp, isNewOrder ? value : -value]]
]
   
  return acc  
}

export class ExcessiveCancellationsChecker {
    /* 
        We provide a path to a file when initiating the class
        you have to use it in your methods to solve the task
    */
    constructor(filePath) {
        this.filePath = this.validateFilePath(filePath);
        this._isParsingComplete = false;
        this.acc = {}
        this.exessives = []
    }

    async processFile() {
      const ctx = this

       try {
       const parser = fs.createReadStream(this.filePath).pipe(parse({ delimiter: ",", skipRecordsWithError: true, skipRecordsWithEmptyValues: true}))

        parser.on("readable", function() {
          let trade; 
           while ((trade = parser.read()) !== null) {
              updateAcc(ctx.acc, normalizeTrade(trade))
          }
        })
        
       parser.on("error", function(error) {
           console.error(error)
        })
        
        parser.on("end", function() {
           return ctx.acc
        })
        
         await finished(parser)
         return this.acc
       } catch (err) {
           console.error("processFile crashed", err)
       }
  }

    validateFilePath(filePath) {
        if (!filePath) throw new Error(`no valid filePath given:\n ${JSON.stringify(filePath)}`)
        return filePath
    }

    setExcessives(list) {
      this.exessives = list
      return list
    }

    /**
    * Returns the list of companies that are involved in excessive cancelling.
    * Note this should always resolve an array or throw error.
    */
    async companiesInvolvedInExcessiveCancellations() {
        this._isParsingComplete = false
        await this.processFile() 
        const excessives = Object.keys(this.acc).filter(company => this.acc[company].isExcessive)
        
        this._isParsingComplete = true
        return this.setExcessives(excessives)

    }

    /**
     * Returns the total number of companies that are not involved in any excessive cancelling.
     * Note this should always resolve a number or throw error.
    */
    async totalNumberOfWellBehavedCompanies() {
          if (!this._isParsingComplete) {
              await this.companiesInvolvedInExcessiveCancellations()
          }

          const total = Object.keys(this.acc).length
          return total- this.exessives.length
    }
    
}
