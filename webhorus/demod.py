import _horus_api_cffi
import argparse
import datetime
import horusdemodlib.payloads


import horusdemodlib.decoder

horusdemodlib.decoder.horusdemodlib.payloads.HORUS_PAYLOAD_LIST = horusdemodlib.payloads.init_payload_id_list()
horusdemodlib.decoder.horusdemodlib.payloads.HORUS_CUSTOM_FIELDS = horusdemodlib.payloads.init_custom_field_list()
from horusdemodlib.delegates import fix_datetime

from dataclasses import dataclass

horus_api = _horus_api_cffi.lib



def stuct_to_dict(data):
    try:
        if data.__module__ == '_cffi_backend':
            data = list(data)
            data = [ 
                x
                if type(x).__module__ != '_cffi_backend'
                else stuct_to_dict(x) 
                for x in data
            ]
            return data
    except:
        pass
    return {
        x: data.__getattribute__(x)
        if type(data.__getattribute__(x)).__module__ != '_cffi_backend'
        else stuct_to_dict(data.__getattribute__(x)) 
        for x in dir(data)
    }

@dataclass
class Frame():
    data: bytes
    crc_pass: bool
    stats: dict

class Demod():
    def __init__(
            self,
            libpath=f"",
            mode=horus_api.HORUS_MODE_BINARY_V1,
            rate=-1,
            tone_spacing=-1,
            stereo_iq=False,
            verbose=False,
            callback=None
    ):
        self.stereo_iq = stereo_iq

        # open modem
        self.hstates = horus_api.horus_open_advanced(
            mode, rate, tone_spacing
        )

        # set verbose
        horus_api.horus_set_verbose(self.hstates, verbose)

    @property
    def sample_rate(self):
        return horus_api.horus_get_Fs(self.hstates)

    @property
    def max_demod_in(self):
        return horus_api.horus_get_max_demod_in(self.hstates)
    @property
    def max_ascii_out(self):
        return horus_api.horus_get_max_ascii_out_len(self.hstates)
    
    @property
    def mfsk(self):
        return horus_api.horus_get_mFSK(self.hstates)
    
    @property
    def nin(self):
        return horus_api.horus_nin(self.hstates)
    
    @property
    def crc_ok(self):
        return horus_api.horus_crc_ok(self.hstates)
    
    @property
    def modem_stats(self):
        stats = _horus_api_cffi.ffi.new("struct MODEM_STATS *")
        horus_api.horus_get_modem_extended_stats(self.hstates, stats)
        return stuct_to_dict(stats)
    
    @property
    def mode(self):
        mode = horus_api.horus_get_mode(self.hstates)
        return mode

    # in case someone wanted to use `with` style. I'm not sure if closing the modem does a lot.
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()

    def close(self) -> None:
        """
        Closes Horus modem.
        """
        horus_api.horus_close(self.hstates)

    def demodulate(self, audio_in):
        audio_id_data = _horus_api_cffi.ffi.new("char[]",audio_in)
        data_in = _horus_api_cffi.ffi.cast( # cast bytes to short
            "short *",
            audio_id_data
        )
        data_out = _horus_api_cffi.ffi.new("char[]", self.max_ascii_out)

        valid = horus_api.horus_rx(
            self.hstates,
            data_out,
            data_in,
            self.stereo_iq
        )

        data_out_bytes = bytes(_horus_api_cffi.ffi.buffer(data_out))
        crc = bool(self.crc_ok)

        data_out_bytes = data_out_bytes.rstrip(b'\x00')

        if self.mode not in [
            horus_api.HORUS_MODE_RTTY_7N1,
            horus_api.HORUS_MODE_RTTY_7N2,
            horus_api.HORUS_MODE_RTTY_8N2,
        ]:
            data_out_bytes = bytes.fromhex(data_out_bytes.decode("ascii"))

        if valid:
            return Frame(
                data=data_out_bytes,
                crc_pass=crc,
                stats=self.modem_stats
            )

# it was easier to copy this out and modify than to import
class SondehubUploader():

    def __init__(self,user_callsign="NOCALL", user_position=[0,0,0], user_radio="", user_antenna=""):
        self.software_name = "webhorus"
        self.software_version = "0.0.1" #TODO
        self.user_callsign = user_callsign
        self.user_position = user_position
        self.user_radio = user_radio
        self.user_antenna = user_antenna


    def log_error(self,msg):
        print(msg)
    log_warning  = log_error
    log_info = log_error

    def reformat_data(self, telemetry):
        """ Take an input dictionary and convert it to the universal format """

        # Init output dictionary
        _output = {
            "software_name": self.software_name,
            "software_version": self.software_version,
            "uploader_callsign": self.user_callsign,
            "uploader_position": self.user_position,
            "uploader_radio": self.user_radio,
            "uploader_antenna": self.user_antenna,
            "time_received": datetime.datetime.utcnow().strftime(
                "%Y-%m-%dT%H:%M:%S.%fZ"
            ),
        }

        # Mandatory Fields
        # Datetime
        try:
            _datetime = fix_datetime(telemetry['time'])

            # Compare system time and payload time, to look for issues where system time is way out.
            _timedelta = abs((_datetime - datetime.datetime.utcnow()).total_seconds())

            if _timedelta > 3*60 and telemetry['callsign'] != '4FSKTEST-V2':
                # Greater than 3 minutes time difference. Discard packet in this case.
                self.log_error("Payload and Receiver times are offset by more than 3 minutes. Either payload does not have GNSS lock, or your system time is not set correctly. Not uploading.")
                return None

            if _timedelta > 60:
                self.log_warning("Payload and Receiver times are offset by more than 1 minute. Either payload does not have GNSS lock, or your system time is not set correctly.")

            _output["datetime"] = _datetime.strftime(
                "%Y-%m-%dT%H:%M:%S.%fZ"
            )
        except Exception as e:
            self.log_error(
                "Error converting telemetry datetime to string - %s" % str(e)
            )
            self.log_debug("Offending datetime_dt: %s" % str(telemetry["time"]))
            return None



        # Callsign - Break if this is an unknown payload ID.
        if telemetry["callsign"] == "UNKNOWN_PAYLOAD_ID":
            self.log_error("Not uploading telemetry from unknown payload ID. Is your payload ID list old?")
            return None

        if '4FSKTEST' in telemetry['callsign']:
            self.log_warning(f"Payload ID {telemetry['callsign']} is for testing purposes only, and should not be used on an actual flight. Refer here: https://github.com/projecthorus/horusdemodlib/wiki#how-do-i-transmit-it")

        _output['payload_callsign'] = telemetry["callsign"]

        # Frame Number
        _output["frame"] = telemetry["sequence_number"]

        # Position
        _output["lat"] = telemetry["latitude"]
        _output["lon"] = telemetry["longitude"]
        _output["alt"] = telemetry["altitude"]

        # # Optional Fields
        if "temperature" in telemetry:
            if telemetry["temperature"] > -273.15:
                _output["temp"] = telemetry["temperature"]

        if "satellites" in telemetry:
            _output["sats"] = telemetry["satellites"]

        if "battery_voltage" in telemetry:
            if telemetry["battery_voltage"] >= 0.0:
                _output["batt"] = telemetry["battery_voltage"]

        if "speed" in telemetry:
            _output["speed"] = telemetry["speed"]

        if "vel_h" in telemetry:
            _output["vel_h"] = telemetry["vel_h"]

        if "vel_v" in telemetry:
            _output["vel_v"] = telemetry["vel_v"]

        # Handle the additional SNR and frequency estimation if we have it
        if "snr" in telemetry:
            _output["snr"] = telemetry["snr"]

        if "f_centre" in telemetry:
            _output["frequency"] = telemetry["f_centre"] / 1e6 # Hz -> MHz

        if "raw" in telemetry:
            _output["raw"] = telemetry["raw"]

        if "modulation" in telemetry:
            _output["modulation"] = telemetry["modulation"]

        if "modulation_detail" in telemetry:
            _output["modulation_detail"] = telemetry["modulation_detail"]

        if "baud_rate" in telemetry:
            _output["baud_rate"] = telemetry["baud_rate"]

        # Add in any field names from the custom field section
        if "custom_field_names" in telemetry:
            for _custom_field_name in telemetry["custom_field_names"]:
                if _custom_field_name in telemetry:
                    _output[_custom_field_name] = telemetry[_custom_field_name]


        return _output

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
                    prog='horus demod')
    parser.add_argument('filename') 
    args = parser.parse_args()

    sh = SondehubUploader()

    with Demod() as demod:
        with open(args.filename, "rb") as f:
            while audio_in := f.read(demod.nin*2):
               data = demod.demodulate(audio_in)
               print(demod.modem_stats['snr_est'])
               if data and data.crc_pass:
                   packet = horusdemodlib.decoder.decode_packet(
                       data.data
                   )
                   
                   print(sh.reformat_data(packet))