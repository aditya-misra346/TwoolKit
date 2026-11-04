#!/usr/bin/env python3
"""
Generate official TwoolKit Desktop (T-Nexus) multi-resolution application icons
for Tauri 2 across macOS (.icns), Windows (.ico), and Linux (.png).
"""
from pathlib import Path
from PIL import Image, ImageDraw

ICONS_DIR = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)


def render_tnexus_icon(size: int) -> Image.Image:
    """Render the official TwoolKit T-Nexus geometric emblem as an RGBA image."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer squircle padding
    pad = max(1, int(size * 0.06))
    radius = max(2, int(size * 0.22))

    # Deep midnight navy squircle background (#0B1120)
    draw.rounded_rectangle(
        [pad, pad, size - pad - 1, size - pad - 1],
        radius=radius,
        fill=(11, 17, 32, 255),
        outline=(59, 130, 246, 180),
        width=max(1, int(size * 0.025)),
    )

    # T-Nexus Horizontal Precision Crossbar (Electric Cobalt -> Cyan)
    bar_left = int(size * 0.22)
    bar_right = int(size * 0.78)
    bar_top = int(size * 0.24)
    bar_bottom = int(size * 0.39)
    bar_r = max(1, int(size * 0.05))
    draw.rounded_rectangle(
        [bar_left, bar_top, bar_right, bar_bottom],
        radius=bar_r,
        fill=(59, 130, 246, 255),
    )

    # T-Nexus Vertical Pillar (Indigo-Blue)
    stem_left = int(size * 0.41)
    stem_right = int(size * 0.59)
    stem_top = int(size * 0.34)
    stem_bottom = int(size * 0.78)
    draw.rounded_rectangle(
        [stem_left, stem_top, stem_right, stem_bottom],
        radius=bar_r,
        fill=(37, 99, 235, 255),
    )

    # Central Cyan Intersection Node (#06B6D4)
    node_pad = int(size * 0.43)
    node_end = int(size * 0.57)
    draw.rounded_rectangle(
        [node_pad, int(size * 0.26), node_end, int(size * 0.40)],
        radius=max(1, int(size * 0.03)),
        fill=(6, 182, 212, 255),
    )

    return img


def main() -> None:
    master = render_tnexus_icon(512)
    master.save(ICONS_DIR / "icon.png", format="PNG")

    for px, name in [
        (32, "32x32.png"),
        (128, "128x128.png"),
        (256, "128x128@2x.png"),
        (512, "512x512.png"),
    ]:
        resized = render_tnexus_icon(px)
        resized.save(ICONS_DIR / name, format="PNG")

    # Windows .ico (multi-size)
    master.save(
        ICONS_DIR / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    # macOS .icns
    master.save(ICONS_DIR / "icon.icns", format="ICNS")
    print(f"Generated Tauri 2 icons in {ICONS_DIR}")


if __name__ == "__main__":
    main()
