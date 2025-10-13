import os
import sys
import shutil
from pathlib import Path
from PIL import Image
from pillow_heif import register_heif_opener

# Enable HEIC support in Pillow
register_heif_opener()

def convert_and_copy(src_dir, dst_dir):
    """
    Recursively scans src_dir:
      - Converts .heic/.HEIC files to .jpg in dst_dir
      - Copies all other image files as-is
    Maintains subfolder structure.
    """
    src_dir = Path(src_dir)
    dst_dir = Path(dst_dir)

    supported_exts = {".heic", ".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    for path in src_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in supported_exts:
            relative_path = path.relative_to(src_dir)
            out_path = dst_dir / relative_path

            # Ensure directory exists
            out_path.parent.mkdir(parents=True, exist_ok=True)

            if path.suffix.lower() == ".heic":
                # Convert HEIC → JPG
                out_path = out_path.with_suffix(".jpg")
                try:
                    with Image.open(path) as img:
                        img.convert("RGB").save(out_path, "JPEG", quality=95)
                    print(f"Converted: {path} → {out_path}")
                except Exception as e:
                    print(f"Failed to convert {path}: {e}")
            else:
                # Copy other formats
                try:
                    shutil.copy2(path, out_path)
                    print(f"Copied: {path} → {out_path}")
                except Exception as e:
                    print(f"Failed to copy {path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python heic_to_jpg.py <source_dir> <output_dir>")
        sys.exit(1)

    src = sys.argv[1]
    dst = sys.argv[2]

    if not os.path.isdir(src):
        print(f"Invalid source directory: {src}")
        sys.exit(1)

    convert_and_copy(src, dst)
    print("\nDone! All images processed.")
