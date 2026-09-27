"""Erzeugt die Audiodateien für jede Phrase aus data.js mit Microsoft-Edge-Neural-Stimmen.

  audio/<id>.mp3     Japanisch – Personal-Sätze (who: 'staff') spricht Keita, alles andere Nanami
  audio/de/<id>.mp3  Deutsch für die Playlist – Conrad; Klammer-Zusätze werden nicht vorgelesen
  audio/pause-*.mp3  Stille für die Playlist-Pausen (per ffmpeg)

Aufruf (aus dem Projektordner):  python tools/gen-audio.py [--force]
Vorhandene Dateien werden übersprungen, außer mit --force.
"""
import asyncio
import json
import pathlib
import re
import subprocess
import sys

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
AUDIO_DE = AUDIO / "de"
VOICE = {"staff": "ja-JP-KeitaNeural"}
DEFAULT_VOICE = "ja-JP-NanamiNeural"
DE_VOICE = "de-DE-ConradNeural"
PAUSES = {"pause-short": 0.8, "pause-long": 2.2}  # Sekunden: zwischen DE und JP / nach JP zum Nachsprechen


def load_phrases():
    js = "global.self=global;require('./data.js');console.log(JSON.stringify(self.NR_DATA.phrases))"
    out = subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(out.stdout)


def german_text(p):
    """„Wie viele Personen? (fragt das Personal)“ → „Wie viele Personen?“; „A / B“ → „A, B“."""
    if p.get("deTts"):
        return p["deTts"]
    text = re.sub(r"\s*\([^)]*\)", "", p["de"])
    return text.replace(" / ", ", ").strip()


def ok(target):
    """Vorhanden UND nicht leer – edge-tts legt bei Abbruch eine 0-Byte-Datei an."""
    return target.exists() and target.stat().st_size > 1000


async def synth(text, voice, target, rate):
    for attempt in range(5):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(str(target))
            if ok(target):
                return True
            raise RuntimeError("leere Datei")
        except Exception as e:  # Netzwerkfehler/Drosselung → warten, erneut versuchen
            print(f"  {target.name}: Versuch {attempt + 1} fehlgeschlagen: {e}")
            target.unlink(missing_ok=True)
            await asyncio.sleep(3 * (attempt + 1))
    return False


async def main(force):
    AUDIO.mkdir(exist_ok=True)
    AUDIO_DE.mkdir(exist_ok=True)
    phrases = load_phrases()
    jobs = []
    for p in phrases:
        jobs.append((AUDIO / f"{p['id']}.mp3", p.get("tts") or p["jp"], VOICE.get(p.get("who"), DEFAULT_VOICE), "-10%"))
        jobs.append((AUDIO_DE / f"{p['id']}.mp3", german_text(p), DE_VOICE, "+0%"))
    done = 0
    for target, text, voice, rate in jobs:
        if ok(target) and not force:
            continue
        await asyncio.sleep(0.4)  # Dienst nicht drosseln
        if await synth(text, voice, target, rate):
            done += 1
            print(f"{target.relative_to(AUDIO).as_posix():22} {voice.split('-')[2]:14} {text}")
        else:
            print(f"FEHLER {target}")

    for name, secs in PAUSES.items():
        target = AUDIO / f"{name}.mp3"
        if target.exists() and not force:
            continue
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                        "-t", str(secs), "-b:a", "32k", str(target)], check=True)
        print(f"{target.name:22} Stille {secs}s")

    missing = [str(t.relative_to(AUDIO)) for t, *_ in jobs if not ok(t)]
    print(f"\n{done} erzeugt, {len(jobs) - len(missing)}/{len(jobs)} vorhanden, fehlend: {missing or '-'}")


if __name__ == "__main__":
    asyncio.run(main("--force" in sys.argv))
