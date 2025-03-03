// Import our custom CSS
import '../scss/style.scss'

// Import all of Bootstrap's JS
import * as bootstrap from 'bootstrap'


import Plotly from "plotly.js-dist-min";
import { loadPyodide } from "pyodide";


globalThis.rx_packet = function(packet, sh_format){
    log_entry(packet, "info")

    if(sh_format){
        console.log(sh_format.toJs())
        const response = fetch("https://api.v2.sondehub.org/amateur/telemetry",{
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify([sh_format.toJs()]) 
        }).then(response => {
            var sh_log_text = ""
            var sh_log_level = "info"
            if (response.headers.get('content-type') == 'application/json') {
                response.json().then(
                    body => {
                        if ('message' in body){
                            sh_log_text = body.message
                        }
                        if ('errors' in body && body.errors.length > 0){
                            sh_log_level = "danger"
                        } else if ('warnings' in body && body.warnings.length > 0){
                            sh_log_level = "warning"
                        }
                        if ('errors' in body){
                            for(var x in body.errors){
                                sh_log_text = sh_log_text + "\n" + body.errors[x].error_message
                            }
                        }
                        if ('warnings' in body){
                            for(var x in body.warnings){
                                sh_log_text = sh_log_text + "\n" + body.warnings[x].warning_message
                            }
                        }
                        log_entry(sh_log_text, sh_log_level)
                    }
                )
            } else {
                response.text().then(
                    body => {
                        if (response.status >= 200 && response.status <= 299) {
                            sh_log_level = "info"
                        } else {
                            sh_log_level = "danger"
                        }
                        sh_log_text = body
                        log_entry(sh_log_text, sh_log_level)
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

globalThis.updateSNR = function(snr) {
  Plotly.extendTraces('snr', {
    y: [[snr]]
  }, [0], 256)

}

async function init_python() {

    const pyodide = await loadPyodide();

    await Promise.all([
        pyodide.loadPackage("./assets/cffi-1.17.1-cp312-cp312-pyodide_2024_0_wasm32.whl"),
        pyodide.loadPackage("./assets/pycparser-2.22-py3-none-any.whl"),
        pyodide.loadPackage("./assets/crc-7.1.0-py3-none-any.whl"),
        pyodide.loadPackage("./assets/idna-3.7-py3-none-any.whl"),
        pyodide.loadPackage("./assets/charset_normalizer-3.3.2-py3-none-any.whl"),
        pyodide.loadPackage("./assets/python_dateutil-2.9.0.post0-py2.py3-none-any.whl"),
        pyodide.loadPackage("./assets/requests-2.32.3-py3-none-any.whl"),
        pyodide.loadPackage("./assets/six-1.16.0-py2.py3-none-any.whl"),
        pyodide.loadPackage("./assets/urllib3-2.2.3-py3-none-any.whl"),
        pyodide.loadPackage("./assets/certifi-2024.12.14-py3-none-any.whl"),
        pyodide.loadPackage("./assets/webhorus-0.1.0-cp312-cp312-pyodide_2024_0_wasm32.whl")
    ]);

    await pyodide.runPython(await (await fetch("./assets/py/main.py")).text());

    globalThis.nin =  await pyodide.runPython("to_js(horus_demod.nin)")
    globalThis.write_audio = await pyodide.runPython("write_audio")

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


globalThis.snd_change = async function(){
    console.log("changing sound device")
    var constraint = {
        "audio": {
                "deviceId": {"exact": document.getElementById("sound_adapter").value},
                
            }
        }
    startAudio(constraint)
}




var microphone_stream = null

globalThis.startAudio = async function(constraint) {
    var audio_buffer = []

    globalThis.audioContext = new AudioContext({ sampleRate: 48000 });
    await audioContext.audioWorklet.addModule('assets/js/audio.js')
    console.log("audio is starting up ...");

    if (constraint == undefined){
        var audio_constraint = { audio: {} }
    } else {
        var audio_constraint = constraint
    }
    const audio_constraint_filters = await add_constraints(audio_constraint)
    
    navigator.mediaDevices.getUserMedia(audio_constraint_filters).then((stream) =>
    {
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
        if (microphone_stream){
            microphone_stream.mediaStream.getTracks()[0].stop()
            microphone_stream.disconnect()
        }
        try {
            microphone_stream = audioContext.createMediaStreamSource(stream);
        } catch(err) {
            console.log(err)
            log_entry("Error opening audio device. For firefox users - ensure your default sound device is set to 48,000 sample rate in your OS settings", "danger")
        }

        var horusNode = new AudioWorkletNode(audioContext, 'horus');
        microphone_stream.connect(horusNode);
        horusNode.port.onmessage = (e) => {
          on_audio(e.data)
        }
        audioContext.resume()
    }
};

function log_entry(message, level){
    const rx_log = document.getElementById("rx_log");
    var log_entry = document.createElement("div");
    log_entry.innerText = message
    log_entry.classList.add("alert-" + level)
    log_entry.classList.add("alert")
    rx_log.prepend(log_entry)
}


init_python();