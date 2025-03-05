// Import our custom CSS
import '../scss/style.scss'

// Import all of Bootstrap's JS
import * as bootstrap from 'bootstrap'


import * as Plotly from "plotly.js-dist-min";

import "leaflet";

var mapPickerMap;

function loadMapPicker(){
    mapPickerMap = L.map('location_picker', {}).setView([-37.8136, 144.9631], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapPickerMap);

    document.getElementById('mapPickerModal').addEventListener("shown.bs.modal",(x)=>{
        mapPickerMap.invalidateSize();
    });

    var marker;
    mapPickerMap.on('click', function(e) {
        if(marker){
            mapPickerMap.removeLayer(marker);
        }
        marker = L.marker(e.latlng).addTo(mapPickerMap);
    });

    globalThis.saveLocation = function(){
        if(marker){
            document.getElementById("uploader_lat").value = marker.getLatLng().lat
            document.getElementById("uploader_lon").value = marker.getLatLng().lng
            globalThis.saveSettings()
        }
    }
}

var trackMap;
var markers = {};
var tracks = {};

function loadTrackMap(){
    trackMap = L.map('trackMap', {}).setView([-37.8136, 144.9631], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(trackMap);

}

import { loadPyodide } from "pyodide";

globalThis.saveSettings = function(){
    localStorage.setItem("sound_adapter", document.getElementById("sound_adapter").value)
    localStorage.setItem("callsign", document.getElementById("callsign").value)
    localStorage.setItem("uploader_radio", document.getElementById("uploader_radio").value)
    localStorage.setItem("uploader_antenna", document.getElementById("uploader_antenna").value)
    localStorage.setItem("uploader_lat", document.getElementById("uploader_lat").value)
    localStorage.setItem("uploader_lon", document.getElementById("uploader_lon").value)
    localStorage.setItem("uploader_alt", document.getElementById("uploader_alt").value)
    localStorage.setItem("upload_sondehub", document.getElementById("upload_sondehub").checked)
    localStorage.setItem("uploader_position", document.getElementById("uploader_position").checked)
    localStorage.setItem("dial", document.getElementById("dial").value)
}

globalThis.loadSettings = function(){
    if (localStorage.getItem("callsign")) { document.getElementById("callsign").value = localStorage.getItem("callsign")}
    if (localStorage.getItem("uploader_radio")) { document.getElementById("uploader_radio").value = localStorage.getItem("uploader_radio")}
    if (localStorage.getItem("uploader_antenna")) { document.getElementById("uploader_antenna").value = localStorage.getItem("uploader_antenna")}
    if (localStorage.getItem("uploader_lat")) { document.getElementById("uploader_lat").value = localStorage.getItem("uploader_lat")}
    if (localStorage.getItem("uploader_lon")) { document.getElementById("uploader_lon").value = localStorage.getItem("uploader_lon")}
    if (localStorage.getItem("uploader_alt")) { document.getElementById("uploader_alt").value = localStorage.getItem("uploader_alt")}
    if (localStorage.getItem("upload_sondehub")) { document.getElementById("upload_sondehub").checked = localStorage.getItem("upload_sondehub")}
    if (localStorage.getItem("uploader_position")) { document.getElementById("uploader_position").checked = localStorage.getItem("uploader_position")}
    if (localStorage.getItem("dial")) { document.getElementById("dial").value = localStorage.getItem("dial")}

}

function addFrame(data){
    const frames_div = document.getElementById("frames")
    const card = document.createElement("div")
    card.classList="card text-dark bg-light mb-3 me-3"
    card.style = "width: fit-content; display: inline-block"
    

    const cardTitle = document.createElement("div")
    cardTitle.classList = "card-header h5"
    cardTitle.innerText = "["+ data.sequence_number + "] " +  data.time
    card.appendChild(cardTitle)

    const cardBody = document.createElement("div")
    cardBody.classList = "card-body"
    card.appendChild(cardBody)

    const fieldTable = document.createElement("table")
    fieldTable.classList = "table card-text"
    cardBody.appendChild(fieldTable)

    for (let field_name of data.packet_format.fields.map((x)=>x[0]).concat(data.custom_field_names)) {
        if (field_name != "custom" && field_name != "checksum" && field_name != "sequence_number" && field_name != "time"){
            const field = document.createElement("tr")
            fieldTable.appendChild(field)
            const fieldName = document.createElement("th")
            field.appendChild(fieldName)
            const titleCase = (str) => str.replace(/\b\S/g, t => t.toUpperCase());
            fieldName.innerText = titleCase(field_name.replace("_"," "))
            const fieldValue = document.createElement("td")
            fieldValue.innerText = data[field_name]
            field.appendChild(fieldValue)
        }
       
    }

    // const cardText = document.createElement("p")
    // cardText.classList = "card-text"
    // cardText.innerText = "meow2"
    // cardBody.appendChild(cardText)

    frames_div.prepend(card)
}

function updateMarker(data){
    const position = L.latLng(data.latitude, data.longitude)
    // create marker if not exists, otherwise update
    if(data.payload_id in markers){
        markers[data.payload_id].setLatLng(position)
    } else {
        markers[data.payload_id] = L.circleMarker(position)
        markers[data.payload_id].bindTooltip(data.payload_id);
        markers[data.payload_id].addTo(trackMap);
    }
    
    // update tracks
    if(!(data.payload_id in tracks)){
        tracks[data.payload_id] = L.polyline([position], {color: 'red'}).addTo(trackMap);
    } else {
        tracks[data.payload_id].addLatLng(position)
    }

    trackMap.panTo(position);
}

globalThis.rx_packet = function(packet, sh_format,stats){
    log_entry(packet, "info")

    var freq_est = stats.toJs().f_est
    var freq_mean = freq_est.reduce((a,b)=>a+b,0)/freq_est.length

    var final_freq

    if (document.getElementById("dial").value){
        var dial_freq = parseFloat(document.getElementById("dial").value)
        if (!isNaN(dial_freq)){
            dial_freq = dial_freq * 1000000
            final_freq = (freq_mean + dial_freq)/1000000
        }
    }

    if(sh_format){
        var sh_packet = sh_format.toJs()
        if (final_freq){
            sh_packet['frequency'] = final_freq
        }
        
        // Mark will want me to do some peak hold stuff here, but honestly that just seems like too much work.
        sh_packet['snr'] = stats.toJs().snr_est

        const response = fetch("https://api.v2.sondehub.org/amateur/telemetry",{
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify([sh_packet]) 
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
    addFrame(packet.toJs())
    updateMarker(packet.toJs())
    updatePlots(packet.toJs())
}

var axis_mapping = []

function updatePlots(data) {
    var axis_ids = []
    var plot_data = []
    

    for (let field_name of data.packet_format.fields.map((x)=>x[0]).concat(data.custom_field_names)) {
        if (field_name != "custom" && 
            field_name != "checksum" &&
            field_name != "sequence_number" &&
            field_name != "time" && 
            field_name != "payload_id" && 
            field_name != "longitude" && 
            field_name != "latitude"
        ){
            var field_name_payload = field_name+"["+data.payload_id+"]"
            if (!(axis_mapping.includes(field_name_payload))){
                axis_mapping.push(field_name_payload)
                globalThis.Plotly.addTraces('plots',{y:[],x:[],name: field_name_payload, mode: 'lines'})
            }
            var axis_id = axis_mapping.indexOf(field_name_payload)
            axis_ids.push(axis_id)
            plot_data.push([data[field_name]])
        }
    }

    var plot_time = data.time

    globalThis.Plotly.extendTraces('plots',{y: plot_data, x:[...Array(plot_data.length)].map(()=>[plot_time])}, axis_ids, 256)
}

globalThis.Plotly.newPlot('snr', [{
    y: [],
    x: [],
    mode: 'lines'
  }],{
    height: 200,
    margin: {
        l: 35,
        r: 0,
        b: 30,
        t: 0,
        pad: 0
      },
    yaxis: {
        title: {
            text: 'SNR (dB)',
        },
        autorange: true,
        range: [-2, 20],
        autorangeoptions:{
            include: [-2,20]
        }
    }
},{responsive: true});


globalThis.Plotly.newPlot('plots', [],{
      height: 500,
      margin: {
          l: 35,
          r: 0,
          b: 30,
          t: 20,
          pad: 0
        },
      yaxis: {
         
          autorange: true,
         
      }
  },{responsive: true});

globalThis.updateSNR = function(snr) {
    globalThis.Plotly.extendTraces('snr', {
    y: [[snr]],
    x: [[new Date().toISOString()]]
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

    await pyodide.runPython(await (await fetch("/py/main.py")).text());

    globalThis.nin =  await pyodide.runPython("to_js(horus_demod.nin)")
    globalThis.write_audio = await pyodide.runPython("write_audio")
    globalThis.fix_datetime = await pyodide.runPython("fix_datetime")
    
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
    saveSettings()
}




var microphone_stream = null
var horusNode

globalThis.startAudio = async function(constraint) {

    globalThis.audioContext = new AudioContext({ sampleRate: 48000 });
    await audioContext.audioWorklet.addModule('/js/audio.js')
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
                const saved_device = localStorage.getItem("sound_adapter")
                const device_id_list = devices.map((device)=>device.deviceId)


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
                if (saved_device && device_id_list.includes(saved_device)){
                    document.getElementById("sound_adapter").value=saved_device
                    snd_change()
                } else {
                    start_microphone(stream);
                }
            })
        } else {
            document.getElementById("sound_adapter").value=audio_constraint_filters.audio.deviceId
            start_microphone(stream);
        }
    })


    function on_audio(audio_buffer){
        
        var max_audio = Math.max(...audio_buffer)

        // update dbfs meter - and yes I know how silly it is that we are turning these back to floats....
        var dBFS = 20*Math.log10(max_audio/32767); // technically we are ignoring half the signal here, but lets assume its not too bias'd
        var percent = (1-(dBFS/-120))*100 // I don't even know. just trying to represent the level
        if (!isFinite(percent)){
        percent=0;
        }
        document.getElementById("dbfs").style.width = percent.toFixed(2) + "%"
        document.getElementById("dbfstext").innerText = dBFS.toFixed(2) + " dBFS"
        if (dBFS > -5){
        document.getElementById("dbfs").classList = "progress-bar bg-danger"
        } else if (dBFS < -90){
        document.getElementById("dbfs").classList = "progress-bar bg-danger"
        } else if (dBFS < -50){
        document.getElementById("dbfs").classList = "progress-bar bg-warning"
        } else {
        document.getElementById("dbfs").classList = "progress-bar bg-success"
        }

        globalThis.nin = write_audio(audio_buffer)
        horusNode.port.postMessage(globalThis.nin)
        
        
    }
        


    function start_microphone(stream) {
        document.getElementById("audio_start").setAttribute("disabled","disabled");
        document.getElementById("audio_start").classList.add("btn-outline-success")
        document.getElementById("audio_start").innerText = "Running"
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

        horusNode = new AudioWorkletNode(audioContext, 'horus', {
            processorOptions: {
                nin: globalThis.nin
            }
        });
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

globalThis.loadSettings();
loadMapPicker()
loadTrackMap()
init_python();
