@echo off
echo Running Debug Extractor with increased memory allocation...
echo.
echo Usage: debugExtractor.bat [URL] [pageType]
echo Example: debugExtractor.bat https://www.myntra.com/men-tshirts searchPage
echo.
echo Note: This script uses --max-old-space-size=4096 to increase memory limit
echo.

set URL=%1
if "%URL%"=="" set URL=https://www.myntra.com/men-tshirts

set PAGETYPE=%2
if "%PAGETYPE%"=="" set PAGETYPE=searchPage

echo Extracting from: %URL%
echo Page type: %PAGETYPE%
echo.

node --max-old-space-size=4096 --expose-gc scripts/debugExtractor.js "%URL%" "%PAGETYPE%"

echo.
echo Extraction complete.
pause
