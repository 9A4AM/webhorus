
class Horus extends AudioWorkletProcessor {

    constructor(options) {
      // The super constructor call is required.
      super();
      this.nin = options.processorOptions.nin
      this.port.onmessage = (event) => {
          this.nin = event.data
      };
      this.audio_buffer = []
    }

    

    process(inputs, outputs, parameters) {
      const input = inputs[0];
      if (input.length >= 1){
        var b = Array.from(Int16Array.from(input[0], x => x * 32767));
        this.audio_buffer = this.audio_buffer.concat(b)
      }

      if (this.audio_buffer.length > this.nin ){
        var to_modem = this.audio_buffer.splice(0,this.nin)
        this.port.postMessage(to_modem)
      }
      return true;
    }
  }
  registerProcessor('horus', Horus);