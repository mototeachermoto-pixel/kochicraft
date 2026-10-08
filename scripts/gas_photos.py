"""
GAS 版で使う写真のファイルを作る（npm run build:gas から呼ばれる）。

public/photos/<観光地ID>/*.jpg を、パネルに出る大きさ（長い辺 640px）に縮め、
観光地ごとに1つのファイル gas/photos_<観光地ID>.html にまとめる。
中身は {"photos/<観光地ID>/<名前>.jpg": "data:image/jpeg;base64,..."} の JSON。
GAS の getPhotos() がこれを読んで、ドライブを使わずにすぐ写真を返す。
"""
import base64
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'photos'
OUT = ROOT / 'gas'
MAX_SIDE = 640
QUALITY = 80

for old in OUT.glob('photos_*.html'):
    old.unlink()

total = 0
for spot_dir in sorted(p for p in SRC.iterdir() if p.is_dir()):
    photos = {}
    for f in sorted(spot_dir.iterdir()):
        if f.suffix.lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        im = Image.open(f).convert('RGB')
        im.thumbnail((MAX_SIDE, MAX_SIDE))
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=QUALITY, optimize=True)
        photos[f'photos/{spot_dir.name}/{f.name}'] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    if not photos:
        continue
    # GAS のファイル名に「-」を使わないよう「_」に置き換える
    name = 'photos_' + spot_dir.name.replace('-', '_') + '.html'
    text = json.dumps(photos, separators=(',', ':'))
    (OUT / name).write_text(text, encoding='utf-8')
    total += len(photos)
    print(f'{name}: {len(photos)} photos, {len(text) // 1024} KB')

print(f'total: {total} photos')
