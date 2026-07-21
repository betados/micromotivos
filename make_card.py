"""Draw pages/card.png, the site-wide 1200x630 social-preview card.

Left: site title + tagline. Right: a genuine mini Schelling run (threshold
0.6, fixed seed) rendered as the pastel grid from schelling.css, so the card
shows the site's actual aesthetic and an actually-emergent pattern.
"""
import random
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = "#fafafa"
INK = "#222222"
MUTED = "#5c5c5c"
BLUE = "#9dc0ee"
ORANGE = "#f2bd84"
LINE = "#e2e2e2"

COLS, ROWS = 10, 11
EMPTY_FRAC = 0.12
THRESHOLD = 0.6

rng = random.Random(7)


def neighbours(grid, x, y):
    out = []
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS:
                out.append(grid[ny][nx])
    return out


def unhappy(grid, x, y):
    me = grid[y][x]
    if me is None:
        return False
    occ = [n for n in neighbours(grid, x, y) if n is not None]
    if not occ:
        return False
    return sum(1 for n in occ if n == me) / len(occ) < THRESHOLD


cells = [None] * int(COLS * ROWS * EMPTY_FRAC)
rest = COLS * ROWS - len(cells)
cells += [0] * (rest // 2) + [1] * (rest - rest // 2)
rng.shuffle(cells)
grid = [cells[r * COLS : (r + 1) * COLS] for r in range(ROWS)]

for _ in range(500):
    movers = [(x, y) for y in range(ROWS) for x in range(COLS) if unhappy(grid, x, y)]
    if not movers:
        break
    x, y = rng.choice(movers)
    empties = [(ex, ey) for ey in range(ROWS) for ex in range(COLS) if grid[ey][ex] is None]
    ex, ey = rng.choice(empties)
    grid[ey][ex], grid[y][x] = grid[y][x], None

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

CELL, GAP, R = 40, 5, 8
grid_w = COLS * (CELL + GAP) - GAP
grid_h = ROWS * (CELL + GAP) - GAP
gx0 = W - grid_w - 80
gy0 = (H - grid_h) // 2
for y in range(ROWS):
    for x in range(COLS):
        cx = gx0 + x * (CELL + GAP)
        cy = gy0 + y * (CELL + GAP)
        v = grid[y][x]
        fill = "#ffffff" if v is None else (BLUE if v == 0 else ORANGE)
        d.rounded_rectangle([cx, cy, cx + CELL, cy + CELL], radius=R, fill=fill, outline=LINE)

title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 68)
tag_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)

d.text((80, 210), "micromotivos", font=title_font, fill=INK)
d.text((84, 330), "Modelos de comportamiento", font=tag_font, fill=MUTED)
d.text((84, 375), "social emergente, explicados", font=tag_font, fill=MUTED)
d.text((84, 420), "y simulados.", font=tag_font, fill=MUTED)

img.save("pages/card.png", optimize=True)
print("wrote pages/card.png")
