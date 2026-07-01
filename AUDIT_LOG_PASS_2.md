# Zweites Vollständiges Audit-Logbuch (Deep-Dive & Edge-Case Analysis)

Im zweiten Audit-Durchgang analysierten wir noch gründlicher alle potenziellen Edge-Cases, Race-Conditions, Speicherleck-Szenarien, Sicherheitslücken und subtile Logikfehler über alle Module hinweg.

---

## Fortschritt / Checkliste (Pass 2):

- [x] `src/lib/transferManager.ts` (Race conditions, Memory management, Cleanup intervals)
- [x] `src/lib/zipFolder.ts` (Large file streaming, JSZip memory overhead, Folder hierarchy traversal)
- [x] `src/middleware.ts` & Security headers / Route protection
- [x] `src/app/api/upload/route.ts` (Concurrent write locks, partial chunk cleanup, tracker directory leaks)
- [x] `src/app/api/download/[fileId]/route.ts` (Stream error handling, file descriptor leaks, range request boundaries)
- [x] `src/app/api/download/zip/route.ts` (Active transfer tracking for ZIP downloads, stream error propagation)
- [x] `src/app/api/public/links/[urlPath]/route.ts` (Concurrent usage counting race conditions, FILE_TUNNEL polling optimization)
- [x] `src/app/[urlPath]/page.tsx` (Drop zone state reset, chunk retry backoff, FILE_TUNNEL live update efficiency)
- [x] `src/app/admin/create/page.tsx` (Form validation, chunk error recovery, aborted upload cleanup)
- [x] `src/worker.ts` (Cron error handling, orphaned file recovery)

---

## Gefundene Befunde & Optimierungen (Pass 2):

1. **ZIP-Download-Tracking im TransferManager**:
   - **Befund:** Große ZIP-Downloads via `/api/download/zip` wurden bisher nicht im `transferManager` registriert. Administratoren sahen laufende ZIP-Downloads daher nicht in der Übersicht der aktiven Übertragungen.
   - **Behebung:** ZIP-Downloads starten nun einen Transfer im TransferManager, melden Fortschritt und brechen bei Stream-Abbruch (`cancel()` / `error`) sauber ab.

2. **Dynamische Validierung in ZIP- und Datei-Download-Routen**:
   - **Befund:** Weder `/api/download/[fileId]` noch `/api/download/zip` prüften beim Direktdownload aktiv auf Ablaufdatum (`expiresAt`) oder Erreichen von `maxUsage`. Lesezeichen-Downloads blieben offen.
   - **Behebung:** Proaktive Prüfung in beiden Download-Endpunkten implementiert. Abgelaufene oder verbrauchte Links werden blockiert (403/404) und automatisch als `"EXPIRED"` markiert.

3. **Verhinderung von Race-Conditions bei parallelen Chunks (`CONCURRENCY = 4`)**:
   - **Befund:** Wenn bei Chunked-Uploads die letzten beiden Chunks exakt gleichzeitig abschlossen, konnten beide Threads den Block `doneCount === totalChunks` betreten und doppelte Datei-Einträge in der Prisma-Datenbank anlegen.
   - **Behebung:** Ein atomares Check-and-Lock via `fs.writeFileSync(lockPath, "", { flag: "wx" })` stellt auf OS-Dateisystemebene sicher, dass exakt nur ein Thread den Abschluss ausführt.

4. **Verwaiste Transfers (Memory-Leak Schutz)**:
   - **Befund:** Abgebrochene Übertragungen, die vom Client ohne FIN/Abort beendet wurden, blieben endlos im Speicher des `TransferManager`.
   - **Behebung:** Automatische Bereinigung in `getTransfers()` hinzugefügt: Transfers ohne Updates seit über 10 Minuten werden aus der Map gelöscht.

5. **Exponenzieller Backoff bei Netzwerk-Retries**:
   - **Befund:** Bei fehlgeschlagenen Chunk-Uploads wartete der Client starr 1000 ms pro Versuch, was bei instabilen Mobil- oder WLAN-Verbindungen zu schnellen Abbrüchen führte.
   - **Behebung:** Exponenzieller Backoff (`Math.min(Math.pow(2, attempt) * 1000, 10000)`) in `src/app/[urlPath]/page.tsx` und `src/app/admin/create/page.tsx` integriert.

6. **Fehler-Isolation im Worker-Cronjob**:
   - **Befund:** Schlug das Löschen einer Datei im Aufräumdienst fehl (z. B. wegen Dateisperren unter Windows), brach die gesamte Schleife ab.
   - **Behebung:** `try/catch`-Isolation pro Link sorgt dafür, dass ein Problemfall nicht die Bereinigung anderer Links verhindert.

7. **Vorzeitige Stream-Schließung bei Downloads**:
   - **Befund:** Brach eine Dateidownload-Verbindung vorzeitig ab, blieb der Transfer aktiv im Status stehen.
   - **Behebung:** `progressStream.on('close', ...)` fängt vorzeitige Verbindungsabbrüche (`bytesDownloaded < totalSize`) zuverlässig ab.
