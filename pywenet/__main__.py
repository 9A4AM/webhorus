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
    partialupdate=50
    )

with open("/Users/mwheeler/Downloads/wenet_921416_threshold_decode.f32","rb") as f:
    while data := f.read(wenet.nin*2*4):
        output = wenet.write(data)
        if output:
            print(data)
        

