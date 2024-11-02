export default class RingBuffer {
  // we are going to have a fixed buffer length
   
  constructor(length = 5) {
    if (length == 0) throw new Error(`cannot create a RingBuffer with length: ${length}`)
    this.buffer = []
    this.length = length
    this.head = 0 // remove at this index
    this.tail = -1 // last written index
    this._hasCircled = false
  }

  // we push to the tail
  push(val, offset = 0, { returnOverwrites } = { returnOverwrites: false}) { 
    // will circle over
    const hasCircled = this.tail + 1 + offset > (this.length -1)
    if (hasCircled) this._hasCircled = true
    
    const newTail = (this.tail + 1 + offset) % this.length
    const oldHead = this.head

    if (this._hasCircled) {
       // move head
      this.head = (newTail + 1) % this.length
    }

    const overwrittenValue = this.buffer[newTail]
    
    let overwrittenValues = []

    // do we need to drain the whole buffer as we have 
    // circled over it once fully
    if (this._hasCircled) {
      // if we have circled over the whole buffer 
      if (offset > this.length) {
        // we then overwrote all values 
        overwrittenValues = [...this.buffer]
      } else {
        // or just a portion
        for (let i = oldHead; i < newTail; ++i) {
           overwrittenValues.push(this.buffer[i % this.length])
        }
      }      
    } 

    this.buffer[newTail] = val 
    this.tail = newTail 

    return returnOverwrites ? overwrittenValues : overwrittenValue
  }

  // we pop from the head
  pop() {
    if (!this.buffer.length) {
      return undefined
    }

    const head = this.head
    const value = this.buffer[head]
    this.buffer[head] = undefined 

    // move head forward
    if (this.head != this.tail) {
      this.head = (this.head + 1) % this.length
    }

    return value 
  }

  get(index) {
    if (index > this.length - 1) return this.buffer[index % this.length]
    return this.buffer[index]
  }

  reset() {
    this.tail = -1 
    this.head = 0
    this.buffer = []
    return this
  }

  getHead() {
    return this.buffer[this.head]
  }

  getTail() {
    return this.buffer[this.tail]
  }
}
