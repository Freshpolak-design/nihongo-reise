# 🎌 MG Nihongo

Japanisch-Basics für die Japanreise trainieren: eine Web-App (PWA) fürs Handy, die offline läuft und Audio hat.

Grundlage sind die Phrasen aus dem Video [„20 Japanisch Vokabeln für deine Japanreise!“](https://www.youtube.com/watch?v=26VUZNqJ89c) (WanderWeib Japan). In der App sind sie mit ▶ markiert. Dazu kommen weitere Reise-Basics: Zahlen, Hotel, Notfall und Allergien. Insgesamt sind es 102 Phrasen in 10 Kategorien.

## Funktionen
- **Karteikarten** mit Wiederholungssystem (Leitner-Boxen). Karten, die du nicht wusstest, kommen öfter dran.
- **Playlist**: Karten per 🎧-Schalter sammeln und vorlesen lassen – erst Deutsch, dann Japanisch, dann Zeit zum Nachsprechen. Mit Zufällig, Endlos und Steuerung auf dem Sperrbildschirm
- **Parken**: Phrasen für später beiseitelegen (raus aus Karten und Quiz)
- **Quiz**: Hör-Quiz, Deutsch → Japanisch, Japanisch → Deutsch, gemischt, filterbar nach Kategorie
- **Situations-Dialoge**: Restaurant, Konbini, Imbiss, Bahnhof, Hotel, Notfall
- **Reise-Modus**: Suche, Favoriten, Großanzeige zum Vorzeigen (drehbar) mit Audio
- **Aussprache**: Aufnehmen & mit der Profi-Stimme vergleichen (ohne Signalton, iPhone + Android). Optional die automatische Offline-Bewertung per Whisper base (~80 MB, Download in ⚙️)
- **Anzeige-Ebenen** einzeln schaltbar: Kanji/Kana, Hiragana-Lesung, Romaji, Deutsch
- **Audio**: Neural-Stimmen als MP3 (Nanami, beim Personal Keita). Fällt eine MP3 aus, spricht die Stimme des Handys.
- Punkte, Streak, Tagesziel, Level. Der Fortschritt bleibt lokal auf dem Gerät.

## Aufs Handy
Die Seite in Chrome öffnen, dann **⋮ → „Zum Startbildschirm hinzufügen“** bzw. **„App installieren“** wählen. Nach dem ersten Laden funktioniert alles offline, auch die Aussprache-Bewertung, sobald das Modell geladen ist.

## Entwicklung
- Reines HTML/CSS/JS ohne Build-Schritt. Lokal: `python -m http.server` im Ordner.
- Inhalte stehen in `data.js`. Neue Phrasen dort eintragen und danach Audio erzeugen:
  `pip install edge-tts` → `python tools/gen-audio.py` (Japanisch, Deutsch für die Playlist und Pausen; nur fehlende Dateien, `--force` für alle).
- Nach Änderungen an Dateien `VERSION` in `sw.js` erhöhen, damit der Offline-Cache aktualisiert wird.
