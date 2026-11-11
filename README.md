# Synafood

Kassenzettel von Essensbestellungen scannen, jeder hakt sein Gericht an und sieht, was er dem Besteller schuldet. Web-App (PWA) mit kleinem Node-Server, ohne Abhängigkeiten.

## Hochladen
Doppelklick auf **„Nach GitHub hochladen.command“** (Mac) bzw. **„Nach GitHub hochladen.bat“** (Windows).
Danach baut GitHub Actions automatisch das Image `ghcr.io/aleb-roni/synafood:latest`.

## Portainer
Stack aus diesem Repository anlegen (Compose-Pfad `docker-compose.yml`). Einstellungen als Environment variables im Stack:

| Variable | Bedeutung |
|---|---|
| `SYNAFOOD_PORT` | Port am Server (Standard 8080) |
| `APP_PASSWORD` | Zugangspasswort für alle (optional) |
| `ADMIN_PASSWORD` | Nur damit lassen sich Personen anlegen/entfernen (optional) |
| `LLM_URL`, `LLM_MODEL`, `LLM_API`, `LLM_API_KEY` | KI-Scanner (lokales Vision-Modell, optional) |

Update: nach grünem Actions-Lauf im Stack **Pull and redeploy** mit **Re-pull image**.

Daten liegen im Volume `synafood-data` (Bestellungen und Bon-Fotos).
