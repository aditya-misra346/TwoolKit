#!/usr/bin/env python3
"""
Generate Official TwoolKit Brand Icons, Favicons, Apple Touch Icons, and
1200x630 Open Graph Social Sharing Images with 4x Supersampled Bezier Geometry
and Multi-Stop Linear Gradients matching Logo.tsx and icon-dark.svg.

Guarantees:
- Zero black-square SVG gradient fallback bugs.
- 100% opaque RGB backgrounds for Open Graph, Twitter/X, and Apple Touch icons
  so WhatsApp, Telegram, Discord, LinkedIn, iMessage, and X never render black
  squares or transparency artifacts.
"""

from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "frontend" / "public"
BRAND_DIR = PUBLIC_DIR / "brand"
APP_DIR = ROOT / "frontend" / "src" / "app"
TAURI_ICONS_DIR = ROOT / "desktop" / "src-tauri" / "icons"

PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
BRAND_DIR.mkdir(parents=True, exist_ok=True)
TAURI_ICONS_DIR.mkdir(parents=True, exist_ok=True)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * max(0.0, min(1.0, t))


def lerp_color(c1: tuple[int, ...], c2: tuple[int, ...], t: float) -> tuple[int, ...]:
    t = max(0.0, min(1.0, t))
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(len(c1)))


def multi_stop_gradient(
    stops: list[tuple[float, tuple[int, int, int]]], t: float
) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        if p0 <= t <= p1:
            local_t = (t - p0) / (p1 - p0) if p1 > p0 else 0.0
            res = lerp_color(c0, c1, local_t)
            return (res[0], res[1], res[2])
    return stops[-1][1]


def quad_bezier(
    p0: tuple[float, float],
    p1: tuple[float, float],
    p2: tuple[float, float],
    steps: int = 36,
) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    for i in range(1, steps + 1):
        t = i / steps
        mt = 1.0 - t
        x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]
        y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


def build_tnexus_top_polygon(scale: float, offset_x: float, offset_y: float) -> list[tuple[float, float]]:
    """
    Exact mathematical path from Logo.tsx:
    M 7 7 L 25 7 Q 26.8 7 26.8 8.8 L 26.8 11.2 Q 26.8 13 25 13
    L 19.5 13 L 16 9.5 L 12.5 13 L 7 13 Q 5.2 13 5.2 11.2 L 5.2 8.8 Q 5.2 7 7 7 Z
    """
    raw: list[tuple[float, float]] = [(7.0, 7.0), (25.0, 7.0)]
    raw.extend(quad_bezier((25.0, 7.0), (26.8, 7.0), (26.8, 8.8)))
    raw.append((26.8, 11.2))
    raw.extend(quad_bezier((26.8, 11.2), (26.8, 13.0), (25.0, 13.0)))
    raw.extend([(19.5, 13.0), (16.0, 9.5), (12.5, 13.0), (7.0, 13.0)])
    raw.extend(quad_bezier((7.0, 13.0), (5.2, 13.0), (5.2, 11.2)))
    raw.append((5.2, 8.8))
    raw.extend(quad_bezier((5.2, 8.8), (5.2, 7.0), (7.0, 7.0)))
    return [(offset_x + x * scale, offset_y + y * scale) for x, y in raw]


def build_tnexus_stem_polygon(scale: float, offset_x: float, offset_y: float) -> list[tuple[float, float]]:
    """
    Exact mathematical path from Logo.tsx:
    M 16 12 L 20.2 16.2 Q 21 17 21 17.9 L 21 23.8 Q 21 25.5 19.2 25.5
    L 12.8 25.5 Q 11 25.5 11 23.8 L 11 17.9 Q 11 17 11.8 16.2 L 16 12 Z
    """
    raw: list[tuple[float, float]] = [(16.0, 12.0), (20.2, 16.2)]
    raw.extend(quad_bezier((20.2, 16.2), (21.0, 17.0), (21.0, 17.9)))
    raw.append((21.0, 23.8))
    raw.extend(quad_bezier((21.0, 23.8), (21.0, 25.5), (19.2, 25.5)))
    raw.append((12.8, 25.5))
    raw.extend(quad_bezier((12.8, 25.5), (11.0, 25.5), (11.0, 23.8)))
    raw.append((11.0, 17.9))
    raw.extend(quad_bezier((11.0, 17.9), (11.0, 17.0), (11.8, 16.2)))
    raw.append((16.0, 12.0))
    return [(offset_x + x * scale, offset_y + y * scale) for x, y in raw]


def make_diagonal_gradient_image(
    width: int,
    height: int,
    stops: list[tuple[float, tuple[int, int, int]]],
    vertical_only: bool = False,
) -> Image.Image:
    """Create a smooth RGB gradient image."""
    img = Image.new("RGBA", (width, height))
    px = img.load()
    denom = float(height - 1) if vertical_only else float(width + height - 2)
    denom = max(1.0, denom)
    for y in range(height):
        for x in range(width):
            t = (y / denom) if vertical_only else ((x + y) / denom)
            r, g, b = multi_stop_gradient(stops, t)
            px[x, y] = (r, g, b, 255)
    return img


def render_official_logo_icon(
    target_size: int,
    opaque_canvas_bg: tuple[int, int, int] | None = None,
    outer_padding_ratio: float = 0.0,
) -> Image.Image:
    """
    Render the official TwoolKit T-Nexus icon at 4x supersampling (or minimum 512px internal)
    and downsample with LANCZOS for razor-sharp anti-aliased edges.
    """
    ss = max(512, target_size * 4 if target_size <= 256 else target_size * 2)

    if opaque_canvas_bg is not None:
        canvas = Image.new("RGBA", (ss, ss), (*opaque_canvas_bg, 255))
    else:
        canvas = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))

    pad = int(round(ss * outer_padding_ratio))
    box_size = ss - 2 * pad
    rx = int(round(box_size * (32.0 / 128.0)))

    # 1. Squircle background gradient (#0F172A -> #090D16 -> #030712)
    bg_stops = [
        (0.0, (15, 23, 42)),
        (0.5, (11, 17, 32)),
        (1.0, (6, 10, 20)),
    ]
    bg_grad = make_diagonal_gradient_image(box_size, box_size, bg_stops, vertical_only=False)
    sq_mask = Image.new("L", (box_size, box_size), 0)
    sq_draw = ImageDraw.Draw(sq_mask)
    sq_draw.rounded_rectangle([0, 0, box_size - 1, box_size - 1], radius=rx, fill=255)
    canvas.paste(bg_grad, (pad, pad), sq_mask)

    # Subtle ambient cobalt glow inside squircle center
    glow = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    cx, cy = ss // 2, ss // 2
    g_rad = int(box_size * 0.36)
    g_draw.ellipse(
        [cx - g_rad, cy - g_rad, cx + g_rad, cy + g_rad],
        fill=(37, 99, 235, 42),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(4, box_size // 10)))
    # Clip glow to squircle
    clipped_glow = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    full_sq_mask = Image.new("L", (ss, ss), 0)
    full_sq_mask.paste(sq_mask, (pad, pad))
    clipped_glow.paste(glow, (0, 0), full_sq_mask)
    canvas = Image.alpha_composite(canvas, clipped_glow)

    # Subtle inner border highlight (1.5px scaled)
    border_layer = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(border_layer)
    inset = max(1, int(round(box_size * 0.012)))
    stroke_w = max(2, int(round(box_size * 0.018)))
    b_draw.rounded_rectangle(
        [pad + inset, pad + inset, pad + box_size - 1 - inset, pad + box_size - 1 - inset],
        radius=max(2, rx - inset),
        outline=(148, 163, 184, 55),
        width=stroke_w,
    )
    canvas = Image.alpha_composite(canvas, border_layer)

    # 2. T-Nexus Geometry (matches icon-dark.svg transform="translate(16, 16) scale(3)" on 128x128)
    # In 32x32 symbol coordinates, scale = box_size * (96 / 128) / 32 = box_size * 0.75 / 32
    sym_scale = (box_size * 0.76) / 32.0
    sym_offset = pad + box_size * 0.12

    # Top crossbar gradient (#38BDF8 -> #2563EB -> #1D4ED8)
    top_poly = build_tnexus_top_polygon(sym_scale, sym_offset, sym_offset)
    top_mask = Image.new("L", (ss, ss), 0)
    ImageDraw.Draw(top_mask).polygon(top_poly, fill=255)

    top_stops = [
        (0.0, (56, 189, 248)),   # #38BDF8
        (0.5, (37, 99, 235)),    # #2563EB
        (1.0, (29, 78, 216)),    # #1D4ED8
    ]
    top_grad_box = make_diagonal_gradient_image(ss, ss, top_stops, vertical_only=False)
    canvas.paste(top_grad_box, (0, 0), top_mask)

    # Vertical stem gradient (#06B6D4 -> #2563EB -> #1E40AF)
    stem_poly = build_tnexus_stem_polygon(sym_scale, sym_offset, sym_offset)
    stem_mask = Image.new("L", (ss, ss), 0)
    ImageDraw.Draw(stem_mask).polygon(stem_poly, fill=255)

    stem_stops = [
        (0.0, (6, 182, 212)),    # #06B6D4
        (0.4, (37, 99, 235)),    # #2563EB
        (1.0, (30, 64, 175)),    # #1E40AF
    ]
    stem_grad_box = make_diagonal_gradient_image(ss, ss, stem_stops, vertical_only=True)
    canvas.paste(stem_grad_box, (0, 0), stem_mask)

    if ss != target_size:
        canvas = canvas.resize((target_size, target_size), Image.Resampling.LANCZOS)

    if opaque_canvas_bg is not None:
        return canvas.convert("RGB")
    return canvas


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/SFNS.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/Library/Fonts/Arial Bold.ttf",
        ]
        if bold
        else [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/SFNS.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
        ]
    )
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def render_open_graph_banner(width: int = 1200, height: int = 630) -> Image.Image:
    """
    Create a 1200x630 Open Graph / Social Sharing card featuring the official
    TwoolKit T-Nexus logo, midnight-navy brand backdrop, and crisp typography.
    Designed so both full 1.91:1 previews AND 1:1 center-cropped WhatsApp previews
    keep the official logo and brand wordmark completely visible and centered.
    """
    # 1. Opaque deep midnight navy background (#070B14 -> #0B1120 -> #060911)
    bg_stops = [
        (0.0, (7, 11, 20)),
        (0.5, (11, 17, 32)),
        (1.0, (6, 9, 17)),
    ]
    base = make_diagonal_gradient_image(width, height, bg_stops, vertical_only=False)

    # 2. Subtle architectural grid lines
    grid_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grid_layer)
    grid_step = 48
    for x in range(0, width, grid_step):
        g_draw.line([(x, 0), (x, height)], fill=(148, 163, 184, 11), width=1)
    for y in range(0, height, grid_step):
        g_draw.line([(0, y), (width, y)], fill=(148, 163, 184, 11), width=1)
    base = Image.alpha_composite(base, grid_layer)

    # 3. Ambient radial spotlight behind the central logo
    glow_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gl_draw = ImageDraw.Draw(glow_layer)
    cx, cy = width // 2, int(height * 0.36)
    gl_draw.ellipse([cx - 320, cy - 220, cx + 320, cy + 220], fill=(37, 99, 235, 68))
    gl_draw.ellipse([cx - 180, cy - 140, cx + 180, cy + 140], fill=(6, 182, 212, 52))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=95))
    base = Image.alpha_composite(base, glow_layer)

    # 4. Outer subtle frame border
    frame_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    f_draw = ImageDraw.Draw(frame_layer)
    f_draw.rounded_rectangle(
        [24, 24, width - 25, height - 25],
        radius=28,
        outline=(59, 130, 246, 55),
        width=2,
    )
    base = Image.alpha_composite(base, frame_layer)

    # 5. Official TwoolKit T-Nexus Icon (216x216) prominently positioned in upper-center
    icon_size = 216
    logo_icon = render_official_logo_icon(icon_size, opaque_canvas_bg=None)

    # Drop shadow under the icon squircle
    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    icon_x = (width - icon_size) // 2
    icon_y = 76
    s_draw.rounded_rectangle(
        [icon_x + 4, icon_y + 14, icon_x + icon_size - 4, icon_y + icon_size + 14],
        radius=52,
        fill=(0, 0, 0, 150),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=22))
    base = Image.alpha_composite(base, shadow)
    base.paste(logo_icon, (icon_x, icon_y), logo_icon)

    # 6. Brand Wordmark & Subtitle inside the center-safe zone (x: 300..900)
    draw = ImageDraw.Draw(base)
    title_font = load_font(68, bold=True)
    subtitle_font = load_font(22, bold=True)
    pill_font = load_font(17, bold=True)

    # Wordmark: TWOOLKIT
    wordmark = "TWOOLKIT"
    tb = draw.textbbox((0, 0), wordmark, font=title_font)
    tw = tb[2] - tb[0]
    tx = (width - tw) // 2
    ty = icon_y + icon_size + 28
    draw.text((tx, ty), wordmark, font=title_font, fill=(248, 250, 252, 255))

    # Tagline
    tagline = "ALL-IN-ONE FILE INTELLIGENCE, PDF & CONVERSION STUDIO"
    sb = draw.textbbox((0, 0), tagline, font=subtitle_font)
    sw = sb[2] - sb[0]
    sx = (width - sw) // 2
    sy = ty + 84
    draw.text((sx, sy), tagline, font=subtitle_font, fill=(56, 189, 248, 255))

    # Feature pills row at bottom
    pills = [
        "PDF Workspace",
        "Document & Slide Conversion",
        "Image Studio",
        "Smart Storage & Scanner",
    ]
    pill_h = 38
    pill_gap = 14
    pill_widths: list[int] = []
    for p in pills:
        pb = draw.textbbox((0, 0), p, font=pill_font)
        pill_widths.append((pb[2] - pb[0]) + 34)

    total_pills_w = sum(pill_widths) + pill_gap * (len(pills) - 1)
    curr_x = (width - total_pills_w) // 2
    pill_y = sy + 52

    for p, pw in zip(pills, pill_widths):
        draw.rounded_rectangle(
            [curr_x, pill_y, curr_x + pw, pill_y + pill_h],
            radius=19,
            fill=(15, 23, 42, 230),
            outline=(59, 130, 246, 95),
            width=1,
        )
        pb = draw.textbbox((0, 0), p, font=pill_font)
        ptw = pb[2] - pb[0]
        pth = pb[3] - pb[1]
        draw.text(
            (curr_x + (pw - ptw) // 2, pill_y + (pill_h - pth) // 2 - pb[1]),
            p,
            font=pill_font,
            fill=(226, 232, 240, 255),
        )
        curr_x += pw + pill_gap

    # Return 100% opaque RGB image
    return base.convert("RGB")


def main() -> None:
    # 1. Generate all square PNG icon sizes (with transparent outer corners for standard icons)
    sizes = [16, 32, 48, 64, 96, 128, 180, 192, 256, 512]
    for sz in sizes:
        icon_rgba = render_official_logo_icon(sz, opaque_canvas_bg=None)
        icon_rgba.save(BRAND_DIR / f"icon-{sz}.png", format="PNG", optimize=True)
        icon_rgba.save(PUBLIC_DIR / f"icon-{sz}.png", format="PNG", optimize=True)

    # Save 512x512 as public/icon.png
    icon_512 = render_official_logo_icon(512, opaque_canvas_bg=None)
    icon_512.save(PUBLIC_DIR / "icon.png", format="PNG", optimize=True)

    # 2. Generate Opaque Apple Touch Icon (180x180) so iOS/WhatsApp never render transparent corners as black
    apple_icon = render_official_logo_icon(
        180, opaque_canvas_bg=(9, 13, 22), outer_padding_ratio=0.0
    )
    apple_icon.save(PUBLIC_DIR / "apple-touch-icon.png", format="PNG", optimize=True)
    apple_icon.save(BRAND_DIR / "apple-touch-icon.png", format="PNG", optimize=True)

    # 3. Generate multi-resolution favicon.ico (16, 32, 48) in both public/ and src/app/
    ico_base = render_official_logo_icon(256, opaque_canvas_bg=None)
    for ico_dest in [PUBLIC_DIR / "favicon.ico", APP_DIR / "favicon.ico"]:
        ico_base.save(
            ico_dest,
            format="ICO",
            sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
        )

    # 4. Generate 1200x630 Open Graph Social Sharing Image (PNG + JPG)
    og_banner = render_open_graph_banner(1200, 630)
    og_banner.save(PUBLIC_DIR / "og-image.png", format="PNG", optimize=True)
    og_banner.save(BRAND_DIR / "og-image.png", format="PNG", optimize=True)
    og_banner.save(PUBLIC_DIR / "og-image.jpg", format="JPEG", quality=94, optimize=True)

    # Also generate a 512x512 opaque social square fallback
    og_square = render_official_logo_icon(
        512, opaque_canvas_bg=(9, 13, 22), outer_padding_ratio=0.06
    )
    og_square.save(PUBLIC_DIR / "og-logo-square.png", format="PNG", optimize=True)
    og_square.save(BRAND_DIR / "og-logo-square.png", format="PNG", optimize=True)

    # 5. Update Tauri Desktop icons so desktop & web share the exact supersampled T-Nexus geometry
    icon_512.save(TAURI_ICONS_DIR / "icon.png", format="PNG", optimize=True)
    icon_512.save(TAURI_ICONS_DIR / "512x512.png", format="PNG", optimize=True)
    render_official_logo_icon(32).save(TAURI_ICONS_DIR / "32x32.png", format="PNG", optimize=True)
    render_official_logo_icon(128).save(TAURI_ICONS_DIR / "128x128.png", format="PNG", optimize=True)
    render_official_logo_icon(256).save(TAURI_ICONS_DIR / "128x128@2x.png", format="PNG", optimize=True)
    icon_512.save(
        TAURI_ICONS_DIR / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    icon_512.save(TAURI_ICONS_DIR / "icon.icns", format="ICNS")

    print("Successfully generated all TwoolKit brand icons and Open Graph social preview assets.")


if __name__ == "__main__":
    main()
