import urllib.request
import os

MODELS = [
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_expression_model-weights_manifest.json",
    "face_expression_model-shard1"
]

BASE_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"
DIR = "static_site/models"

os.makedirs(DIR, exist_ok=True)

for model in MODELS:
    print(f"Downloading {model}...")
    dest = os.path.join(DIR, model)
    try:
        urllib.request.urlretrieve(BASE_URL + model, dest)
    except Exception as e:
        print(f"Failed to download {model}: {e}")

print("Done downloading models!")
