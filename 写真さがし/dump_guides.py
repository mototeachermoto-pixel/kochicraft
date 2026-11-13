"""全部の観光地の見どころの英文（canDo / feature / about）を一覧で出す。"""
import glob
import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
PAT = re.compile(
    r"id: '([^']+)',\n\s*name: '([^']+)',.*?canDo: '(.*?)',\n\s*feature: '(.*?)',\n\s*about: '(.*?)',\n",
    re.S,
)
for p in sorted(glob.glob(sys.argv[1] + '/src/spots/*.ts')):
    s = io.open(p, encoding='utf-8').read()
    spot = re.split(r'[\\/]', p)[-1][:-3]
    for m in PAT.finditer(s):
        print(f'{spot}|{m.group(1)}|{m.group(2)}|C: {m.group(3)}|F: {m.group(4)}|A: {m.group(5)}')
