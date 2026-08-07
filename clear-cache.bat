@echo off
echo === Clearing Metro + Gradle caches ===

echo Killing any Metro servers...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081 " 2^>nul') do taskkill /PID %%p /F 2>nul
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8082 " 2^>nul') do taskkill /PID %%p /F 2>nul

echo Clearing Metro transform cache from Temp...
if exist "%TEMP%\metro-*" rmdir /s /q "%TEMP%\metro-*" 2>nul
for /d %%d in ("%TEMP%\metro-*") do rmdir /s /q "%%d" 2>nul
for /d %%d in ("%LOCALAPPDATA%\Temp\metro-*") do rmdir /s /q "%%d" 2>nul

echo Clearing Watchman cache...
watchman watch-del-all 2>nul

echo Clearing Gradle build cache...
cd /d "%~dp0android"
call gradlew clean 2>nul

echo Clearing node_modules cache files...
cd /d "%~dp0"
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" 2>nul

echo.
echo === Done! Now run in TWO terminals: ===
echo Terminal 1: npx react-native start --reset-cache
echo Terminal 2: npx react-native run-android
echo.
pause
