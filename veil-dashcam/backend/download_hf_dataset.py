# backend/download_hf_dataset.py
from huggingface_hub import snapshot_download
import os, zipfile

repo = "keremberke/license-plate-object-detection"  # correct id
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "data"))
raw_dir = os.path.join(root, "keremberke_lp_raw")
target = os.path.join(root, "keremberke_lp")

os.makedirs(raw_dir, exist_ok=True)
os.makedirs(target, exist_ok=True)

# 1) Download the dataset into backend/data/keremberke_lp_raw
path = snapshot_download(repo_id=repo, repo_type="dataset", local_dir=raw_dir)
print("✅ Downloaded to:", path)

# 2) Extract each zip; if the zip already contains train/valid/test with images/labels,
#    this will land them in target/ correctly. If not, we still unpack per split.
splits = {"train.zip": "train", "valid.zip": "valid", "test.zip": "test"}
for z, split in splits.items():
    zpath = os.path.join(path, "data", z)
    if not os.path.exists(zpath):
        continue
    print("Unzipping", z)
    # extract into a split-specific folder to guarantee target/<split>/...
    split_dir = os.path.join(target, split)
    os.makedirs(split_dir, exist_ok=True)
    with zipfile.ZipFile(zpath, "r") as f:
        f.extractall(split_dir)

print("✅ Done! Extracted under:", target)
