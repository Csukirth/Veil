# backend/tools/coco_to_yolo.py
import argparse, json, os, shutil, glob

def ensure_images_subdir(split_dir):
    img_dir = os.path.join(split_dir, "images")
    if not os.path.isdir(img_dir):
        # move any loose images into images/
        os.makedirs(img_dir, exist_ok=True)
        moved = 0
        for ext in ("*.jpg","*.jpeg","*.png","*.bmp","*.JPG","*.PNG"):
            for p in glob.glob(os.path.join(split_dir, ext)):
                shutil.move(p, os.path.join(img_dir, os.path.basename(p)))
                moved += 1
        if moved:
            print(f"[INFO] Moved {moved} images into {img_dir}")
    return img_dir

def convert_split(root, split):
    split_dir = os.path.join(root, split)
    anno_path = os.path.join(split_dir, "annotations.coco.json")
    if not os.path.isfile(anno_path):
        print(f"[SKIP] {split}: missing {anno_path}")
        return

    img_dir = ensure_images_subdir(split_dir)
    if not os.path.isdir(img_dir):
        print(f"[SKIP] {split}: no images folder at {img_dir}")
        return

    with open(anno_path, "r", encoding="utf-8") as f:
        coco = json.load(f)

    # Build index
    imgs = {im["id"]: im for im in coco.get("images", [])}
    cat_id_to_name = {c["id"]: c["name"] for c in coco.get("categories", [])}
    name_to_class = {name: i for i, name in enumerate(sorted(cat_id_to_name.values()))}

    labels_dir = os.path.join(split_dir, "labels")
    os.makedirs(labels_dir, exist_ok=True)

    out_counts = {"written_files": 0, "boxes": 0, "dropped": 0, "clamped": 0}
    per_image_lines = {}

    for ann in coco.get("annotations", []):
        img = imgs.get(ann.get("image_id"))
        if not img: 
            out_counts["dropped"] += 1
            continue

        fn = img["file_name"]
        w, h = float(img["width"]), float(img["height"])
        if w <= 0 or h <= 0:
            out_counts["dropped"] += 1
            continue

        # COCO bbox: [x_min, y_min, width, height] in pixels
        bbox = ann.get("bbox")
        if not bbox or len(bbox) != 4:
            out_counts["dropped"] += 1
            continue

        x, y, bw, bh = map(float, bbox)
        # drop negatives or zero area
        if bw <= 0 or bh <= 0 or x < 0 or y < 0:
            out_counts["dropped"] += 1
            continue

        # clamp to image bounds
        x2, y2 = x + bw, y + bh
        x = max(0.0, min(x, w))
        y = max(0.0, min(y, h))
        x2 = max(0.0, min(x2, w))
        y2 = max(0.0, min(y2, h))
        bw = max(0.0, x2 - x)
        bh = max(0.0, y2 - y)
        if bw == 0 or bh == 0:
            out_counts["dropped"] += 1
            continue
        if (x, y, x2, y2) != tuple(bbox[:2] + [bbox[0]+bbox[2], bbox[1]+bbox[3]]):
            out_counts["clamped"] += 1

        # YOLO normalized center format
        xc = (x + x2) / 2.0 / w
        yc = (y + y2) / 2.0 / h
        ww = bw / w
        hh = bh / h

        # class id: map category name → [0..N-1], typical dataset has single class 'license_plate'
        cat_id = ann.get("category_id")
        cname = cat_id_to_name.get(cat_id, "license_plate")
        cls = name_to_class.get(cname, 0)

        stem = os.path.splitext(os.path.basename(fn))[0]
        per_image_lines.setdefault(stem, []).append(f"{cls} {xc:.6f} {yc:.6f} {ww:.6f} {hh:.6f}")
        out_counts["boxes"] += 1

    # write label files
    for stem, lines in per_image_lines.items():
        outp = os.path.join(labels_dir, f"{stem}.txt")
        with open(outp, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        out_counts["written_files"] += 1

    # nuke any old Ultralytics caches
    for cache_name in ("labels.cache", ):
        p = os.path.join(split_dir, cache_name)
        if os.path.exists(p):
            os.remove(p)

    print(f"[OK] {split}: labels={out_counts['written_files']} boxes={out_counts['boxes']} "
          f"dropped={out_counts['dropped']} clamped={out_counts['clamped']} -> {labels_dir}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="dataset root containing train/ valid/ test/")
    ap.add_argument("--splits", nargs="+", default=["train","valid","test"])
    args = ap.parse_args()
    for s in args.splits:
        convert_split(args.root, s)

if __name__ == "__main__":
    main()
