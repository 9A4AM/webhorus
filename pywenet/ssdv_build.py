from cffi import FFI
import re

ffibuilder = FFI()


def preprocess_h():
    data = """


#define SSDV_ERROR       -1
#define SSDV_OK          0
#define SSDV_FEED_ME     1
#define SSDV_HAVE_PACKET 2
#define SSDV_BUFFER_FULL 3
#define SSDV_EOI         4

/* Packet details */
#define SSDV_PKT_SIZE         0x100
#define SSDV_PKT_SIZE_HEADER  0x0F
#define SSDV_PKT_SIZE_CRC     0x04
#define SSDV_PKT_SIZE_RSCODES 0x20

#define TBL_LEN 546 /* Maximum size of the DQT and DHT tables */
#define HBUFF_LEN 16 /* Extra space for reading marker data */

#define SSDV_MAX_CALLSIGN 6 /* Maximum number of characters in a callsign */

#define SSDV_TYPE_INVALID 0xFF
#define SSDV_TYPE_NORMAL  0x00
#define SSDV_TYPE_NOFEC   0x01

typedef struct
{
	/* Packet type configuration */
	uint8_t type; /* 0 = Normal mode (nom. 224 byte packet + 32 bytes FEC),
	                 1 = No-FEC mode (nom. 256 byte packet) */
	uint16_t pkt_size_payload;
	uint16_t pkt_size_crcdata;
	int pkt_size;
	
	/* Image information */
	uint16_t width;
	uint16_t height;
	uint32_t callsign;
	uint8_t  image_id;
	uint16_t packet_id;
	uint8_t  mcu_mode;  /* 0 = 2x2, 1 = 2x1, 2 = 1x2, 3 = 1x1           */
	uint16_t mcu_id;
	uint16_t mcu_count;
	uint8_t  quality;   /* JPEG quality level for encoding, 0-7         */
	uint16_t packet_mcu_id;
	uint8_t  packet_mcu_offset;
	
	/* Source buffer */
	uint8_t *inp;      /* Pointer to next input byte                    */
	size_t in_len;     /* Number of input bytes remaining               */
	size_t in_skip;    /* Number of input bytes to skip                 */
	
	/* Source bits */
	uint32_t workbits; /* Input bits currently being worked on          */
	uint8_t worklen;   /* Number of bits in the input bit buffer        */
	
	/* JPEG / Packet output buffer */
	uint8_t *out;      /* Pointer to the beginning of the output buffer */
	uint8_t *outp;     /* Pointer to the next output byte               */
	size_t out_len;    /* Number of output bytes remaining              */
	char out_stuff;    /* Flag to add stuffing bytes to output          */
	
	/* Output bits */
	uint32_t outbits;  /* Output bit buffer                             */
	uint8_t outlen;    /* Number of bits in the output bit buffer       */
	
	/* JPEG decoder state */
	enum {
		S_MARKER = 0,
		S_MARKER_LEN,
		S_MARKER_DATA,
		S_HUFF,
		S_INT,
		S_EOI,
	} state;
	uint16_t marker;    /* Current marker                               */
	uint16_t marker_len; /* Length of data following marker             */
	uint8_t *marker_data; /* Where to copy marker data too              */
	uint16_t marker_data_len; /* How much is there                      */
	uint8_t greyscale;  /* 0 = Normal (3 channels), 1 = Greyscale       */
	uint8_t component;  /* 0 = Y, 1 = Cb, 2 = Cr                        */
	uint8_t ycparts;    /* Number of Y component parts per MCU          */
	uint8_t mcupart;    /* 0-3 = Y, 4 = Cb, 5 = Cr                      */
	uint8_t acpart;     /* 0 - 64; 0 = DC, 1 - 64 = AC                  */
	int dc[3];          /* DC value for each component                  */
	int adc[3];         /* DC adjusted value for each component         */
	uint8_t acrle;      /* RLE value for current AC value               */
	uint8_t accrle;     /* Accumulative RLE value                       */
	uint16_t dri;       /* Reset interval                               */
	enum {
		S_ENCODING = 0,
		S_DECODING,
	} mode;
	uint32_t reset_mcu; /* MCU block to do absolute encoding            */
	uint32_t next_reset_mcu;
	char needbits;      /* Number of bits needed to decode integer      */
	
	/* The input huffman and quantisation tables */
	uint8_t stbls[TBL_LEN + HBUFF_LEN];
	uint8_t *sdht[2][2], *sdqt[2];
	uint16_t stbl_len;
	
	/* The same for output */
	uint8_t dtbls[TBL_LEN];
	uint8_t *ddht[2][2], *ddqt[2];
	uint16_t dtbl_len;
	
} ssdv_t;

typedef struct {
	uint8_t  type;
	uint32_t callsign;
	char     callsign_s[SSDV_MAX_CALLSIGN + 1];
	uint8_t  image_id;
	uint16_t packet_id;
	uint16_t width;
	uint16_t height;
	uint8_t  eoi;
	uint8_t  quality;
	uint16_t mcu_mode;
	uint8_t  mcu_offset;
	uint16_t mcu_id;
	uint16_t mcu_count;
} ssdv_packet_info_t;

/* Encoding */
extern char ssdv_enc_init(ssdv_t *s, uint8_t type, char *callsign, uint8_t image_id, int8_t quality, int pkt_size);
extern char ssdv_enc_set_buffer(ssdv_t *s, uint8_t *buffer);
extern char ssdv_enc_get_packet(ssdv_t *s);
extern char ssdv_enc_feed(ssdv_t *s, uint8_t *buffer, size_t length);

/* Decoding */
extern char ssdv_dec_init(ssdv_t *s, int pkt_size);
extern char ssdv_dec_set_buffer(ssdv_t *s, uint8_t *buffer, size_t length);
extern char ssdv_dec_feed(ssdv_t *s, uint8_t *packet);
extern char ssdv_dec_get_jpeg(ssdv_t *s, uint8_t **jpeg, size_t *length);

extern char ssdv_dec_is_packet(uint8_t *packet, int pkt_size, int *errors);
extern void ssdv_dec_header(ssdv_packet_info_t *info, uint8_t *packet);


extern void encode_rs_8(uint8_t *data, uint8_t *parity, int pad);
extern int decode_rs_8(uint8_t *data, int *eras_pos, int no_eras, int pad);

"""

    return data

ffibuilder.cdef(preprocess_h()
    
)

# set_source() gives the name of the python extension module to
# produce, and some C source code as a string.  This C code needs
# to make the declarated functions, types and globals available,
# so it is often just the "#include".

from distutils import sysconfig


ffibuilder.set_source("_ssdv_cffi",
"""
     #include "ssdv.h"   // the C header of the library
     #include "rs8.h"
""",
      sources=[
        "./ssdv/ssdv.c",
        "./ssdv/rs8.c"
      ],
       include_dirs = [ "./ssdv"],
     )   # library name, for the linker

if __name__ == "__main__":
    ffibuilder.compile(verbose=True)