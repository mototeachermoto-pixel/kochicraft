@echo off
chcp 65001 >nul
echo ============================================
echo  KochiCraft を起動しています...
echo  ブラウザが自動で開きます。
echo  この黒い画面は閉じないでください。
echo  （終わるときに、この画面を閉じてください）
echo ============================================
cd /d "%~dp0"
call npm run dev -- --host
pause
