import logging
from .wenet import Wenet
# for showing the image
import cv2
import numpy as np
 
import time

logging.basicConfig()
logging.getLogger().setLevel(logging.INFO)

cv2.namedWindow("img", cv2.WINDOW_NORMAL)

def show_image(image_output):
    cv2.imshow("img",cv2.imdecode(np.frombuffer(image_output,dtype=np.uint8),cv2.IMREAD_COLOR))
    cv2.waitKey(1) 
def gps(data):
    print(data)

wenet = Wenet(
    partialupdate=50,
    callback_ssdv_image=show_image,
    callback_gps=gps
    )

with open("/Users/mwheeler/Downloads/wenet_sample_fs921416Hz_offset.f32","rb") as f:
    while data := f.read(wenet.nin*2*4):
        wenet.write(data)
        
       
# todo
# - wenet into only class
# - parsing telm for sondehub
# - partial image decodes
# - handling log messages
# - probably ignore no valid packet found message
# - move main to a module so that can either test or call
