import cv2
import face_recognition
import numpy as np
from cryptography.fernet import Fernet

# Key generation (In production, save this key securely in environment variables)
# Here we just generate or read from a file for persistence
KEY_FILE = "secret.key"
def get_encryption_key():
    if not __import__("os").path.exists(KEY_FILE):
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as f:
            f.write(key)
    else:
        with open(KEY_FILE, "rb") as f:
            key = f.read()
    return key

cipher_suite = Fernet(get_encryption_key())

def encrypt_data(data: bytes) -> bytes:
    """Encrypt byte data."""
    return cipher_suite.encrypt(data)

def decrypt_data(data: bytes) -> bytes:
    """Decrypt byte data."""
    return cipher_suite.decrypt(data)

def encode_face(image_path_or_bytes):
    """
    Given an image path or bytes of an image, find the face and return the 128-d encoding.
    """
    if isinstance(image_path_or_bytes, str):
        image = face_recognition.load_image_file(image_path_or_bytes)
    else:
        # Assume it's a numpy array (cv2 image)
        image = image_path_or_bytes
        # conversion from BGR to RGB? 
        # face_recognition uses RGB
        
    face_locations = face_recognition.face_locations(image)
    if not face_locations:
        return None, "No face found"
        
    if len(face_locations) > 1:
        return None, "Multiple faces found, please ensure only one face is in frame"
    
    encodings = face_recognition.face_encodings(image, face_locations)
    if len(encodings) == 0:
        return None, "Could not compute encoding"
        
    return encodings[0], None

def match_face(known_encoding, face_encoding_to_check, tolerance=0.5):
    """
    Compare two faces.
    """
    # face_recognition.compare_faces returns a list of booleans
    # But usually we want the distance as well
    distance = face_recognition.face_distance([known_encoding], face_encoding_to_check)[0]
    return distance <= tolerance, distance

def get_face_locations_and_encodings(image):
    """Returns locations and encodings for all faces in image."""
    locations = face_recognition.face_locations(image)
    encodings = face_recognition.face_encodings(image, locations)
    return locations, encodings
