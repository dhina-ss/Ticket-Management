@echo off
echo ===================================================
echo Starting Ticket Raise Project
echo ===================================================

echo.
echo [1/2] Building Frontend...
cd frontend
call npm run build
cd ..

echo.
echo [2/2] Starting Backend...
cd backend
if exist "env\Scripts\activate.bat" (
    call env\Scripts\activate.bat
)
python run_prod.py -e prod

echo.
pause
