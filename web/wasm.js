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
                            for(x in body.errors){
                                sh_log_entry.innerText = sh_log_entry.innerText + "\n" + body.errors[x].error_message
                            }
                        }
                        if ('warnings' in body){
                            for(x in body.warnings){
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

async function main() {
    pyodide = await loadPyodide();

    await pyodide.loadPackage("micropip")
    await pyodide.loadPackage("cffi")
    const micropip = pyodide.pyimport("micropip");
    await micropip.install("https://horus.sondehub.org/webhorus-0.1.0-cp312-cp312-pyodide_2024_0_wasm32.whl");
    await console.log(pyodide.runPython(`
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
      global buffer
      data = data.to_py(depth=1)
      data = struct.pack('h'*len(data),*data)
      buffer = buffer + data
      
      if len(buffer) > horus_demod.nin*2:
        audio_in = buffer[:horus_demod.nin*2]
        buffer = buffer[horus_demod.nin*2:]
        frame = horus_demod.demodulate(audio_in)
        updateSNR(horus_demod.modem_stats['snr_est'])
        if frame and frame.crc_pass:
            packet = decode_packet(frame.data)
            sh_format =  sh.reformat_data(packet)
            rx_packet(packet,sh_format)
        
`));

    write_audio = await pyodide.runPython("write_audio")
    update_uploader = await pyodide.runPython("update_uploader")
    refresh_input();
    document.getElementById("audio_start").removeAttribute("disabled");
    document.getElementById("audio_start").innerText = "Start"
}
main();




function snd_change(){
    console.log("changing sound device")
    stop_microphone();
    var constraint = {
        "audio": {
                "deviceId": {"exact": document.getElementById("sound_adapter").value}
            }
        }
    startAudio(constraint)
}

var microphone_stream = null

function startAudio(constraint) {

    audioContext = new AudioContext({ sampleRate: 48000 });
    audioContext.audioWorklet.addModule('audio.js');

    console.log("audio is starting up ...");

    if (constraint == undefined){
        var audio_constraint = { audio: true }
    } else {
        var audio_constraint = constraint
    }

    

    navigator.mediaDevices.getUserMedia(audio_constraint).then((stream) =>
    {
        if (constraint == undefined){
            navigator.mediaDevices.enumerateDevices().then(devices => {
                document.getElementById("sound_adapter").removeAttribute("disabled")
                document.getElementById("snd_ph").remove()
                for(index in devices){
                    if (devices[index].kind == 'audioinput') {
                        var snd_opt = document.createElement("option")
                        snd_opt.innerText = devices[index].label
                        snd_opt.value = devices[index].deviceId
                        document.getElementById("sound_adapter").appendChild(snd_opt)
                    }
                }
                console.log(devices)
            })
        }
        start_microphone(stream);
        document.getElementById("audio_start").setAttribute("disabled","disabled");
        document.getElementById("audio_start").classList.add("btn-outline-success")
        document.getElementById("audio_start").innerText = "Running"
    })



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

        horusNode = new AudioWorkletNode(audioContext, 'horus');
        microphone_stream.connect(horusNode);
        horusNode.port.onmessage = (e) => {
            write_audio(e.data)
        }


    }

   

};

function stop_microphone(){
    microphone_stream.mediaStream.getTracks()[0].stop()
    microphone_stream.disconnect()
}