"""Convert codex-generated source art in art_src/ into web-ready assets in public/."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art_src'
OUT = ROOT / 'public' / 'assets'
ICONS = ROOT / 'public' / 'icons'
OUT.mkdir(parents=True, exist_ok=True)
ICONS.mkdir(parents=True, exist_ok=True)

for name in ['kaen', 'raiga', 'hyoka']:
    bg = Image.open(SRC / f'bg_{name}.png').convert('RGB')
    bg.thumbnail((1672, 1672), Image.LANCZOS)
    bg.save(OUT / f'bg_{name}.jpg', quality=82, optimize=True, progressive=True)
    for kind in ['cloth', 'face']:
        im = Image.open(SRC / f'tex_{name}_{kind}.png').convert('RGB').resize((512, 512), Image.LANCZOS)
        im.save(OUT / f'tex_{name}_{kind}.jpg', quality=85, optimize=True)
    px = Image.open(SRC / f'px_{name}.png').convert('RGB').resize((256, 256), Image.LANCZOS)
    px.save(OUT / f'px_{name}.png', optimize=True)

icon = Image.open(SRC / 'icon.png').convert('RGB')
for size in [512, 192, 180, 32]:
    icon.resize((size, size), Image.LANCZOS).save(ICONS / f'icon-{size}.png', optimize=True)
# maskable: add safe-zone padding with the icon background colour
bgc = icon.getpixel((4, 4))
canvas = Image.new('RGB', (512, 512), bgc)
inner = icon.resize((410, 410), Image.LANCZOS)
canvas.paste(inner, (51, 51))
canvas.save(ICONS / 'maskable-512.png', optimize=True)
print('ok')
