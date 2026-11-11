@echo off
chcp 65001 >nul
rem Synafood nach GitHub hochladen (Doppelklick). Legt beim ersten Mal das private Repo an.
cd /d "%~dp0"
set OWNER=AleB-Roni
set REPO=synafood
echo == Synafood nach GitHub hochladen ==
where git >nul 2>nul
if errorlevel 1 (
  echo Git fehlt. Installieren: https://git-scm.com/download/win
  pause
  exit /b 1
)
if not exist .git git init -q -b main
git config user.name >nul 2>nul
if errorlevel 1 git config user.name "%OWNER%"
git config user.email >nul 2>nul
if errorlevel 1 git config user.email "%OWNER%@users.noreply.github.com"
git add -A
git commit -q -m "Update %date% %time:~0,5%" >nul 2>nul
if errorlevel 1 (echo Keine neuen Aenderungen.) else (echo Aenderungen gespeichert.)
git branch -M main
where gh >nul 2>nul
if errorlevel 1 goto remote
gh auth status >nul 2>nul
if errorlevel 1 goto remote
gh auth setup-git >nul 2>nul
gh repo view %OWNER%/%REPO% >nul 2>nul
if not errorlevel 1 goto remote
echo Lege privates Repo %OWNER%/%REPO% an ...
gh repo create %OWNER%/%REPO% --private --description "Synafood - Kassenzettel teilen" >nul
:remote
git remote get-url origin >nul 2>nul
if errorlevel 1 git remote add origin https://github.com/%OWNER%/%REPO%.git
git push -u origin main
if errorlevel 1 goto failed
echo.
echo Fertig: https://github.com/%OWNER%/%REPO%
echo GitHub baut jetzt das Docker-Image (Tab "Actions", ca. 1-2 Minuten).
echo Danach in Portainer beim Stack "Pull and redeploy" mit "Re-pull image".
pause
exit /b 0
:failed
echo.
echo Hochladen fehlgeschlagen.
echo Gibt es das Repo noch nicht? GitHub CLI installieren und anmelden (winget install GitHub.cli, dann gh auth login)
echo oder auf https://github.com/new ein leeres privates Repo "%REPO%" OHNE README anlegen und nochmal doppelklicken.
pause
exit /b 1
