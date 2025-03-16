
import struct
import logging
from _ssdv_cffi import ffi
from _ssdv_cffi.lib import ssdv_dec_init, ssdv_dec_set_buffer, ssdv_dec_is_packet, ssdv_dec_feed, ssdv_dec_get_jpeg


class SSDV():
    def __init__(self,pkt_length=256):
        self.pkt_length = pkt_length
        self.ssdv = ffi.new("ssdv_t *")
        init_err = ssdv_dec_init(self.ssdv, self.pkt_length)
        self.jpeg_length = 1024 * 1024 * 4
        self.jpeg = ffi.new("uint8_t[]",self.jpeg_length)
        ssdv_dec_set_buffer(self.ssdv, self.jpeg, self.jpeg_length)

        if  init_err !=  b'\x00' : # 256 = packet length
            raise Exception(f"SSDV init failure: {init_err.hex()}")
        
    def add_packet(self, packet: bytes):
        errors = ffi.new("int *")

        # the outer modem has a checksum so probably don't need to run this check?
        #c = ssdv_dec_is_packet(packet, self.pkt_length, errors)
        #if c == b'\x00':
        ssdv_dec_feed(self.ssdv, packet)
        # else:
        #     logging.error("ssdv did not think this packet was an ssdv packet")
    
    @property
    def image(self):
        # copy object so that we can restore it after jpeg out
        _old_ssdv = bytes(ffi.buffer(self.ssdv))
        _old_jpeg = bytes(ffi.buffer(self.jpeg))
        _old_jpeg_length = self.jpeg_length
        _old_out = bytes(ffi.buffer(self.ssdv.out, self.jpeg_length))
        
        _jpeg = ffi.new("uint8_t **", self.jpeg) 
        _jpeg_length = ffi.new("size_t *", self.jpeg_length) 
        ssdv_dec_get_jpeg(self.ssdv, _jpeg, _jpeg_length)
        jpeg_out = bytes(ffi.buffer(_jpeg[0],_jpeg_length[0]))
        ffi.memmove(self.ssdv, _old_ssdv,len(_old_ssdv))
        ffi.memmove(self.jpeg, _old_jpeg,len(_old_jpeg))
        self.jpeg_length = _old_jpeg_length
        ffi.memmove(self.ssdv.out, _old_out, len(_old_out))
        return jpeg_out