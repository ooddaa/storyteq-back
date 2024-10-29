import utils from "util"

export const log = (...args) => console.log(utils.inspect(args, false, null))

export const calculateRatio = (d, f) => {
  if (!f) return 0
  return Math.abs(f) / (Math.abs(d) + Math.abs(f))
}

export const normalizeTrade = (trade) => {
   //const [ '2015-02-28 07:58:14', 'Bank of Mars', 'D', '140' ] = trade
   let [ timestamp, company, orderType, value ] = trade
   return [new Date(timestamp).valueOf() / 1e3, company, orderType, Number(value)] 
}
