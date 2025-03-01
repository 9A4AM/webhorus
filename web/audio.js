
class Horus extends AudioWorkletProcessor {

    a= 0;
    constructor() {
      // The super constructor call is required.
      super();
    }

    process(inputs, outputs, parameters) {
      const input = inputs[0];
      //const output = outputs[0];
      //const outputChannel0 = output[0];
      var b = Array.from(Int16Array.from(input[0], x => x * 32767));
      //modem_rx(b)
    //   if (this.a < 100){
    //     console.log(b)
    //     console.log(sampleRate);
        
    //   }
   // console.log(b)
        this.port.postMessage(b);
      //this.a = this.a + 1;
      //outputChannel0[0] = b
      return true;
    }
  }
  registerProcessor('horus', Horus);