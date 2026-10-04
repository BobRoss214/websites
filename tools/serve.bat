@echo off
rem Double-click this file to look at the site on your own computer. Close this window to stop.
rem It starts tools\serve.py with "py -3", or with "python" when there is no "py". It installs and changes nothing.
rem More: README.md, "Commands on Windows, Mac and Linux". (No labels and no goto here on purpose: the file works with Unix or Windows line endings.)
pushd "%~dp0.."
py -3 tools\serve.py
if errorlevel 9009 python tools\serve.py
if errorlevel 9009 echo Python was not found. Install Python 3.8 or newer from python.org/downloads, tick "Add python.exe to PATH", then double-click this file again.
echo.
pause
