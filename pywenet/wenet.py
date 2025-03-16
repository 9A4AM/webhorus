from .modem import Modem
from .ssdv import SSDV
import logging
from rx import WenetPackets
from rx.WenetPackets import WENET_PACKET_TYPES, packet_to_string, ssdv_packet_info, ssdv_packet_string
import traceback

class Wenet():
    def __init__(self, samplerate=115177*8, partialupdate=1, callback_ssdv_image=None, callback_log=None, callback_gps=None):
        print(samplerate)
        self.wenet = Modem(samplerate)
        self.current_image = -1
        self.current_callsign = ""
        self.current_text_message = -1
        self.current_packet_count = 0
        self.img_data = SSDV()

        self.callback_ssdv_image = callback_ssdv_image
        self.callback_log = callback_log
        self.callback_gps = callback_gps

        self.partialupdate=partialupdate
    
    @property
    def nin(self):
        return self.wenet.nin
    
    def log_packet(self, packet):
        logging.info(packet_to_string(packet))
        if self.callback_log:
            self.callback_log(packet_to_string(packet))
    
    def write(self,data: bytes):
        packets = self.wenet.demodulate(data)
        if packets:
            logging.debug(packets)
            for packet in packets:
                # try:
                    packet = packet[:-2] # remove crc
                    packet_type = WenetPackets.decode_packet_type(packet)
                    if packet_type == WENET_PACKET_TYPES.IDLE:
                        continue
                    elif packet_type == WENET_PACKET_TYPES.TEXT_MESSAGE:
                        self.log_packet(packet)
                    elif packet_type == WENET_PACKET_TYPES.SEC_PAYLOAD_TELEMETRY:
                        self.log_packet(packet)
                    elif packet_type == WENET_PACKET_TYPES.GPS_TELEMETRY: # this goes to sondehub
                        logging.info(WenetPackets.gps_telemetry_decoder(packet))
                        if self.callback_gps:
                            self.callback_gps(WenetPackets.gps_telemetry_decoder(packet))
                    elif packet_type == WENET_PACKET_TYPES.ORIENTATION_TELEMETRY:
                        self.log_packet(packet)
                    elif packet_type == WENET_PACKET_TYPES.IMAGE_TELEMETRY:
                        self.log_packet(packet)

                    elif packet_type == WENET_PACKET_TYPES.SSDV:
                        continue
                        packet_info = ssdv_packet_info(packet)
                        packet_as_string = ssdv_packet_string(packet)

                        if packet_info['error'] != 'None':
                            logging.error(packet_info['error'])
                            continue

                        if (packet_info['image_id'] != self.current_image) or (packet_info['callsign'] != self.current_callsign) :
                            # Attempt to decode current image if we have enough packets.
                            logging.debug("New image - ID #%d" % packet_info['image_id'])
                            if self.current_packet_count > 0:

                                image_output = self.img_data.image
                                if image_output and self.callback_ssdv_image:
                                    self.callback_ssdv_image(image_output, self.current_callsign, self.current_image)
                                
                                self.img_data = SSDV()
                            else:
                                logging.debug("Not enough packets to decode previous image.")

                            # Now set up for the new image.
                            self.current_image = packet_info['image_id']
                            self.current_callsign = packet_info['callsign']
                            self.current_packet_count = 1

                            self.img_data = SSDV()
                            self.img_data.add_packet(packet)

                        else:
                            self.img_data.add_packet(packet)
                            self.current_packet_count += 1

                            if self.current_packet_count % self.partialupdate == 0:

                                image_output = self.img_data.image
                                if image_output and self.callback_ssdv_image:
                                    self.callback_ssdv_image(image_output, self.current_callsign, self.current_image)
                # except KeyboardInterrupt:
                #     raise KeyboardInterrupt
                # except:
                #     logging.error("Error while processing packet")
                #     print(traceback.format_exception())