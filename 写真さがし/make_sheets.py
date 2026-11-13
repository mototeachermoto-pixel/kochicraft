"""観光地ごとの検索結果を、番号つきの一覧ページにする（見た目の比較/候補_<key>.html）。
番号と写真の情報は all/index.json に残す（あとでダウンロードするため）。"""
import glob
import html
import json
import re
import sys

S, OUTDIR = sys.argv[1], sys.argv[2]
KEYWORDS = {
    'ashizuri': r'足摺|ashizuri|白山洞門|hakusan|万次郎|manjiro|金剛福寺',
    'castle': r'高知城|kochi castle|kōchi castle|板垣|itagaki|一豊|kazutoyo|追手門|ote ?mon|otemon',
    'katsura': r'桂浜|katsurahama|龍頭|竜王|龍王',
    'makino': r'牧野|makino',
    'muroto': r'室戸|muroto',
    'niko': r'にこ淵|仁淀|nikobuchi|niyodo',
    'noichi': r'のいち|野市|noichi',
    'ryoma': r'龍馬|竜馬|ryoma|ryōma',
    'shimanto': r'四万十|shimanto|沈下橋|chinkabashi|chinka',
    'tram': r'土佐電|とさでん|tosaden|tosa ?electric|tosa-den|toden|はりまや',
}
index = {}
for key, kw in KEYWORDS.items():
    seen = {}
    for f in sorted(glob.glob(f'{S}/検索結果/{key}_*.json')):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        for p in (d.get('query', {}).get('pages', {}) or {}).values():
            t = p['title']
            ii = (p.get('imageinfo') or [None])[0]
            if not ii or not re.search(r'\.(jpe?g|png)$', t, re.I):
                continue
            m = ii.get('extmetadata', {})
            desc = re.sub(r'\s+', ' ', re.sub('<[^>]+>', '', m.get('ImageDescription', {}).get('value', '')))
            if not re.search(kw, t + ' ' + desc, re.I):
                continue
            if (ii.get('width') or 0) < 900:
                continue
            seen[t] = {
                'title': t, 'thumb': ii.get('thumburl'), 'w': ii.get('width'), 'h': ii.get('height'),
                'lic': m.get('LicenseShortName', {}).get('value', ''),
                'artist': re.sub('<[^>]+>', '', m.get('Artist', {}).get('value', '')).strip()[:50],
                'desc': desc[:90],
            }
    items = sorted(seen.values(), key=lambda v: v['title'])
    for i, v in enumerate(items, 1):
        v['num'] = f'{key}{i}'
    index[key] = items
    cards = ''.join(
        f'<figure><div class="num">{v["num"]}</div><img src="{html.escape(v["thumb"])}" loading="eager">'
        f'<figcaption>{html.escape(v["title"][5:])}<br>{html.escape(v["lic"])} ・ {html.escape(v["artist"])}<br>{html.escape(v["desc"])}</figcaption></figure>'
        for v in items)
    page = f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>候補 {key}</title>
<style>:root{{--bg:#f6f5f0;--card:#fff;--text:#1c1c1a;--muted:#5f5e5a;--line:#d3d1c7}}@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#1c1c1a;--card:#2c2c2a;--text:#f1efe8;--muted:#b4b2a9;--line:#444441}}}}
body{{margin:0;padding:4px;background:var(--bg);color:var(--text);font-family:system-ui,"Yu Gothic UI",sans-serif}}
.g{{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}}figure{{margin:0;position:relative;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}}
img{{width:100%;height:150px;object-fit:cover;display:block;background:#888}}figcaption{{display:none;font-size:11px;padding:4px;color:var(--muted)}}
.num{{position:absolute;top:3px;left:3px;background:#0f6e56;color:#fff;font-weight:700;font-size:12px;padding:0 6px;border-radius:999px}}
body.cap figcaption{{display:block}}</style></head><body><div class="g">{cards}</div></body></html>'''
    open(f'{OUTDIR}/候補_{key}.html', 'w', encoding='utf-8').write(page)
json.dump(index, open(f'{S}/検索結果/index.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in index.items()})
