"""Generate the DeepSeek Purge app icon (rounded dark tile + crimson cyclone)."""
from PIL import Image, ImageDraw
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

S = 4096          # supersampled working canvas
OUT = 1024
R_TILE = 0.195 * OUT   # corner radius in output pixels

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def gradient(size, stops, angle=90):
    """Vertical (angle=90) linear gradient image."""
    w, h = size
    img = Image.new('RGB', (1, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        # piecewise across stops
        pos = t * (len(stops) - 1)
        i = min(int(pos), len(stops) - 2)
        px[0, y] = lerp(stops[i], stops[i + 1], pos - i)
    return img.resize((w, h), Image.BILINEAR)

def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m

def arc_mask(size, cx, cy, r, width, start, end):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    d.arc([cx - r, cy - r, cx + r, cy + r], start=start, end=end,
          fill=255, width=width)
    return m

def arrow_head(size, cx, cy, r, width, angle_deg, direction):
    """Triangular cap at the arc end, pointing along the tangent."""
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    a = math.radians(angle_deg)
    # point on the circle
    px, py = cx + r * math.cos(a), cy + r * math.sin(a)
    # tangent direction (clockwise)
    tx, ty = -math.sin(a) * direction, math.cos(a) * direction
    # inward normal
    nx, ny = -math.cos(a), -math.sin(a)
    head = width * 1.55
    tipx, tipy = px + tx * head * 0.95, py + ty * head * 0.95
    base = head * 0.95
    p1 = (px + nx * base, py + ny * base)
    p2 = (px - nx * base, py - ny * base)
    d.polygon([(tipx, tipy), p1, p2], fill=255)
    return m

canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))

# --- tile -------------------------------------------------------------------
tile_mask = rounded_mask(S, int(R_TILE / OUT * S))
tile_bg = gradient((S, S), [(26, 28, 34), (9, 10, 14), (3, 3, 5)]).convert('RGBA')
# faint crimson glow toward the lower right
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([S * 0.42, S * 0.46, S * 1.18, S * 1.18], fill=(255, 60, 48, 60))
glow = glow.filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(S // 12))
tile = Image.alpha_composite(tile_bg, glow)
canvas.paste(tile, (0, 0), tile_mask)

# --- glyph: two counter-rotating arcs = purge / refresh ----------------------
CX = CY = S / 2
stroke = int(0.062 * S)

warm = gradient((S, S), [(255, 92, 64), (255, 138, 32), (255, 186, 40)], 0).convert('RGBA')

def paint(mask, img):
    canvas.paste(img, (0, 0), mask)

R_OUT = 0.268 * S
m1 = arc_mask(S, CX, CY, R_OUT, stroke, start=-58, end=214)
m1 = Image.composite(m1, Image.new('L', (S, S), 0), Image.new('L', (S, S), 255))
head1 = arrow_head(S, CX, CY, R_OUT, stroke, 214, +1)
paint(Image.fromarray(__import__('numpy').maximum(
    __import__('numpy').array(m1), __import__('numpy').array(head1))), warm)

R_IN = 0.142 * S
m2 = arc_mask(S, CX, CY, R_IN, int(stroke * 0.62), start=122, end=394)
head2 = arrow_head(S, CX, CY, R_IN, int(stroke * 0.62), 394, +1)
paint(Image.fromarray(__import__('numpy').maximum(
    __import__('numpy').array(m2), __import__('numpy').array(head2))),
      gradient((S, S), [(255, 190, 60), (255, 120, 60)], 0).convert('RGBA'))

# --- output -----------------------------------------------------------------
icon = canvas.resize((OUT, OUT), Image.LANCZOS)
icon.save(os.path.join(ROOT, 'apps', 'desktop', 'resources', 'icon-windows.png'), 'PNG')

ico_base = canvas.resize((256, 256), Image.LANCZOS)
ico_base.save(os.path.join(ROOT, 'apps', 'desktop', 'resources', 'tray-windows.ico'),
              format='ICO', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('ok')
