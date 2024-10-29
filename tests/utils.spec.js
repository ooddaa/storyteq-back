import { calculateRatio, normalizeTrade } from "../src/utils"

describe("utils", () => {
  it("should calculate ratio", () => {
    expect(calculateRatio(0,0)).toEqual(0)
    expect(calculateRatio(1,0)).toEqual(0)
    expect(calculateRatio(1,1)).toEqual(1/2)
    expect(calculateRatio(1,2)).toEqual(2/3)
  })
  
  it("should return normalized trade", () => {
    const trade = [ '2015-02-28 07:58:14', 'Bank of Mars', 'D', '140' ]
    const result = [1425110294, 'Bank of Mars', 'D', 140]
    expect(normalizeTrade(trade)).toEqual(result)
  })
})

