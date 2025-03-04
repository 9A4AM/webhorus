import struct
from pyodide.ffi import to_js
from pyodide.ffi import create_proxy
from js import document, rx_packet, updateSNR, navigator
import datetime
from webhorus import demod
from horusdemodlib.decoder import decode_packet
from horusdemodlib.utils import telem_to_sondehub

VERSION = "0.0.2"

horus_demod = demod.Demod()

buffer = b''

def write_audio(data):
    data = data.to_py(depth=1)
    data = struct.pack('h'*len(data),*data)
    frame = horus_demod.demodulate(data)
    updateSNR(horus_demod.modem_stats['snr_est'])
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
    if document.getElementById("uploader_position").checked:
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
        rx_packet(packet,sh_format)
    return to_js(horus_demod.nin)
