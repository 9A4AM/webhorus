
class Horus extends AudioWorkletProcessor {

    constructor() {
      // The super constructor call is required.
      super();
    }

    

    process(inputs, outputs, parameters) {
      const input = inputs[0];
      if (input.length >= 1){
        var b = Array.from(Int16Array.from(input[0], x => x * 32768));
        this.port.postMessage(b);
      }

      return true;
    }
  }
  registerProcessor('horus', Horus);