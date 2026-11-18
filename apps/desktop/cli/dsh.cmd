@echo off
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
rem Keep this fork's CLI on its own home instead of the upstream ~\.dsh.
if not defined DSH_HOME set "DSH_HOME=%USERPROFILE%\.dsh-purge"
"%~dp0..\..\..\..\DeepSeek Purge.exe" --expose-internals "%~dp0..\..\..\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js" %*
exit /b %errorlevel%
