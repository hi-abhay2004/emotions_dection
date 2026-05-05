from __future__ import annotations

import base64
import io
import os

from PIL import Image, ImageDraw, ImageFont


MOOD_COLORS = {
    "happy": (255, 232, 169),
    "calm": (197, 228, 255),
    "neutral": (230, 230, 230),
    "sad": (183, 201, 235),
    "angry": (255, 190, 190),
    "anxious": (210, 200, 235),
}

MOOD_TEMPLATES = {
    "sad": os.path.join("backend", "meme", "templates", "comfort.png"),
    "happy": os.path.join("backend", "meme", "templates", "celebration.png"),
    "angry": os.path.join("backend", "meme", "templates", "chill.png"),
    "calm": os.path.join("backend", "meme", "templates", "lofi.png"),
    "neutral": os.path.join("backend", "meme", "templates", "default.png"),
}


def render_meme(top_text: str, bottom_text: str, mood: str) -> str:
    template_path = MOOD_TEMPLATES.get(mood)
    if template_path and os.path.exists(template_path):
        image = Image.open(template_path).convert("RGB").resize((800, 800))
    else:
        background = MOOD_COLORS.get(mood, (240, 240, 240))
        image = Image.new("RGB", (800, 800), background)
    draw = ImageDraw.Draw(image)

    font = _load_font(48)
    _draw_centered_text(draw, top_text, font, y=80, max_width=720)
    _draw_centered_text(draw, bottom_text, font, y=640, max_width=720)

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size=size)
    except OSError:
        return ImageFont.load_default()


def _draw_centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    y: int,
    max_width: int,
) -> None:
    lines = _wrap_text(draw, text, font, max_width)
    line_height = font.getbbox("Ag")[3] + 6
    total_height = line_height * len(lines)
    start_y = y - total_height // 2
    for index, line in enumerate(lines):
        width = draw.textlength(line, font=font)
        x = (800 - width) / 2
        draw.text(
            (x, start_y + index * line_height),
            line,
            fill=(255, 255, 255),
            font=font,
            stroke_width=3,
            stroke_fill=(0, 0, 0),
        )


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        test_line = f"{current} {word}"
        if draw.textlength(test_line, font=font) <= max_width:
            current = test_line
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines
