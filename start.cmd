@echo off
rem Nhấp đúp để chạy Tin Tức Việt Nam (Postgres + web/CMS + worker). Đóng cửa sổ hoặc Ctrl+C để dừng.
chcp 65001 >nul
cd /d "%~dp0"
call pnpm serve %*
pause
