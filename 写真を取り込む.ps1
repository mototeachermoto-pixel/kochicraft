# 観光地の写真をアプリに取り込むツール（Windows / PowerShell）
#
# 使い方：
#   1) 画像を入れたフォルダを用意する（ファイル名は何でもOK）
#   2) このファイルを右クリック →「PowerShell で実行」
#      または PowerShell で:  .\写真を取り込む.ps1 -From "Katsurahama Beach" -SpotId katsurahama
#   3) 表示された番号どおりに、あとで src/spots/<観光地>.ts の image: に書けばOK
#
# やること：大きい画像を横1200pxのJPEGに縮めて public/photos/<SpotId>/ に保存する。
# 元の画像はさわりません（コピーして変換するだけ）。

param(
  # 画像が入っているフォルダ（このファイルから見た相対パスでOK）
  [Parameter(Mandatory = $true)][string]$From,
  # 観光地のID（src/spots/SpotRegistry.ts の id。例: katsurahama, kochi-castle, muroto …）
  [Parameter(Mandatory = $true)][string]$SpotId,
  # 横幅の上限（px）。大きすぎるとタブレットで重くなる
  [int]$MaxWidth = 1200,
  # JPEGの画質（1〜100）
  [int]$Quality = 82
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $From)) {
  Write-Host "フォルダが見つかりません: $From" -ForegroundColor Red
  exit 1
}

$outDir = Join-Path $PSScriptRoot "public\photos\$SpotId"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, $Quality)

$files = Get-ChildItem -Path $From -Include *.png, *.jpg, *.jpeg, *.webp -File -Recurse | Sort-Object Name
if ($files.Count -eq 0) {
  Write-Host "画像が見つかりませんでした: $From" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "取り込み先: public\photos\$SpotId" -ForegroundColor Cyan
Write-Host ""

$i = 0
foreach ($f in $files) {
  $i++
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $w = [Math]::Min($img.Width, $MaxWidth)
  $h = [int]($img.Height * ($w / $img.Width))
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)

  # 連番で保存する（あとで中身を見て、正しい名前に変えてください）
  $name = "{0:00}.jpg" -f $i
  $out = Join-Path $outDir $name
  $bmp.Save($out, $codec, $params)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()

  $kb = [math]::Round((Get-Item $out).Length / 1KB)
  Write-Host ("{0}  <-  {1}   ({2}x{3}, {4}KB)" -f $name, $f.Name, $w, $h, $kb)
}

Write-Host ""
Write-Host "できました。次の手順：" -ForegroundColor Green
Write-Host "  1. public\photos\$SpotId\ を開いて中身を確認する"
Write-Host "  2. 01.jpg などを、場所に合う名前に変える（例: ryoma.jpg / sea.jpg / sign.jpg）"
Write-Host "  3. src\spots\<観光地>.ts の各 objects に次の行を足す："
Write-Host "       image: './photos/$SpotId/ryoma.jpg',"
Write-Host "  4. npm run build で確認する"
Write-Host ""
