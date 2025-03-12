class RtlAudioWorker extends AudioWorkletProcessor {

    constructor(options) {
      // The super constructor call is required.
      super();
      this.expected_buffer_length = 512;
      this.number_of_extra_before_start = 80
      this.number_of_extra_before_pause = 50

      this.port.onmessage = (event) => {
        this.audio_buffer = this.audio_buffer.concat(Array.from(event.data))
        if (this.audio_buffer.length > this.expected_buffer_length * this.number_of_extra_before_start) {
            this.port.postMessage(true);
        }
      };
      this.audio_buffer = []
      this.ready = false
      
      console.log("audio buffer ready")
    }

    

    process(inputs, outputs, parameters) {
        const output = outputs[0]
        this.expected_buffer_length =  output[0].length
        if (this.audio_buffer.length > output[0].length && this.ready == true){
            if (this.audio_buffer.length < output[0].length * this.number_of_extra_before_pause) {
                this.port.postMessage(false);
            }
            var to_audio = this.audio_buffer.splice(0,output[0].length)
            for (var x=0;x<output[0].length;x++){
                output[0][x] = to_audio[x]
            }

        } else if (this.audio_buffer.length > output[0].length * this.number_of_extra_before_start) { 
            var to_audio = this.audio_buffer.splice(0,output[0].length)
            for (var x=0;x<output[0].length;x++){
                output[0][x] = to_audio[x]
            }
            
            
            if (this.ready == false){
                console.log("audio buffer ready to rumble")
                this.ready = true
            }
            
        } else if (this.ready == true) {
            console.log("rtlsdr -> audio underrun")
            this.ready = false
            this.port.postMessage(false);
        }
     
        return true;
    }
  }
  registerProcessor('rtlnode', RtlAudioWorker);