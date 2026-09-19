#!/usr/bin/env python3
"""
Fast Local Face Detection using OpenCV Haar Cascade.
Takes an image path and outputs JSON to stdout.
"""
import sys
import os
import json

def detect_faces(image_path):
    if not os.path.exists(image_path):
        return {"hasFace": False, "count": 0, "error": f"Image file not found: {image_path}"}

    try:
        import cv2
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)

        img = cv2.imread(image_path)
        if img is None:
            return {"hasFace": False, "count": 0, "error": "Failed to decode image"}

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Fast multi-scale detection
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60),
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        face_list = []
        for (x, y, w, h) in faces:
            face_list.append({"x": int(x), "y": int(y), "width": int(w), "height": int(h)})

        return {
            "hasFace": len(face_list) > 0,
            "count": len(face_list),
            "faces": face_list,
            "imageWidth": int(img.shape[1]),
            "imageHeight": int(img.shape[0])
        }
    except Exception as e:
        return {"hasFace": False, "count": 0, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"hasFace": False, "count": 0, "error": "Missing image path argument"}))
        sys.exit(1)

    result = detect_faces(sys.argv[1])
    print(json.dumps(result))
