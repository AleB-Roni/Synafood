#!/bin/bash
# Synafood nach GitHub hochladen (Doppelklick). Legt beim ersten Mal das private Repo an.
cd "$(dirname "$0")" || exit 1
OWNER="AleB-Roni"
REPO="synafood"
echo "== Synafood nach GitHub hochladen =="
if ! command -v git >/dev/null 2>&1; then
  echo "Git fehlt. Im Terminal einmal ausführen: xcode-select --install"
  read -r -p "Enter zum Schließen"; exit 1
fi
[ -d .git ] || git init -q -b main
git config user.name  >/dev/null 2>&1 || git config user.name  "$OWNER"
git config user.email >/dev/null 2>&1 || git config user.email "$OWNER@users.noreply.github.com"
git add -A
if git commit -q -m "Update $(date '+%Y-%m-%d %H:%M')" >/dev/null 2>&1; then echo "Änderungen gespeichert."; else echo "Keine neuen Änderungen."; fi
git branch -M main
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh auth setup-git >/dev/null 2>&1
  if ! gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
    echo "Lege privates Repo $OWNER/$REPO an …"
    gh repo create "$OWNER/$REPO" --private --description "Synafood – Kassenzettel teilen" >/dev/null || { read -r -p "Anlegen fehlgeschlagen. Enter zum Schließen"; exit 1; }
  fi
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO.git"
if git push -u origin main; then
  echo ""
  echo "Fertig: https://github.com/$OWNER/$REPO"
  echo "GitHub baut jetzt das Docker-Image (Tab „Actions“, ca. 1–2 Minuten)."
  echo "Danach in Portainer beim Stack „Pull and redeploy“ mit „Re-pull image“."
else
  echo ""
  echo "Hochladen fehlgeschlagen."
  echo "Gibt es das Repo noch nicht? Entweder GitHub CLI installieren und anmelden (brew install gh && gh auth login)"
  echo "oder auf https://github.com/new ein leeres privates Repo „$REPO“ OHNE README anlegen und nochmal doppelklicken."
  echo "Fragt Git nach einem Passwort: dort ein GitHub-Token (Personal Access Token) eingeben, nicht das Kontopasswort."
fi
read -r -p "Enter zum Schließen"
