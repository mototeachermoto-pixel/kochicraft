#!/bin/sh
# 残りの観光地の写真を、コモンズで観光地ごとに検索する（間をあけて、混み合わないように）
S="/c/Users/user/Desktop/マインクラフト風アプリ/写真さがし"
UA="KochiCraftPhotoSearch/1.0 (school project)"
mkdir -p "$S/検索結果"
i=0
while IFS='|' read -r key q; do
  [ -z "$key" ] && continue
  i=$((i+1))
  curl -s -A "$UA" -G "https://commons.wikimedia.org/w/api.php" \
    --data-urlencode "action=query" --data-urlencode "generator=search" --data-urlencode "gsrsearch=$q" \
    --data-urlencode "gsrnamespace=6" --data-urlencode "gsrlimit=50" \
    --data-urlencode "prop=imageinfo" --data-urlencode "iiprop=url|size|extmetadata" --data-urlencode "iiurlwidth=400" \
    --data-urlencode "format=json" -o "$S/検索結果/${key}_$i.json"
  echo "$key $q $(wc -c < "$S/検索結果/${key}_$i.json")"
  sleep 12
done <<'LIST'
katsura|桂浜
katsura|Katsurahama
makino|牧野植物園
makino|Makino Botanical Garden
muroto|室戸岬
muroto|Cape Muroto
niko|にこ淵
niko|Nikobuchi
noichi|のいち動物公園
noichi|Noichi Zoo
ryoma|坂本龍馬像 桂浜
ryoma|Sakamoto Ryoma statue Kochi
shimanto|四万十川
shimanto|Shimanto River
shimanto|沈下橋
tram|土佐電気鉄道 はりまや橋
LIST
