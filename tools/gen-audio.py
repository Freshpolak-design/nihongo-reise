"""Erzeugt audio/<id>.mp3 für jede Phrase aus data.js mit Microsoft-Edge-Neural-Stimmen.

Aufruf (aus dem Projektordner):  python tools/gen-audio.py [--force]
Vorhandene Dateien werden übersprungen, außer mit --force.
Personal-Sätze (who: 'staff') spricht Keita, alles andere Nanami.
"""
import asyncio
import json
import pathlib
import subprocess
import sys

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
VOICE = {"staff": "ja-JP-KeitaNeural"}
DEFAULT_VOICE = "ja-JP-NanamiNeural"


def load_phrases():
    js = "global.self=global;require('./data.js');console.log(JSON.stringify(self.NR_DATA.phrases))"
    out = subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(out.stdout)


async def main(force):
    AUDIO.mkdir(exist_ok=True)
    phrases = load_phrases()
    done = 0
    for p in phrases:
        target = AUDIO / f"{p['id']}.mp3"
        if target.exists() and not force:
            continue
        text = p.get("tts") or p["jp"]
        voice = VOICE.get(p.get("who"), DEFAULT_VOICE)
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, voice, rate="-10%").save(str(target))
                break
            except Exception as e:  # Netzwerkfehler → kurz warten, erneut versuchen
                print(f"  {p['id']}: Versuch {attempt + 1} fehlgeschlagen: {e}")
                await asyncio.sleep(2)
        else:
            print(f"FEHLER {p['id']}")
            continue
        done += 1
        print(f"{p['id']:18} {voice.split('-')[2]:14} {text}")
    missing = [p["id"] for p in phrases if not (AUDIO / f"{p['id']}.mp3").exists()]
    print(f"\n{done} erzeugt, {len(phrases) - len(missing)}/{len(phrases)} vorhanden, fehlend: {missing or '-'}")


if __name__ == "__main__":
    asyncio.run(main("--force" in sys.argv))
