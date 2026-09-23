@echo off
cd /d "%~dp0"

set "DEST=%USERPROFILE%\Desktop\KochiCraft-公開用フォルダ"

echo ==========================================
echo  KochiCraft 公開用フォルダの更新
echo ==========================================
echo.
echo [1/3] アプリを書き出しています（1分ほどかかります）...
call npm run build
if errorlevel 1 (
  echo.
  echo *** 書き出しに失敗しました。上のメッセージを Claude に見せてください。
  pause
  exit /b 1
)

echo.
echo [2/3] 公開用フォルダにコピーしています...
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
xcopy "dist\*" "%DEST%\" /E /I /Q /Y > nul
if errorlevel 1 (
  echo *** コピーに失敗しました。
  pause
  exit /b 1
)

for /f %%N in ('dir /b /s /a-d "%DEST%" ^| find /c /v ""') do set COUNT=%%N
echo     %COUNT% 個のファイルを用意しました。

echo.
echo [3/3] フォルダを開きます。
start "" "%DEST%"

echo.
echo ==========================================
echo  準備ができました
echo ==========================================
echo.
echo  このあと Cloudflare で：
echo    1. 右上の「新規展開」を押す
echo    2. 開いたフォルダを枠にドラッグ
echo    3. 「展開する」を押す
echo.
echo  公開URL:
echo    https://blue-tree-7826.moto-teacher-moto.workers.dev
echo.
pause
