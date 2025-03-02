// Import our custom CSS
import '../scss/style.scss'

// Import all of Bootstrap's JS
import * as bootstrap from 'bootstrap'


import Plotly from "plotly.js-dist-min";
import { loadPyodide } from "pyodide";


function rx_packet(packet, sh_format){
    const rx_log = document.getElementById("rx_log");
    var log_entry = document.createElement("div");
    log_entry.innerText = packet
    log_entry.classList.add("alert-info")
    log_entry.classList.add("alert")
    rx_log.prepend(log_entry)
    if(sh_format){
        console.log(sh_format.toJs())
        const response = fetch("https://api.v2.sondehub.org/amateur/telemetry",{
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify([sh_format.toJs()]) 
        }).then(response => {
            var sh_log_entry = document.createElement("div");
            sh_log_entry.innerText = ""
            sh_log_entry.classList.add("alert")
            if (response.headers.get('content-type') == 'application/json') {
                response.json().then(
                    body => {
                        if ('message' in body){
                            sh_log_entry.innerText = body.message
                        }
                        if ('errors' in body && body.errors.length > 0){
                            sh_log_entry.classList.add("alert-danger")
                        } else if ('warnings' in body && body.warnings.length > 0){
                            sh_log_entry.classList.add("alert-warning")
                        }
                        if ('errors' in body){
                            for(var x in body.errors){
                                sh_log_entry.innerText = sh_log_entry.innerText + "\n" + body.errors[x].error_message
                            }
                        }
                        if ('warnings' in body){
                            for(var x in body.warnings){
                                sh_log_entry.innerText = sh_log_entry.innerText + "\n" + body.warnings[x].warning_message
                            }
                        }

                        rx_log.prepend(sh_log_entry)
                    }
                )
            } else {
                response.text().then(
                    body => {
                        if (response.status >= 200 && response.status <= 299) {
                            sh_log_entry.classList.add("alert-info")
                        } else {
                            sh_log_entry.classList.add("alert-danger")
                        }
                        sh_log_entry.innerText = body
                        rx_log.prepend(sh_log_entry)
                    }
                )
            }
            
        })
       
    }
}

Plotly.newPlot('snr', [{
  y: [],
  mode: 'lines',
  line: {color: '#80CAF6'}
}],{
    height: 200,
    margin: {
        l: 20,
        r: 0,
        b: 0,
        t: 0,
        pad: 0
      },
});

function updateSNR(snr) {
  Plotly.extendTraces('snr', {
    y: [[snr]]
  }, [0], 256)

}

// Plotly.newPlot('fft', [{
//     z: [],
//     mode: 'heatmap'
//   }]);

// function updateFFT(data){
//     console.log(data)
//     Plotly.extendTraces('fft', {
//         z: [[data]]
//       }, [0])
    
// }

var refresh_input_timer = null;  
function refresh_input(){
    if(refresh_input_timer != null) clearTimeout(refresh_input_timer); 
    refresh_input_timer = setTimeout(function(){
        var callsign = document.getElementById("callsign").value
        var antenna = document.getElementById("uploader_antenna").value
        var radio = document.getElementById("uploader_radio").value
        var position = null;
        if (document.getElementById("uploader_position").checked){
            position = [
                document.getElementById("uploader_lat").value,
                document.getElementById("uploader_lon").value,
                document.getElementById("uploader_alt").value
            ]
        }
        console.log([callsign, radio, antenna, position])
        update_uploader(callsign, radio, antenna, position);
    },3000);
}

globalThis.refresh_input = refresh_input

globalThis.rx_packet = rx_packet
globalThis.updateSNR = updateSNR

async function main() {

    const pyodide = await loadPyodide();

    //await pyodide.loadPackage("./assets/micropip-0.8.0-py3-none-any.whl")
    //await pyodide.loadPackage("./assets/packaging-24.2-py3-none-any.whl")
    
    
    
    //await pyodide.loadPackage("cffi")
    //const micropip = pyodide.pyimport("micropip");
    //await micropip.install("file:///webhorus-0.1.0-cp312-cp312-pyodide_2024_0_wasm32.whl");
    
    await pyodide.loadPackage("./assets/cffi-1.17.1-cp312-cp312-pyodide_2024_0_wasm32.whl")
    await pyodide.loadPackage("./assets/pycparser-2.22-py3-none-any.whl")
    await pyodide.loadPackage("./assets/crc-7.1.0-py3-none-any.whl")
    await pyodide.loadPackage("./assets/idna-3.7-py3-none-any.whl")
    await pyodide.loadPackage("./assets/charset_normalizer-3.3.2-py3-none-any.whl")
    await pyodide.loadPackage("./assets/python_dateutil-2.9.0.post0-py2.py3-none-any.whl")
    await pyodide.loadPackage("./assets/requests-2.32.3-py3-none-any.whl")
    await pyodide.loadPackage("./assets/six-1.16.0-py2.py3-none-any.whl")
    await pyodide.loadPackage("./assets/urllib3-2.2.3-py3-none-any.whl")
    await pyodide.loadPackage("./assets/certifi-2024.12.14-py3-none-any.whl")
    await pyodide.loadPackage("./assets/webhorus-0.1.0-cp312-cp312-pyodide_2024_0_wasm32.whl");

    await pyodide.runPython(`
    import struct
    from pyodide.ffi import to_js
    from pyodide.ffi import create_proxy
    from js import document, rx_packet, updateSNR
    
    from webhorus import demod
    
    sh = demod.SondehubUploader()

    from horusdemodlib.decoder import decode_packet

    horus_demod = demod.Demod()
    
    buffer = b''

    def update_uploader(
        callsign,
        radio,
        antenna,
        location
    ):
        sh.user_callsign=callsign
        sh.user_position=location
        sh.user_radio=radio
        sh.user_antenna=antenna

    def write_audio(data):
      data = data.to_py(depth=1)
      data = struct.pack('h'*len(data),*data)
      frame = horus_demod.demodulate(data)
      #print(horus_demod.modem_stats)
      #print(horus_demod.modem_stats['snr_est'])
      updateSNR(horus_demod.modem_stats['snr_est'])
      if frame and frame.crc_pass:
          packet = decode_packet(frame.data)
          sh_format =  sh.reformat_data(packet)
          rx_packet(packet,sh_format)
      return to_js(horus_demod.nin)
`);
    globalThis.nin =  await pyodide.runPython("to_js(horus_demod.nin)")
    globalThis.write_audio = await pyodide.runPython("write_audio")
    globalThis.update_uploader = await pyodide.runPython("update_uploader")
    refresh_input();
    document.getElementById("audio_start").removeAttribute("disabled");
    document.getElementById("audio_start").innerText = "Start"
}


async function add_constraints(constraint){
  const stream = await navigator.mediaDevices.getUserMedia(constraint)
  const supported_constraints = await stream.getTracks()[0].getCapabilities()
  const wanted = ["echoCancellation", "autoGainControl", "noiseSuppression"]
  for (var x of wanted){
    
    if (x in supported_constraints){
      constraint.audio[x] = {"ideal": false}
    }
  }
  constraint.audio.deviceId = supported_constraints.deviceId
  
  return constraint
}


async function snd_change(){
    console.log("changing sound device")
    stop_microphone();
    var constraint = {
        "audio": {
                "deviceId": {"exact": document.getElementById("sound_adapter").value},
                
            }
        }
    startAudio(constraint)
}

globalThis.snd_change = snd_change

var microphone_stream = null
var audio_buffer = []



async function startAudio(constraint) {

    globalThis.audioContext = new AudioContext({ sampleRate: 48000 });
    await audioContext.audioWorklet.addModule('assets/js/audio.js')
    console.log("audio is starting up ...");

    if (constraint == undefined){
        var audio_constraint = { audio: {} }
    } else {
        var audio_constraint = constraint
    }
    const audio_constraint_filters = await add_constraints(audio_constraint)
    console.log(audio_constraint_filters.audio.deviceId)
    
    console.log(document.getElementById("sound_adapter"))
    navigator.mediaDevices.getUserMedia(audio_constraint_filters).then((stream) =>
    {
        console.log(audio_constraint_filters)
        if (constraint == undefined){
            navigator.mediaDevices.enumerateDevices().then(devices => {
                document.getElementById("sound_adapter").removeAttribute("disabled")
                document.getElementById("snd_ph").remove()
                for(var index in devices){
                    if (devices[index].kind == 'audioinput') {
                        var snd_opt = document.createElement("option")
                        snd_opt.innerText = devices[index].label
                        snd_opt.value = devices[index].deviceId
                        document.getElementById("sound_adapter").appendChild(snd_opt)
                    }
                }
                document.getElementById("sound_adapter").value=audio_constraint_filters.audio.deviceId
            })
        }
        document.getElementById("sound_adapter").value=audio_constraint_filters.audio.deviceId
        
        start_microphone(stream);
        document.getElementById("audio_start").setAttribute("disabled","disabled");
        document.getElementById("audio_start").classList.add("btn-outline-success")
        document.getElementById("audio_start").innerText = "Running"
    })


    function on_audio(data){
      audio_buffer = audio_buffer.concat(data)
        if (audio_buffer.length > globalThis.nin ){
          var to_modem = audio_buffer.splice(0,nin)
          globalThis.nin = write_audio(to_modem)
        }
        
    }
        


    function start_microphone(stream) {
        try {
            microphone_stream = audioContext.createMediaStreamSource(stream);
        } catch(err) {
            console.log(err)
            const rx_log = document.getElementById("rx_log");
            var log_entry = document.createElement("div");
            log_entry.innerText = "Error opening audio device. For firefox users - ensure your default sound device is set to 48,000 sample rate in your OS settings"
            log_entry.classList.add("alert-danger")
            log_entry.classList.add("alert")
            rx_log.prepend(log_entry)
        }

        var horusNode = new AudioWorkletNode(audioContext, 'horus');
        microphone_stream.connect(horusNode);
        horusNode.port.onmessage = (e) => {
          on_audio(e.data)
        }
        audioContext.resume()


    }

   

};

globalThis.startAudio = startAudio

function stop_microphone(){
    microphone_stream.mediaStream.getTracks()[0].stop()
    microphone_stream.disconnect()
}

globalThis.stop_microphone = stop_microphone

export { rx_packet, updateSNR}

main();