import struct
from pyodide.ffi import to_js
from pyodide.ffi import create_proxy
from js import document, rx_packet, updateStats, navigator
import datetime
from webhorus import demod
from horusdemodlib.decoder import decode_packet
from horusdemodlib.utils import telem_to_sondehub, fix_datetime

VERSION = "0.0.2"

horus_demod = demod.Demod(tone_spacing=int(document.getElementById("tone_spacing").value))

buffer = b''

def update_tone_spacing(tone_spacing):
    global horus_demod
    horus_demod = demod.Demod(tone_spacing=tone_spacing)
    print(f"Updated tonespacing to : {tone_spacing}")

def write_audio(data):
    data = data.to_py(depth=1)
    data = struct.pack('h'*len(data),*data)
    frame = horus_demod.demodulate(data)
    updateStats(horus_demod.modem_stats)
    sh_meta = {
            "software_name": "webhorus",
            "software_version": f"{VERSION} {navigator.userAgent}",
            "uploader_callsign": document.getElementById("callsign").value,
            "uploader_radio": document.getElementById("uploader_radio").value,
            "uploader_antenna": document.getElementById("uploader_antenna").value,
            "time_received": datetime.datetime.now(datetime.timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%S.%fZ"
            ),
        }
    if (document.getElementById("uploader_position").checked
        and document.getElementById("uploader_lat").value
        and document.getElementById("uploader_lon").value
        and document.getElementById("uploader_alt").value
    ):
        sh_meta["uploader_position"] = [
            float(document.getElementById("uploader_lat").value),
            float(document.getElementById("uploader_lon").value),
            float(document.getElementById("uploader_alt").value)
        ]
    

    if frame and frame.crc_pass:
        packet = decode_packet(frame.data)
        if document.getElementById("upload_sondehub").checked:
            sh_format = telem_to_sondehub(packet,sh_meta, check_time=False if packet['payload_id'] == '4FSKTEST-V2' else True)
        else:
            sh_format = None
        rx_packet(packet,sh_format,horus_demod.modem_stats)
    return to_js(horus_demod.nin)
