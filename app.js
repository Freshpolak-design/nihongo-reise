(() => {
  'use strict';

  const D = self.NR_DATA;
  const P = Object.fromEntries(D.phrases.map(p => [p.id, p]));
  const CAT = Object.fromEntries(D.categories.map(c => [c.id, c]));
  const $view = document.getElementById('view');
  const $sheet = document.getElementById('sheet');
  const $toast = document.getElementById('toast');

  // ── Speicher (lokal auf dem Gerät) ───────────────────────────────────────
  const KEY = 'nihongo-reise-v1';
  const DEFAULTS = {
    cards: {}, dialogs: {}, favs: [], playlist: [], xp: 0,
    streak: { days: 0, last: null }, today: { date: null, xp: 0 },
    settings: { jp: true, kana: true, romaji: true, de: true, autoplay: true, dir: 'de-jp', audio: 'mp3', goal: 50, asr: false, mode: 'online', plShuffle: false, plRepeat: false },
  };
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return { ...structuredClone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...s.settings } };
      }
    } catch { /* privater Modus o. Ä. → frisch starten */ }
    return structuredClone(DEFAULTS);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignorieren */ } }

  const dayStr = (d = new Date()) => d.toLocaleDateString('sv');
  const yesterday = () => dayStr(new Date(Date.now() - 864e5));

  // ── Hilfsfunktionen ──────────────────────────────────────────────────────
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.random() * a.length | 0];

  function toast(msg, ms = 2200) {
    $toast.textContent = msg; $toast.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { $toast.hidden = true; }, ms);
  }
  function confetti() {
    const box = document.createElement('div'); box.className = 'confetti';
    for (let i = 0; i < 34; i++) {
      const e = document.createElement('i');
      e.textContent = pick(['🎉', '🌸', '⭐', '🍣', '🎌', '✨', '🍙']);
      e.style.left = Math.random() * 100 + 'vw';
      e.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
      e.style.animationDelay = Math.random() * .5 + 's';
      box.appendChild(e);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 4200);
  }

  // ── Punkte & Streak ──────────────────────────────────────────────────────
  function addXP(n) {
    const today = dayStr();
    if (S.today.date !== today) S.today = { date: today, xp: 0 };
    if (S.streak.last !== today) {
      S.streak.days = S.streak.last === yesterday() ? S.streak.days + 1 : 1;
      S.streak.last = today;
    }
    const before = S.today.xp;
    S.xp += n; S.today.xp += n;
    save(); updateChips();
    if (before < S.settings.goal && S.today.xp >= S.settings.goal) { confetti(); toast('🎯 Tagesziel geschafft! すごい！'); }
  }
  function streakDays() { return S.streak.last === dayStr() || S.streak.last === yesterday() ? S.streak.days : 0; }
  function todayXP() { return S.today.date === dayStr() ? S.today.xp : 0; }
  function updateChips() {
    document.getElementById('chip-streak').textContent = `🔥 ${streakDays()}`;
    document.getElementById('chip-xp').textContent = `⭐ ${S.xp}`;
  }
  const LEVEL_XP = 200;

  // ── Wiederholungssystem (Leitner-Boxen) ──────────────────────────────────
  const DAY = 864e5;
  const INTERVALS = [0, 1, 3, 7, 14, 30, 60]; // Tage bis zur nächsten Abfrage je Box
  const MASTER_BOX = 4;
  const card = id => S.cards[id] || (S.cards[id] = { box: 0, due: 0, seen: false, ok: 0, ko: 0 });
  // Geparkte Karten ruhen: weder fällig noch neu, bis sie zurückgeholt werden
  const isParked = id => !!S.cards[id]?.parked;
  const isDue = id => { const c = S.cards[id]; return !!c && c.seen && !c.parked && c.due <= Date.now(); };
  const isNew = id => !S.cards[id]?.seen && !isParked(id);
  const parkedIds = () => D.phrases.filter(p => isParked(p.id)).map(p => p.id);
  function setParked(id, on) { card(id).parked = on; save(); }
  const mastered = id => (S.cards[id]?.box || 0) >= MASTER_BOX;

  function rateCard(id, grade) {
    const c = card(id), now = Date.now();
    c.seen = true;
    if (grade === 'again') { c.box = 0; c.due = now; c.ko++; }
    else if (grade === 'hard') { c.box = Math.max(1, c.box); c.due = now + Math.max(INTERVALS[c.box] * DAY / 2, 10 * 60e3); c.ok++; }
    else { c.box = Math.min(c.box + 1, INTERVALS.length - 1); c.due = now + INTERVALS[c.box] * DAY; c.ok++; }
    save();
  }
  function quizMark(id, correct) {
    const c = card(id);
    if (correct) {
      c.ok++;
      if (!c.seen) { c.seen = true; c.box = 1; c.due = Date.now() + DAY; }
    } else {
      c.ko++; c.seen = true; c.box = Math.max(0, c.box - 1); c.due = Date.now();
    }
    save();
  }
  const dueIds = () => D.phrases.filter(p => isDue(p.id)).sort((a, b) => S.cards[a.id].due - S.cards[b.id].due).map(p => p.id);
  const newIds = () => D.phrases.filter(p => isNew(p.id)).sort((a, b) => (b.video ? 1 : 0) - (a.video ? 1 : 0)).map(p => p.id);
  function catProgress(catId) {
    const ids = D.phrases.filter(p => p.cat === catId).map(p => p.id);
    const pts = ids.reduce((s, id) => s + Math.min(S.cards[id]?.box || 0, MASTER_BOX), 0);
    return { total: ids.length, pct: Math.round(pts / (ids.length * MASTER_BOX) * 100), due: ids.filter(isDue).length, ids };
  }

  // ── Audio: MP3 zuerst, sonst Sprachausgabe des Handys ────────────────────
  let currentAudio = null;
  let playingBtn = null;
  function setPlaying(btn, on) {
    if (playingBtn && playingBtn !== btn) playingBtn.classList.remove('playing');
    playingBtn = on ? btn : null;
    btn?.classList.toggle('playing', on);
  }
  function stopAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setPlaying(null, false);
  }
  function jaVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
    return vs.find(v => /google/i.test(v.name)) || vs[0] || null;
  }
  if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }

  function play(id, btn) {
    stopAudio(); PL.pause();
    const p = P[id];
    if (!p) return;
    setPlaying(btn, true);
    if (S.settings.audio !== 'mp3') return speak(p, btn);
    const a = new Audio(`audio/${id}.mp3`);
    currentAudio = a;
    let fellBack = false;
    const fallback = () => { if (fellBack || currentAudio !== a) return; fellBack = true; currentAudio = null; speak(p, btn); };
    a.onended = () => { if (currentAudio === a) setPlaying(btn, false); };
    a.onerror = fallback;
    a.play().catch(err => { if (err.name !== 'AbortError') fallback(); });
  }
  function speak(p, btn) {
    if (!('speechSynthesis' in window)) { setPlaying(btn, false); toast('Keine Sprachausgabe auf diesem Gerät'); return; }
    const u = new SpeechSynthesisUtterance(p.tts || p.jp);
    u.lang = 'ja-JP'; u.rate = .9;
    const v = jaVoice(); if (v) u.voice = v;
    u.onend = u.onerror = () => setPlaying(btn, false);
    speechSynthesis.speak(u);
  }

  // ── Playlist: Deutsch → Pause → Japanisch → Pause ────────────────────────
  // Ein einziges Audio-Element, Pausen als stille MP3s statt Timer: so läuft die
  // Playlist auch bei gesperrtem Bildschirm weiter (Timer werden dort gedrosselt).
  const PL = {
    audio: null, order: [], idx: 0, step: 0, playing: false, mediaReady: false,
    STEPS: ['de', 'pause-short', 'jp', 'pause-long'],
    src(id, step) {
      return { de: `audio/de/${id}.mp3`, 'pause-short': 'audio/pause-short.mp3', jp: `audio/${id}.mp3`, 'pause-long': 'audio/pause-long.mp3' }[this.STEPS[step]];
    },
    ids() { return S.playlist.filter(id => P[id]); },
    current() { return this.order[this.idx]; },
    phase() { return this.STEPS[this.step]; },
    build(startId) {
      const ids = this.ids();
      this.order = S.settings.plShuffle ? shuffle(ids) : ids;
      if (startId && S.settings.plShuffle) this.order = [startId, ...this.order.filter(x => x !== startId)];
      this.idx = startId ? Math.max(0, this.order.indexOf(startId)) : 0;
      this.step = 0;
    },
    play(startId) {
      if (!this.ids().length) return toast('Playlist ist leer – schalte bei einer Karte 🎧 ein');
      stopAudio();
      if (startId || !this.order.length || !this.ids().includes(this.current())) this.build(startId);
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.onended = () => this.nextStep();
        this.audio.onerror = () => { if (this.playing) this.nextStep(); }; // fehlende Datei überspringen
      }
      this.playing = true;
      this.playStep();
    },
    playStep() {
      if (!this.current()) return this.stop();
      this.audio.src = this.src(this.current(), this.step);
      this.audio.play().catch(err => {
        if (err.name === 'NotAllowedError') { this.playing = false; this.ui(); } // Browser verlangt erst einen Tipp
      });
      this.media(); this.ui();
    },
    nextStep() {
      if (!this.playing) return;
      if (++this.step >= this.STEPS.length) {
        this.step = 0;
        if (++this.idx >= this.order.length) {
          if (!S.settings.plRepeat) return this.stop();
          this.build(); // Endlos: von vorn, bei Zufall neu gemischt
        }
      }
      this.playStep();
    },
    skip(delta) {
      if (!this.order.length) this.build();
      const next = this.idx + delta, n = this.order.length;
      if (S.settings.plRepeat && next >= n) this.build(); // Endlos: nach der letzten wieder von vorn
      else this.idx = S.settings.plRepeat && next < 0 ? n - 1 : Math.min(Math.max(0, next), n - 1);
      this.step = 0;
      if (this.playing) this.playStep(); else this.ui();
    },
    pause() {
      if (!this.playing) return;
      this.playing = false; this.audio?.pause(); this.ui();
    },
    stop() {
      this.playing = false; this.audio?.pause(); this.idx = 0; this.step = 0; this.order = []; this.ui();
    },
    toggle() { this.playing ? this.pause() : this.play(); },
    setShuffle(on) {
      S.settings.plShuffle = on; save();
      const cur = this.current(), step = this.step;
      if (cur) { this.build(cur); this.step = step; } // aktuelle Phrase läuft ungestört weiter
      this.ui();
    },
    remove(id) {
      S.playlist = S.playlist.filter(x => x !== id); save();
      const at = this.order.indexOf(id);
      if (at < 0) return this.ui();
      const wasCurrent = at === this.idx;
      this.order.splice(at, 1);
      if (at < this.idx) this.idx--;
      if (wasCurrent) { this.step = 0; if (this.idx >= this.order.length) this.idx = 0; if (this.playing) return this.playStep(); }
      this.ui();
    },
    media() {
      if (!('mediaSession' in navigator)) return;
      const p = P[this.current()];
      if (p) navigator.mediaSession.metadata = new MediaMetadata({
        title: p.de, artist: `${p.jp} · ${p.romaji}`, album: 'MG Nihongo · Playlist',
        artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
      navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
      if (this.mediaReady) return;
      this.mediaReady = true;
      const h = { play: () => this.play(), pause: () => this.pause(), nexttrack: () => this.skip(1), previoustrack: () => this.skip(-1) };
      for (const [k, fn] of Object.entries(h)) { try { navigator.mediaSession.setActionHandler(k, fn); } catch { /* nicht unterstützt */ } }
    },
    ui() { updatePlaylistView(); updatePlPill(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused'; },
  };
  function inPlaylist(id) { return S.playlist.includes(id); }
  function setInPlaylist(id, on) {
    if (on && !inPlaylist(id)) S.playlist.push(id);
    if (!on) return PL.remove(id);
    save(); PL.ui();
  }

  // ── Aussprache: eigene Aufnahme (ohne System-Signalton) + Offline-Bewertung ─
  const KANJI_DIGITS = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };
  function normJa(s) {
    return String(s).normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)) // Katakana → Hiragana
      .replace(/[一二三四五六七八九]/g, ch => KANJI_DIGITS[ch])
      .replace(/[\s、。！？!?,.・ー〜~「」『』（）()-]/g, '');
  }
  function lev(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function similarity(heard, p) {
    const targets = [p.jp, p.kana, p.tts, p.cat === 'numbers' ? p.de : null].filter(Boolean).map(normJa);
    const h = normJa(heard);
    if (!h) return 0;
    return Math.max(...targets.map(t => 1 - lev(h, t) / Math.max(h.length, t.length)));
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && AudioCtx);

  // Nimmt auf, bis nach dem Sprechen ~1,2 s Stille kommt (oder erneut getippt wird).
  let rec = null;
  async function record(btn) {
    const ctx = new AudioCtx();
    ctx.resume().catch(() => {});
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (err) { ctx.close().catch(() => {}); throw err; }
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m));
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const an = ctx.createAnalyser(); an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);

    return new Promise(resolve => {
      const t0 = performance.now();
      let spoke = false, signal = false, lastLoud = t0, floor = 0.01, timer = 0;
      const stop = () => {
        if (!rec) return;
        rec = null; clearInterval(timer);
        btn.style.removeProperty('--lvl');
        if (mr.state !== 'inactive') mr.stop(); else finish();
      };
      // Mikrofon sofort freigeben – iOS spielt sonst leise über die Hörmuschel weiter
      const finish = () => {
        stream.getTracks().forEach(t => t.stop());
        ctx.close().catch(() => {});
        resolve(new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' }));
      };
      mr.onstop = finish;
      const tick = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length), now = performance.now();
        if (now - t0 < 300) floor = Math.max(floor, rms * 1.5); // Grundrauschen der ersten Millisekunden
        btn.style.setProperty('--lvl', Math.min(1, rms * 10).toFixed(2));
        if (rms > 0) signal = true;
        if (rms > Math.max(0.015, floor * 2)) { spoke = true; lastLoud = now; }
        if ((spoke && now - lastLoud > 1200) || now - t0 > 8000 || (signal && !spoke && now - t0 > 5000)) stop();
      };
      rec = { stop };
      mr.start();
      timer = setInterval(tick, 50); // Timer statt requestAnimationFrame: läuft auch, wenn der Bildschirm nicht neu zeichnet
    });
  }

  function playSrc(src, btn) {
    stopAudio(); PL.pause();
    return new Promise(resolve => {
      const a = new Audio(src);
      currentAudio = a; setPlaying(btn, true);
      const done = () => { if (currentAudio === a) { currentAudio = null; setPlaying(btn, false); } resolve(); };
      a.onended = a.onerror = done;
      a.play().catch(done);
    });
  }

  // 16 kHz mono für Whisper; einfache Mittelwert-Dezimation reicht für Sprache
  async function toMono16k(blob) {
    const ctx = new AudioCtx();
    try {
      const b = await ctx.decodeAudioData(await blob.arrayBuffer());
      const ratio = b.sampleRate / 16000, n = Math.floor(b.length / ratio);
      const chans = [...Array(b.numberOfChannels)].map((_, c) => b.getChannelData(c));
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const s = Math.floor(i * ratio), e = Math.max(s + 1, Math.floor((i + 1) * ratio));
        let sum = 0;
        for (const ch of chans) for (let j = s; j < e; j++) sum += ch[j];
        out[i] = sum / ((e - s) * chans.length);
      }
      return out;
    } finally { ctx.close().catch(() => {}); }
  }

  // Whisper läuft in einem Worker, das Modell wird nur auf Wunsch geladen
  const ASR = {
    worker: null, loading: null, seq: 0, pending: new Map(), files: {}, onProgress: null,
    ensure() {
      if (this.loading) return this.loading;
      this.worker = new Worker('whisper-worker.js', { type: 'module' });
      this.loading = new Promise((res, rej) => {
        this.worker.onmessage = e => {
          const m = e.data;
          if (m.type === 'progress') {
            this.files[m.file] = m;
            const all = Object.values(this.files);
            const pct = all.reduce((s, f) => s + (f.loaded || 0), 0) / Math.max(1, all.reduce((s, f) => s + (f.total || 0), 0));
            this.onProgress?.(pct);
          } else if (m.type === 'ready') res();
          else if (m.type === 'result') { this.pending.get(m.id)?.res(m); this.pending.delete(m.id); }
          else if (m.type === 'error') {
            if (m.id && this.pending.has(m.id)) { this.pending.get(m.id).rej(new Error(m.message)); this.pending.delete(m.id); }
            else { rej(new Error(m.message)); this.reset(); }
          }
        };
        this.worker.onerror = e => { rej(new Error(e.message || 'Worker-Fehler')); this.reset(); };
      });
      this.worker.postMessage({ type: 'load' });
      return this.loading;
    },
    async transcribe(audio) {
      await this.ensure();
      const id = ++this.seq;
      return new Promise((res, rej) => {
        this.pending.set(id, { res, rej });
        this.worker.postMessage({ type: 'transcribe', id, audio }, [audio.buffer]);
      });
    },
    reset() { this.worker?.terminate(); this.worker = null; this.loading = null; this.files = {}; },
  };

  // Online-Modus: Spracherkennung des Browsers (Google bzw. Siri) – schnell, braucht Internet
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let activeRec = null;
  function listenOnline(id, btn, out) {
    if (activeRec) { activeRec.abort(); activeRec = null; return; }
    stopAudio(); PL.pause();
    const p = P[id];
    const r = new SR();
    // interimResults: Safari liefert oft kein Endergebnis, dann wird das letzte Zwischenergebnis bewertet
    r.lang = 'ja-JP'; r.maxAlternatives = 5; r.interimResults = true; r.continuous = false;
    activeRec = r;
    btn.classList.add('listening');
    out.innerHTML = `<div class="speak-result ok">🎤 Ich höre zu … sprich jetzt: <b>${esc(p.romaji)}</b></div>`;
    let alts = [], judged = false;
    const judge = () => {
      if (judged || !alts.length) return;
      judged = true;
      let best = { t: alts[0], s: 0 };
      for (const t of alts) { const s = similarity(t, p); if (s > best.s) best = { t, s }; }
      const pct = Math.round(best.s * 100);
      let cls = 'bad', msg = 'Nochmal versuchen – hör dir das Audio an und sprich langsam.';
      if (best.s >= .8) { cls = 'good'; msg = 'Perfekt! すばらしい！ +15 ⭐'; addXP(15); }
      else if (best.s >= .55) { cls = 'ok'; msg = 'Fast! Noch etwas deutlicher. +5 ⭐'; addXP(5); }
      out.innerHTML = `<div class="speak-result ${cls}">${msg}<br><span class="small">Verstanden: „<span lang="ja">${esc(best.t)}</span>“ · ${pct} % Übereinstimmung</span></div>`;
    };
    r.onresult = e => {
      const res = e.results[e.results.length - 1];
      alts = [...res].map(a => a.transcript).filter(Boolean);
      if (res.isFinal) { judge(); try { r.stop(); } catch { /* schon beendet */ } }
    };
    r.onerror = e => {
      if (e.error === 'aborted') return;
      judged = true;
      const m = {
        'not-allowed': 'Mikrofon ist blockiert – bitte in den Browser-Einstellungen erlauben (iPhone zusätzlich: Siri & Diktierfunktion aktivieren).',
        'service-not-allowed': 'Spracherkennung ist deaktiviert – iPhone: Einstellungen → Allgemein → Tastatur → Diktierfunktion einschalten.',
        'no-speech': 'Nichts gehört. Tippe auf 🎤 und sprich direkt los.',
        'network': 'Keine Verbindung zur Spracherkennung. Ohne Internet auf der Startseite ✈️ Offline wählen.',
      }[e.error] || `Fehler bei der Spracherkennung (${e.error}).`;
      out.innerHTML = `<div class="speak-result bad">${m}</div>`;
    };
    r.onend = () => {
      btn.classList.remove('listening');
      if (activeRec === r) activeRec = null;
      if (!judged) {
        if (alts.length) judge();
        else out.innerHTML = `<div class="speak-result bad">Nichts verstanden. Tippe auf 🎤 und sprich direkt los.</div>`;
      }
    };
    try { r.start(); } catch { btn.classList.remove('listening'); activeRec = null; }
  }

  // Mikrofon-Knopf: online → Browser-Spracherkennung, offline (oder kein Netz) → eigene Aufnahme + Whisper
  function onMic(id, btn, out) {
    const online = S.settings.mode !== 'offline' && navigator.onLine !== false;
    if (online && SR && !rec) return listenOnline(id, btn, out);
    return recordAndCompare(id, btn, out);
  }

  async function recordAndCompare(id, btn, out) {
    if (rec) return rec.stop();
    if (!canRecord) {
      out.innerHTML = `<div class="speak-result bad">🎤 Aufnahme wird von diesem Browser nicht unterstützt.</div>`;
      return;
    }
    const p = P[id];
    stopAudio(); PL.pause();
    btn.classList.add('recording'); btn.textContent = '⏹';
    out.innerHTML = `<div class="speak-result ok">🎙️ Sprich jetzt: <b>${esc(p.romaji)}</b><br><span class="small">Stoppt automatisch, wenn du fertig bist – oder tippe ⏹.</span></div>`;
    let blob;
    try { blob = await record(btn); }
    catch (err) {
      const denied = err?.name === 'NotAllowedError';
      out.innerHTML = `<div class="speak-result bad">${denied
        ? '🎤 Kein Mikrofon-Zugriff. iPhone: Einstellungen → Safari → Mikrofon → „Erlauben“. Android: Schloss-Symbol neben der Adresse → Mikrofon.'
        : `🎤 Mikrofon konnte nicht gestartet werden (${esc(err?.message || err)}).`}</div>`;
      return;
    } finally { btn.classList.remove('recording'); btn.textContent = '🎤'; }
    if (blob.size < 800) { out.innerHTML = `<div class="speak-result bad">Nichts aufgenommen – tippe 🎤 und sprich direkt los.</div>`; return; }

    const url = URL.createObjectURL(blob);
    out.innerHTML = `<div class="speak-result ok">
        <div class="rec-actions">
          <button class="btn secondary" data-mine>▶️ Ich</button>
          <button class="btn secondary" data-compare>🔁 Profi → Ich</button>
        </div>
        <div class="asr small"></div></div>`;
    const box = out.firstElementChild, asrEl = box.querySelector('.asr');
    box.querySelector('[data-mine]').addEventListener('click', e => playSrc(url, e.currentTarget));
    box.querySelector('[data-compare]').addEventListener('click', async e => {
      const b = e.currentTarget;
      await playSrc(`audio/${id}.mp3`, b);
      await new Promise(r => setTimeout(r, 350));
      if (out.contains(b)) playSrc(url, b);
    });

    const offlineMode = S.settings.mode === 'offline' || navigator.onLine === false;
    if (!S.settings.asr || !offlineMode) {
      asrEl.innerHTML = !S.settings.asr
        ? '💡 Für automatische Bewertung ohne Internet: auf der Startseite ✈️ Offline wählen und die Offline-Bewertung laden.'
        : '💡 Automatische Bewertung: in diesem Browser nur im ✈️ Offline-Modus.';
      return;
    }
    asrEl.innerHTML = ASR.loading ? '⏳ Werte aus …' : '⏳ Bewertung wird vorbereitet (einmal pro Start) …';
    try {
      const { text } = await ASR.transcribe(await toMono16k(blob));
      if (!out.contains(box)) return;
      const s = similarity(text, p), pct = Math.round(s * 100);
      let cls = 'bad', msg = 'Nochmal versuchen – hör dir die Profi-Stimme an und sprich langsam.';
      if (s >= .8) { cls = 'good'; msg = 'Perfekt! すばらしい！ +15 ⭐'; addXP(15); }
      else if (s >= .55) { cls = 'ok'; msg = 'Fast! Noch etwas deutlicher. +5 ⭐'; addXP(5); }
      box.className = `speak-result ${cls}`;
      asrEl.innerHTML = `<b>${msg}</b><br>Verstanden: „<span lang="ja">${esc(text || '–')}</span>“ · ${pct} % Übereinstimmung`;
    } catch (err) {
      asrEl.textContent = `⚠️ Bewertung fehlgeschlagen: ${err.message}`;
    }
  }

  // ── Darstellung einer Phrase (Ebenen einzeln schaltbar) ──────────────────
  function phraseHTML(p, { compact = false, hide = [], all = false } = {}) {
    const s = all ? { jp: true, kana: true, romaji: true, de: true } : S.settings;
    const showRomaji = s.romaji || (!s.jp && !s.kana);
    let h = `<div class="phrase${compact ? ' compact' : ''}">`;
    if (s.jp && !hide.includes('jp')) h += `<div class="jp" lang="ja">${esc(p.jp)}</div>`;
    if (s.kana && p.kana !== p.jp && !hide.includes('kana')) h += `<div class="kana" lang="ja">${esc(p.kana)}</div>`;
    if (showRomaji && !hide.includes('romaji')) h += `<div class="romaji">${esc(p.romaji)}</div>`;
    if (s.de && !hide.includes('de')) h += `<div class="de">${esc(p.de)}</div>`;
    return h + '</div>';
  }
  const deOnly = p => `<div class="phrase compact"><div class="de">${esc(p.de)}</div></div>`;
  const catTag = p => `<span class="tag">${CAT[p.cat].emoji} ${esc(CAT[p.cat].name)}</span>`;
  const videoTag = p => p.video ? '<span class="tag video">▶ aus dem Video</span>' : '';
  const tipHTML = p => p.tip ? `<div class="tip">💡 ${esc(p.tip)}</div>` : '';
  const progressTop = (done, total) =>
    `<div class="progress-top"><button class="close-x" data-act="close" aria-label="Beenden">✕</button>
      <div class="bar"><i style="width:${Math.round(done / Math.max(total, 1) * 100)}%"></i></div>
      <b class="small">${done}/${total}</b></div>`;

  function bindCommon(root = $view) {
    root.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); play(b.dataset.play, b); }));
    root.querySelectorAll('[data-act="close"]').forEach(b => b.addEventListener('click', () => { sess = null; stopAudio(); render(); }));
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  const TABS = ['home', 'cards', 'quiz', 'dialogs', 'travel'];
  let tab = 'home';
  let sess = null; // laufende Übung
  function go(t) { if (location.hash !== '#' + t) location.hash = t; else { sess = null; render(); } }
  window.addEventListener('hashchange', () => { sess = null; stopAudio(); closeShow(); render(); });
  document.getElementById('tabbar').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]'); if (b) go(b.dataset.tab);
  });
  function render() {
    const h = location.hash.slice(1);
    tab = TABS.includes(h) ? h : 'home';
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    updateChips();
    ({ home: renderHome, cards: renderCardsMenu, quiz: renderQuizMenu, dialogs: renderDialogMenu, travel: renderTravel })[tab]();
    if (tab === 'cards' && openPlaylistNext) renderPlaylist();
    openPlaylistNext = false;
    updatePlPill();
    window.scrollTo(0, 0);
  }

  // ── Start ────────────────────────────────────────────────────────────────
  function renderHome() {
    const due = dueIds(), fresh = newIds();
    const seen = D.phrases.filter(p => !isNew(p.id)).length;
    const master = D.phrases.filter(p => mastered(p.id)).length;
    const goalPct = Math.min(100, Math.round(todayXP() / S.settings.goal * 100));
    const lvl = Math.floor(S.xp / LEVEL_XP) + 1, lvlPct = Math.round((S.xp % LEVEL_XP) / LEVEL_XP * 100);
    let cta, ctaText;
    if (due.length) { cta = 'due'; ctaText = `🔁 ${due.length} wiederholen`; }
    else if (fresh.length) { cta = 'new'; ctaText = '✨ Neue Phrasen lernen'; }
    else { cta = 'quiz'; ctaText = '🎯 Quiz spielen'; }

    $view.innerHTML = `
      <div class="hero">
        <div class="ring" style="--p:${goalPct}"><div><span><b>${todayXP()}</b>/${S.settings.goal} ⭐</span></div></div>
        <div>
          <h1>こんにちは! 👋</h1>
          <p>${due.length ? `${due.length} Karten warten auf dich.` : fresh.length ? `${fresh.length} neue Phrasen zu entdecken.` : 'Alles gelernt – weiter so!'}</p>
          <button class="btn" data-cta="${cta}">${ctaText}</button>
        </div>
      </div>
      <div class="mode-switch">
        <div class="row-top"><b>🎤 Aussprache</b><div class="seg">
          <button data-mode="online" class="${S.settings.mode !== 'offline' ? 'on' : ''}">📶 Online</button>
          <button data-mode="offline" class="${S.settings.mode === 'offline' ? 'on' : ''}">✈️ Offline</button></div></div>
        <div id="mode-desc">${modeDesc()}</div>
      </div>
      <div class="stats">
        <div class="stat"><b>🔥 ${streakDays()}</b><span>Tage in Folge</span></div>
        <div class="stat"><b>🧠 ${seen}</b><span>von ${D.phrases.length} gesehen</span></div>
        <div class="stat"><b>🏆 ${master}</b><span>gemeistert</span></div>
      </div>
      <div class="level"><div style="display:flex;justify-content:space-between"><b>Level ${lvl}</b><span class="small muted">${S.xp % LEVEL_XP}/${LEVEL_XP} ⭐</span></div>
        <div class="bar"><i style="width:${lvlPct}%"></i></div></div>
      <h2 class="section-title">Kategorien</h2>
      <div class="cat-grid">${D.categories.map(catTile).join('')}</div>
      <p class="small muted" style="text-align:center;margin-top:24px">Phrasen mit ▶ stammen aus dem Video<br>„20 Japanisch Vokabeln für deine Japanreise!“ (WanderWeib Japan)</p>`;
    $view.querySelector('[data-cta]').addEventListener('click', e => {
      const c = e.currentTarget.dataset.cta;
      if (c === 'due') startCards(due.slice(0, 30), 'Wiederholung');
      else if (c === 'new') startCards(fresh.slice(0, 10), 'Neue Phrasen');
      else go('quiz');
    });
    $view.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    updateModeDesc();
    bindCatTiles();
  }

  // ── Online/Offline-Modus der Aussprache-Bewertung ────────────────────────
  function modeDesc(pct) {
    const s = S.settings;
    if (s.mode !== 'offline') {
      return `<div class="desc">Bewertung per Google/Siri-Spracherkennung – schnell, braucht Internet.</div>`;
    }
    if (asrDownloading) {
      return `<div class="desc">Offline-Bewertung wird geladen … ${pct != null ? Math.round(pct * 100) + ' %' : ''} – App offen lassen</div>
        <div class="bar"><i style="width:${Math.round((pct || 0) * 100)}%"></i></div>`;
    }
    return s.asr
      ? `<div class="desc">Bewertung direkt auf dem Handy (Whisper) – ohne Internet, dauert einige Sekunden.</div>`
      : `<div class="desc">⚠️ Offline-Bewertung nicht geladen – nur Aufnehmen &amp; Vergleichen. <a href="#" id="mode-dl">Jetzt laden (~80 MB)</a></div>`;
  }
  function updateModeDesc(pct) {
    const el = document.getElementById('mode-desc');
    if (!el) return;
    el.innerHTML = modeDesc(pct);
    el.querySelector('#mode-dl')?.addEventListener('click', e => { e.preventDefault(); downloadAsr(); });
  }
  function setMode(mode) {
    const s = S.settings;
    if (s.mode === mode) return;
    s.mode = mode; save();
    $view.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    if (mode === 'offline') {
      if (s.asr) ASR.ensure().catch(() => {}); // Modell vorab in den Speicher laden
      else if (!asrDownloading && confirm('Für den Offline-Modus wird einmalig die Offline-Bewertung geladen (~80 MB, WLAN empfohlen). Jetzt laden?')) downloadAsr();
    } else {
      ASR.reset(); // Speicher freigeben – online wird Whisper nicht gebraucht
    }
    updateModeDesc();
    toast(mode === 'offline' ? '✈️ Offline-Modus' : '📶 Online-Modus');
  }
  function catTile(c) {
    const pr = catProgress(c.id);
    const parked = pr.ids.filter(isParked).length;
    return `<button class="cat-tile" style="--c:${c.color}" data-cat="${c.id}">
      ${pr.due ? `<span class="badge">${pr.due} fällig</span>` : ''}
      <span class="emoji">${c.emoji}</span><span class="name">${esc(c.name)}</span>
      <span class="meta">${pr.total} Phrasen${parked ? ` · 🅿️ ${parked}` : ''} · ${pr.pct} %<div class="bar"><i style="width:${pr.pct}%"></i></div></span>
    </button>`;
  }
  function bindCatTiles() {
    $view.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
      const pr = catProgress(b.dataset.cat);
      const ids = pr.ids.filter(id => !isParked(id));
      if (!ids.length) return toast('Alle Phrasen dieser Kategorie sind geparkt 🅿️');
      const order = id => isDue(id) ? 0 : isNew(id) ? 1 : 2;
      startCards(ids.sort((a, b) => order(a) - order(b)), CAT[b.dataset.cat].name);
    }));
  }

  // ── Karteikarten ─────────────────────────────────────────────────────────
  function renderCardsMenu() {
    const due = dueIds(), fresh = newIds();
    const dirs = [['de-jp', '🇩🇪 → 🇯🇵'], ['jp-de', '🇯🇵 → 🇩🇪'], ['mix', '🔀 Gemischt']];
    $view.innerHTML = `
      <h2 class="section-title">🃏 Karteikarten</h2>
      <div class="setting"><label>Richtung</label><div class="seg" id="dir">${dirs.map(([k, l]) =>
        `<button data-dir="${k}" class="${S.settings.dir === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="mode-list" style="margin-top:12px">
        <button class="mode" data-start="due" style="--c:#FFE3E3"><span class="ico">🔁</span><div><b>Fällige wiederholen</b><span>${due.length ? `${due.length} Karten sind dran` : 'Gerade nichts fällig 🎉'}</span></div></button>
        <button class="mode" data-start="new" style="--c:#E6F4FF"><span class="ico">✨</span><div><b>Neue lernen</b><span>${fresh.length ? `Die nächsten ${Math.min(10, fresh.length)} von ${fresh.length} neuen Phrasen` : 'Alle Phrasen gesehen'}</span></div></button>
        <button class="mode" data-start="video" style="--c:#FFF1CC"><span class="ico">▶️</span><div><b>Nur die Video-Phrasen</b><span>Die ${D.phrases.filter(p => p.video && !isParked(p.id)).length} Phrasen aus Tessas Video</span></div></button>
        <button class="mode" data-start="playlist" style="--c:#D9F2EF"><span class="ico">🎧</span><div><b>Playlist</b><span>${PL.ids().length ? `${PL.ids().length} Phrasen · Deutsch → Japanisch vorlesen` : 'Leer – bei einer Karte 🎧 einschalten'}</span></div></button>
        <button class="mode" data-start="parked" style="--c:#DDE3EC"><span class="ico">🅿️</span><div><b>Geparkt</b><span>${parkedIds().length ? `${parkedIds().length} Phrasen für später – ansehen &amp; zurückholen` : 'Nichts geparkt'}</span></div></button>
      </div>
      <h2 class="section-title">Nach Kategorie</h2>
      <div class="cat-grid">${D.categories.map(catTile).join('')}</div>`;
    $view.querySelectorAll('[data-dir]').forEach(b => b.addEventListener('click', () => {
      S.settings.dir = b.dataset.dir; save(); renderCardsMenu();
    }));
    $view.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.start;
      if (k === 'due') { if (!due.length) return toast('Nichts fällig – lern neue Phrasen! ✨'); startCards(due.slice(0, 30), 'Wiederholung'); }
      if (k === 'new') { if (!fresh.length) return toast('Du hast alle Phrasen gesehen 🎉'); startCards(fresh.slice(0, 10), 'Neue Phrasen'); }
      if (k === 'video') startCards(shuffle(D.phrases.filter(p => p.video && !isParked(p.id)).map(p => p.id)), 'Video-Phrasen');
      if (k === 'parked') { if (!parkedIds().length) return toast('Nichts geparkt – tippe beim Lernen auf 🅿️ Parken'); renderParked(); }
      if (k === 'playlist') { if (!PL.ids().length) return toast('Playlist ist leer – schalte beim Lernen auf der Rückseite einer Karte 🎧 ein'); renderPlaylist(); }
    }));
    bindCatTiles();
  }

  // Playlist-Ansicht: Steuerung, aktuelle Phrase, Liste
  function renderPlaylist() {
    const s = S.settings;
    $view.innerHTML = `<div id="pl-view">
      <div class="progress-top"><button class="close-x" id="pl-back" aria-label="Zurück">←</button>
        <h2 class="section-title" style="margin:0;flex:1">🎧 Playlist (<span id="pl-count"></span>)</h2></div>
      <div class="card pl-now" id="pl-now"></div>
      <div class="pl-controls">
        <button class="pl-btn ${s.plShuffle ? 'on' : ''}" id="pl-shuffle" aria-label="Zufällig"><span>🔀</span><small>Zufällig</small></button>
        <button class="pl-btn" id="pl-prev" aria-label="Zurück"><span>⏮</span></button>
        <button class="round-btn big" id="pl-toggle" aria-label="Abspielen">▶️</button>
        <button class="pl-btn" id="pl-next" aria-label="Weiter"><span>⏭</span></button>
        <button class="pl-btn ${s.plRepeat ? 'on' : ''}" id="pl-repeat" aria-label="Endlos"><span>🔁</span><small>Endlos</small></button>
      </div>
      <div class="list" id="pl-list"></div>
      <button class="btn secondary block" id="pl-clear" style="margin-top:14px">🗑️ Playlist leeren</button>
    </div>`;
    document.getElementById('pl-back').addEventListener('click', renderCardsMenu);
    document.getElementById('pl-toggle').addEventListener('click', () => PL.toggle());
    document.getElementById('pl-prev').addEventListener('click', () => PL.skip(-1));
    document.getElementById('pl-next').addEventListener('click', () => PL.skip(1));
    document.getElementById('pl-shuffle').addEventListener('click', e => {
      PL.setShuffle(!S.settings.plShuffle); e.currentTarget.classList.toggle('on', S.settings.plShuffle);
      toast(S.settings.plShuffle ? '🔀 Zufällig an' : '🔀 Zufällig aus');
    });
    document.getElementById('pl-repeat').addEventListener('click', e => {
      S.settings.plRepeat = !S.settings.plRepeat; save(); e.currentTarget.classList.toggle('on', S.settings.plRepeat);
      toast(S.settings.plRepeat ? '🔁 Endlos an' : '🔁 Endlos aus');
    });
    document.getElementById('pl-clear').addEventListener('click', () => {
      if (!confirm('Alle Phrasen aus der Playlist entfernen?')) return;
      PL.stop(); S.playlist = []; save(); renderCardsMenu();
    });
    document.getElementById('pl-list').addEventListener('click', e => {
      const rm = e.target.closest('[data-pl-rm]');
      if (rm) { e.stopPropagation(); PL.remove(rm.dataset.plRm); if (!PL.ids().length) renderCardsMenu(); return; }
      const item = e.target.closest('[data-pl-id]');
      if (item) PL.play(item.dataset.plId);
    });
    updatePlaylistView(); updatePlPill();
  }
  function updatePlaylistView() {
    const view = document.getElementById('pl-view');
    if (!view) return;
    const ids = PL.ids(), cur = PL.current(), p = P[cur];
    document.getElementById('pl-count').textContent = ids.length;
    const tgl = document.getElementById('pl-toggle');
    tgl.textContent = PL.playing ? '⏸' : '▶️';
    tgl.classList.toggle('playing', PL.playing);
    const phase = PL.phase();
    document.getElementById('pl-now').innerHTML = p
      ? `<div class="pl-steps"><span class="${phase === 'de' ? 'on' : ''}">🇩🇪 Deutsch</span><span>→</span><span class="${phase === 'jp' ? 'on' : ''}">🇯🇵 Japanisch</span><span class="${phase === 'pause-long' ? 'on' : ''}">🗣️ Nachsprechen</span></div>
         <div class="de" style="font-size:1.25rem;font-weight:800;margin:10px 0 6px">${esc(p.de)}</div>
         ${phraseHTML(p, { hide: ['de'] })}
         <div class="small muted" style="margin-top:8px">${PL.idx + 1} / ${PL.order.length}</div>`
      : `<div class="empty" style="padding:14px"><div class="big">🎧</div>Tippe ▶️ – jede Phrase kommt erst auf Deutsch, dann auf Japanisch, danach bleibt kurz Zeit zum Nachsprechen.</div>`;
    // Liste nur neu aufbauen, wenn sich ihr Inhalt ändert – sonst gehen Tipps während der Wiedergabe verloren
    const list = document.getElementById('pl-list'), sig = ids.join(',');
    if (list.dataset.sig !== sig) {
      list.dataset.sig = sig;
      list.innerHTML = ids.map(id => {
        const x = P[id];
        return `<div class="list-item pl-item" style="--c:${CAT[x.cat].color}" data-pl-id="${id}" role="button" tabindex="0">
          ${phraseHTML(x, { compact: true, all: true, hide: ['kana'] })}
          <button class="mini-play" data-pl-rm="${id}" aria-label="Entfernen">✕</button></div>`;
      }).join('');
    }
    list.querySelectorAll('.pl-item').forEach(el => el.classList.toggle('current', el.dataset.plId === cur));
  }
  // Kleine Steuerleiste, wenn die Playlist läuft, du aber woanders in der App bist
  let openPlaylistNext = false;
  function updatePlPill() {
    let pill = document.getElementById('pl-pill');
    const show = PL.order.length && PL.current() && !document.getElementById('pl-view');
    document.body.classList.toggle('has-pill', !!show);
    if (!show) { pill?.remove(); return; }
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'pl-pill'; pill.className = 'pl-pill';
      // Seitlich wegwischen → Leiste verschwindet und die Playlist stoppt
      let startX = null, dx = 0, dragging = false, t0 = 0, justSwiped = false;
      pill.addEventListener('pointerdown', e => {
        startX = e.clientX; dx = 0; dragging = false; t0 = performance.now();
        pill.style.transition = 'none';
      });
      pill.addEventListener('pointermove', e => {
        if (startX === null) return;
        dx = e.clientX - startX;
        if (Math.abs(dx) > 8) dragging = true;
        if (dragging) {
          pill.style.transform = `translateX(${dx}px)`;
          pill.style.opacity = String(Math.max(0.15, 1 - Math.abs(dx) / pill.offsetWidth));
        }
      });
      const endDrag = () => {
        if (startX === null) return;
        const speed = Math.abs(dx) / Math.max(1, performance.now() - t0); // px pro ms
        startX = null;
        pill.style.transition = 'transform .2s ease-out, opacity .2s ease-out';
        if (!dragging) return;
        justSwiped = true; // den folgenden Klick nicht als Tipp werten
        if (Math.abs(dx) > pill.offsetWidth * 0.35 || speed > 0.6) {
          pill.style.transform = `translateX(${dx > 0 ? 110 : -110}%)`;
          pill.style.opacity = '0';
          setTimeout(() => PL.stop(), 200); // stop() blendet die Leiste endgültig aus
        } else {
          pill.style.transform = ''; pill.style.opacity = '';
        }
      };
      pill.addEventListener('pointerup', endDrag);
      pill.addEventListener('pointercancel', endDrag);
      pill.addEventListener('click', e => {
        if (justSwiped) { justSwiped = false; return; }
        if (e.target.closest('[data-pill-toggle]')) return PL.toggle();
        if (location.hash !== '#cards') { openPlaylistNext = true; location.hash = 'cards'; } // render() öffnet sie
        else { sess = null; stopAudio(); renderPlaylist(); }
      });
      document.body.appendChild(pill);
    }
    const p = P[PL.current()];
    pill.innerHTML = `<span class="pl-pill-text">🎧 ${esc(p.de)}</span><button data-pill-toggle aria-label="Abspielen/Pause">${PL.playing ? '⏸' : '▶️'}</button>`;
  }

  // Übersicht der geparkten Phrasen: einzeln oder alle zurückholen
  function renderParked() {
    const ids = parkedIds();
    if (!ids.length) { toast('Alle zurückgeholt ✅'); return renderCardsMenu(); }
    $view.innerHTML = `
      <div class="progress-top"><button class="close-x" id="pk-back" aria-label="Zurück">←</button><h2 class="section-title" style="margin:0;flex:1">🅿️ Geparkt (${ids.length})</h2></div>
      <p class="small muted" style="margin-top:0">Diese Phrasen kommen nicht in Karten und Quiz, bis du sie zurückholst. Dialoge und Reise-Modus zeigen sie weiterhin.</p>
      <button class="btn secondary block" id="pk-all" style="margin-bottom:12px">↩️ Alle zurückholen</button>
      <div class="list">${ids.map(id => { const p = P[id]; return `<div class="list-item" style="--c:${CAT[p.cat].color}">
        ${phraseHTML(p, { compact: true, all: true, hide: ['kana'] })}
        <button class="mini-play" data-play="${id}" aria-label="Anhören">🔊</button>
        <button class="mini-play" data-unpark="${id}" aria-label="Zurückholen" title="Zurückholen">↩️</button></div>`; }).join('')}</div>`;
    bindCommon();
    document.getElementById('pk-back').addEventListener('click', renderCardsMenu);
    document.getElementById('pk-all').addEventListener('click', () => {
      if (!confirm(`Alle ${ids.length} geparkten Phrasen zurückholen?`)) return;
      ids.forEach(id => { S.cards[id].parked = false; }); save(); renderParked();
    });
    $view.querySelectorAll('[data-unpark]').forEach(b => b.addEventListener('click', () => {
      setParked(b.dataset.unpark, false); toast('↩️ Zurückgeholt'); renderParked();
    }));
  }

  function startCards(ids, title) {
    if (!ids.length) return toast('Keine Karten gefunden');
    sess = { type: 'cards', title, queue: [...ids], total: ids.length, done: 0, xp: 0, stats: { again: 0, hard: 0, good: 0, park: 0 } };
    // Offline: Whisper schon beim Start der Runde in den Speicher laden, damit die erste Bewertung nicht wartet
    if (S.settings.mode === 'offline' && S.settings.asr) ASR.ensure().catch(() => {});
    renderCard();
  }
  function renderCard() {
    const id = sess.queue[0];
    if (!id) {
      const { good, hard, again, park } = sess.stats;
      return renderResult({
        emoji: again === 0 ? '🏆' : '💪', title: `${sess.title} geschafft!`,
        lines: [`😎 ${good} gewusst · 🔁 ${hard} bald nochmal · 😵 ${again}× nochmal${park ? ` · 🅿️ ${park} geparkt` : ''}`],
        xp: sess.xp, again: () => go('cards'), againText: '🃏 Weitere Karten',
      });
    }
    const p = P[id], c = CAT[p.cat];
    const dir = S.settings.dir === 'mix' ? pick(['de-jp', 'jp-de']) : S.settings.dir;
    const front = dir === 'de-jp'
      ? `<div class="q-label" style="margin-top:18px">Wie sagt man auf Japanisch?</div><div class="question">${esc(p.de)}</div>`
      : `<div class="q-label" style="margin-top:18px">Was bedeutet das?</div>${phraseHTML(p, { hide: ['de'] })}
         <div class="actions right"><button class="round-btn" data-play="${id}" aria-label="Anhören">🔊</button></div>`;
    $view.innerHTML = `${progressTop(sess.done, sess.total)}
      <div class="flash" id="flash"><div class="flash-inner" id="flash-inner">
        <div class="face front" style="--c:${c.color}">
          ${catTag(p)}${front}
          <div class="hint">👆 Tippen zum Umdrehen</div>
        </div>
        <div class="face back">
          <div class="top">${catTag(p)}${videoTag(p)}</div>
          ${phraseHTML(p)}
          <div style="margin-top:12px">${tipHTML(p)}</div>
          <label class="pl-toggle"><span>🎧 In Playlist</span>
            <input type="checkbox" class="switch" id="pl-sw" ${inPlaylist(id) ? 'checked' : ''}></label>
          <div class="actions right"><span class="small muted">${S.settings.mode === 'offline' ? 'Anhören, aufnehmen &amp; vergleichen' : 'Anhören &amp; nachsprechen'}</span>
            <button class="round-btn" data-play="${id}" aria-label="Anhören">🔊</button>
            <button class="round-btn mic" id="mic" aria-label="Nachsprechen">🎤</button></div>
          <div id="speak-out" style="margin-top:10px"></div>
        </div>
      </div></div>
      <div class="rate" id="rate" hidden>
        <button class="btn park" data-park>🅿️<small>Parken</small></button>
        <button class="btn bad" data-grade="again">😵<small>Nochmal</small></button>
        <button class="btn warn" data-grade="hard">🔁<small>Bald nochmal</small></button>
        <button class="btn good" data-grade="good">😎<small>Gewusst</small></button>
      </div>`;
    bindCommon();
    const flash = document.getElementById('flash'), inner = document.getElementById('flash-inner');
    const fitHeight = () => { inner.style.height = Math.max(340, ...[...inner.children].map(f => f.scrollHeight)) + 'px'; };
    fitHeight();
    const out = document.getElementById('speak-out');
    new ResizeObserver(fitHeight).observe(out);
    flash.querySelector('.front').addEventListener('click', () => {
      flash.classList.add('flipped');
      document.getElementById('rate').hidden = false;
      if (S.settings.autoplay) play(id, flash.querySelector('.back [data-play]'));
    });
    document.getElementById('mic').addEventListener('click', e => onMic(id, e.currentTarget, out));
    document.getElementById('pl-sw').addEventListener('change', e => {
      setInPlaylist(id, e.target.checked);
      toast(e.target.checked ? `🎧 Zur Playlist hinzugefügt (${S.playlist.length})` : '🎧 Aus der Playlist entfernt');
    });
    $view.querySelectorAll('[data-grade]').forEach(b => b.addEventListener('click', () => {
      const g = b.dataset.grade;
      rateCard(id, g); sess.stats[g]++;
      const xp = { again: 2, hard: 5, good: 10 }[g]; sess.xp += xp; addXP(xp);
      sess.queue.shift();
      if (g === 'again') sess.queue.splice(Math.min(3, sess.queue.length), 0, id);
      else sess.done++;
      stopAudio(); renderCard();
    }));
    $view.querySelector('[data-park]').addEventListener('click', () => {
      setParked(id, true); sess.stats.park++;
      sess.queue = sess.queue.filter(x => x !== id); // auch eine per „Nochmal“ eingereihte Wiederholung entfernen
      sess.done++;
      toast('🅿️ Geparkt – zurückholen unter Karten → Geparkt');
      stopAudio(); renderCard();
    });
    if (dir === 'jp-de' && S.settings.autoplay) play(id, flash.querySelector('.front [data-play]'));
  }

  function renderResult({ emoji, title, lines, xp, again, againText }) {
    sess = null;
    $view.innerHTML = `<div class="card result">
      <div class="big">${emoji}</div><h2>${esc(title)}</h2>
      ${lines.map(l => `<p>${l}</p>`).join('')}
      <p style="font-size:1.3rem;font-weight:800">+${xp} ⭐</p>
      <div class="row" style="margin-top:16px"><button class="btn secondary" id="r-home">🏠 Start</button><button class="btn" id="r-again">${againText}</button></div>
    </div>`;
    confetti();
    document.getElementById('r-home').addEventListener('click', () => go('home'));
    document.getElementById('r-again').addEventListener('click', again);
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────
  let quizCat = 'all';
  const QUIZ_KINDS = [
    ['listen', '🎧', 'Hör-Quiz', 'Audio hören, Bedeutung wählen', '#E6F4FF'],
    ['de-jp', '🇩🇪', 'Deutsch → Japanisch', 'Die passende japanische Phrase finden', '#FFE3E3'],
    ['jp-de', '🇯🇵', 'Japanisch → Deutsch', 'Japanisch lesen, Bedeutung wählen', '#FFF1CC'],
    ['mix', '🎲', 'Gemischt', 'Alles durcheinander', '#EBDDFF'],
  ];
  function quizPool(cat) {
    const active = D.phrases.filter(p => !isParked(p.id));
    if (cat === 'weak') return active.filter(p => { const c = S.cards[p.id]; return c && c.ko > 0 && c.box < 3; });
    if (cat === 'video') return active.filter(p => p.video);
    return active.filter(p => cat === 'all' || p.cat === cat);
  }
  function renderQuizMenu() {
    const chips = [['all', '🌏 Alle'], ['video', '▶️ Video'], ['weak', '😵 Schwierige'], ...D.categories.map(c => [c.id, `${c.emoji} ${c.name}`])];
    $view.innerHTML = `
      <h2 class="section-title">🎯 Quiz · 10 Fragen</h2>
      <div class="filter">${chips.map(([k, l]) => `<button data-qcat="${k}" class="${quizCat === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
      <div class="mode-list">${QUIZ_KINDS.map(([k, ico, t, d, c]) =>
        `<button class="mode" data-kind="${k}" style="--c:${c}"><span class="ico">${ico}</span><div><b>${t}</b><span>${d}</span></div></button>`).join('')}</div>`;
    $view.querySelectorAll('[data-qcat]').forEach(b => b.addEventListener('click', () => { quizCat = b.dataset.qcat; renderQuizMenu(); }));
    $view.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => startQuiz(b.dataset.kind)));
  }
  function makeOptions(p) {
    const used = new Set([p.de]), jps = new Set([p.jp]), out = [];
    const cands = [...shuffle(D.phrases.filter(x => x.cat === p.cat)), ...shuffle(D.phrases.filter(x => x.cat !== p.cat))];
    for (const x of cands) {
      if (out.length === 3) break;
      if (used.has(x.de) || jps.has(x.jp)) continue;
      used.add(x.de); jps.add(x.jp); out.push(x.id);
    }
    return shuffle([p.id, ...out]);
  }
  function startQuiz(kind) {
    const pool = quizPool(quizCat);
    if (pool.length < 2) return toast(quizCat === 'weak' ? 'Noch keine schwierigen Phrasen – super! 🎉' : 'Zu wenige Phrasen');
    // Schwache und neue Phrasen bevorzugen
    const weight = p => { const c = S.cards[p.id]; return Math.random() + (c ? c.ko * .3 - c.box * .15 : .3); };
    const chosen = pool.map(p => [p, weight(p)]).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
    sess = {
      type: 'quiz', kind, i: 0, right: 0, xp: 0,
      qs: shuffle(chosen).map(p => ({ id: p.id, kind: kind === 'mix' ? pick(['listen', 'de-jp', 'jp-de']) : kind, opts: makeOptions(p) })),
    };
    renderQuiz();
  }
  function renderQuiz() {
    const q = sess.qs[sess.i];
    if (!q) {
      const n = sess.qs.length, r = sess.right, kind = sess.kind;
      return renderResult({
        emoji: r === n ? '🏆' : r >= n * .7 ? '🎉' : '💪', title: r === n ? 'Perfekt!' : r >= n * .7 ? 'Sehr gut!' : 'Weiter üben!',
        lines: [`${r} von ${n} richtig`], xp: sess.xp, again: () => startQuiz(kind), againText: '🔁 Neue Runde',
      });
    }
    const p = P[q.id];
    const kind = q.kind;
    let head;
    if (kind === 'listen') head = `<div class="q-label">🎧 Was hörst du?</div><button class="round-btn big" data-play="${p.id}" id="qplay" aria-label="Nochmal hören">🔊</button><div id="qreveal" style="margin-top:14px"></div>`;
    else if (kind === 'de-jp') head = `<div class="q-label">Wie sagt man …</div><div class="phrase"><div class="jp" style="font-size:1.6rem">${esc(p.de)}</div></div>`;
    else head = `<div class="q-label">Was bedeutet …</div>${phraseHTML(p, { hide: ['de'] })}<div class="actions" style="justify-content:center"><button class="round-btn" data-play="${p.id}" id="qplay">🔊</button></div>`;

    $view.innerHTML = `${progressTop(sess.i, sess.qs.length)}
      <div class="card q-card">${head}</div>
      <div class="options" id="opts">${q.opts.map(id => {
        const x = P[id];
        const inner = kind === 'de-jp' ? phraseHTML(x, { compact: true, hide: ['de'] }) : deOnly(x);
        const mini = kind === 'de-jp' ? `<button class="mini-play" data-play="${id}" aria-label="Anhören">🔊</button>` : '';
        return `<div class="option" role="button" tabindex="0" data-opt="${id}">${inner}${mini}</div>`;
      }).join('')}</div>
      <div id="fb"></div>`;
    bindCommon();
    if (kind !== 'de-jp' && (kind === 'listen' || S.settings.autoplay)) setTimeout(() => play(p.id, document.getElementById('qplay')), 250);

    const opts = [...$view.querySelectorAll('[data-opt]')];
    opts.forEach(o => o.addEventListener('click', () => {
      if (sess.answered) return;
      sess.answered = true;
      const ok = o.dataset.opt === p.id;
      opts.forEach(x => x.classList.add(x.dataset.opt === p.id ? 'correct' : x === o ? 'wrong' : 'dim'));
      quizMark(p.id, ok);
      if (ok) { sess.right++; sess.xp += 10; addXP(10); }
      if (kind === 'listen') document.getElementById('qreveal').innerHTML = phraseHTML(p, { hide: ['de'] });
      if (kind !== 'listen') play(p.id, null);
      const chosen = P[o.dataset.opt];
      document.getElementById('fb').innerHTML = `<div class="feedback ${ok ? 'good' : 'bad'}">
        <h3>${ok ? pick(['✅ Richtig!', '✅ せいかい！ Richtig!', '✅ Super!']) : '❌ Leider falsch'}</h3>
        ${ok ? '' : `<p class="small" style="margin-top:0">Deine Wahl „${esc(kind === 'de-jp' ? chosen.romaji : chosen.de)}“ heißt: <b>${esc(kind === 'de-jp' ? chosen.de : chosen.romaji)}</b></p>`}
        ${phraseHTML(p, { compact: true, all: true })}
        <div style="margin-top:10px">${tipHTML(p)}</div>
        <button class="btn block" id="next" style="margin-top:14px">Weiter ➜</button></div>`;
      document.getElementById('next').addEventListener('click', () => { sess.i++; sess.answered = false; stopAudio(); renderQuiz(); });
      document.getElementById('fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
  }

  // ── Situations-Dialoge ───────────────────────────────────────────────────
  function renderDialogMenu() {
    $view.innerHTML = `
      <h2 class="section-title">💬 Situations-Dialoge</h2>
      <p class="small muted" style="margin-top:-4px">Spiel echte Situationen durch: Hör zu, was dein Gegenüber sagt, und wähle die passende Antwort.</p>
      <div class="mode-list">${D.dialogs.map(d => {
        const best = S.dialogs[d.id];
        const stars = best == null ? 'Noch nicht gespielt' : '⭐'.repeat(best) + '☆'.repeat(3 - best);
        return `<button class="mode" data-dialog="${d.id}" style="--c:${d.color}"><span class="ico">${d.emoji}</span><div><b>${esc(d.title)}</b><span>${d.steps.length} Schritte · ${stars}</span></div></button>`;
      }).join('')}</div>`;
    $view.querySelectorAll('[data-dialog]').forEach(b => b.addEventListener('click', () => startDialog(D.dialogs.find(d => d.id === b.dataset.dialog))));
  }
  function startDialog(d) {
    sess = { type: 'dialog', d, i: 0, right: 0, xp: 0 };
    $view.innerHTML = `<div id="dtop"></div><h2 class="section-title" style="margin-top:4px">${d.emoji} ${esc(d.title)}</h2>
      <div class="chat" id="chat"></div><div id="dopts"></div>`;
    dialogStep();
  }
  function npcBubble(p) {
    const el = document.createElement('div');
    el.className = 'bubble npc';
    el.innerHTML = `<div class="who">${p.who === 'staff' ? '🧑‍🍳 Personal' : '🙂 Gegenüber'}</div>
      <div class="row-play">${phraseHTML(p, { compact: true, hide: ['de'] })}<button class="round-btn" style="width:42px;height:42px;font-size:1.1rem" data-play="${p.id}">🔊</button></div>
      <button class="reveal">Übersetzung zeigen</button>`;
    el.querySelector('.reveal').addEventListener('click', e => { e.target.outerHTML = `<div class="small" style="margin-top:4px"><b>${esc(p.de)}</b></div>`; });
    return el;
  }
  function dialogStep() {
    const { d } = sess;
    const step = d.steps[sess.i];
    const top = document.getElementById('dtop');
    top.innerHTML = progressTop(sess.i, d.steps.length);
    bindCommon(top);
    if (!step) {
      const n = d.steps.length, r = sess.right;
      const stars = r === n ? 3 : r >= n * .7 ? 2 : r >= n * .4 ? 1 : 0;
      S.dialogs[d.id] = Math.max(S.dialogs[d.id] ?? 0, stars); save();
      return renderResult({
        emoji: ['😅', '🙂', '😄', '🏆'][stars], title: `${d.title}: ${'⭐'.repeat(stars) || 'Nochmal!'}`,
        lines: [`${r} von ${n} Antworten richtig`], xp: sess.xp, again: () => startDialog(d), againText: '🔁 Nochmal spielen',
      });
    }
    const chat = document.getElementById('chat');
    if (step.say) {
      const b = npcBubble(P[step.say]); chat.appendChild(b); bindCommon(b);
      if (S.settings.autoplay) setTimeout(() => play(step.say, b.querySelector('[data-play]')), 200);
    }
    const sit = document.createElement('div');
    sit.className = 'bubble situation'; sit.textContent = '🎬 ' + step.prompt;
    chat.appendChild(sit);

    const ids = shuffle([step.answer, ...step.wrong]);
    const box = document.getElementById('dopts');
    const renderOpts = (reveal) => {
      box.innerHTML = `<div class="options">${ids.map(id => `<div class="option" role="button" tabindex="0" data-opt="${id}">
        ${phraseHTML(P[id], { compact: true, hide: reveal ? [] : ['de'], all: reveal })}<button class="mini-play" data-play="${id}" aria-label="Anhören">🔊</button></div>`).join('')}</div>`;
      bindCommon(box);
    };
    renderOpts(false);
    sit.scrollIntoView({ behavior: 'smooth', block: 'center' });

    let answered = false;
    box.querySelectorAll('[data-opt]').forEach(o => o.addEventListener('click', () => {
      if (answered) return; answered = true;
      const chosen = o.dataset.opt, ok = chosen === step.answer;
      renderOpts(true);
      box.querySelectorAll('[data-opt]').forEach(x => x.classList.add(x.dataset.opt === step.answer ? 'correct' : x.dataset.opt === chosen ? 'wrong' : 'dim'));
      const me = document.createElement('div');
      me.className = 'bubble me';
      me.innerHTML = phraseHTML(P[step.answer], { compact: true });
      chat.appendChild(me);
      play(step.answer, null);
      if (ok) { sess.right++; sess.xp += 15; addXP(15); }
      quizMark(step.answer, ok);
      const fb = document.createElement('div');
      fb.className = `feedback ${ok ? 'good' : 'bad'}`;
      fb.innerHTML = `<h3>${ok ? '✅ Passt!' : `❌ Besser: „${esc(P[step.answer].romaji)}“`}</h3>
        ${ok ? '' : `<p class="small" style="margin:0 0 6px">Deine Wahl bedeutet: <b>${esc(P[chosen].de)}</b></p>`}
        ${step.fb ? `<div class="tip">💡 ${esc(step.fb)}</div>` : ''}
        <button class="btn block" style="margin-top:12px">Weiter ➜</button>`;
      box.appendChild(fb);
      fb.querySelector('button').addEventListener('click', () => { sess.i++; stopAudio(); box.innerHTML = ''; dialogStep(); });
      fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
  }

  // ── Reise-Modus ──────────────────────────────────────────────────────────
  const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let travelQuery = '';
  function renderTravel() {
    $view.innerHTML = `
      <div class="search"><input id="q" type="search" placeholder="🔍 Suchen: Toilette, Bier, eki …" value="${esc(travelQuery)}" autocomplete="off"></div>
      <div id="tlist"></div>`;
    const q = document.getElementById('q');
    q.addEventListener('input', () => { travelQuery = q.value; renderTravelList(); });
    renderTravelList();
  }
  function travelItem(p) {
    const fav = S.favs.includes(p.id);
    return `<div class="list-item" style="--c:${CAT[p.cat].color}" data-show="${p.id}" role="button" tabindex="0">
      ${phraseHTML(p, { compact: true, all: true, hide: ['kana'] })}
      <button class="star ${fav ? 'on' : ''}" data-fav="${p.id}" aria-label="Favorit">⭐</button>
      <button class="mini-play" data-play="${p.id}" aria-label="Anhören">🔊</button></div>`;
  }
  function renderTravelList() {
    const box = document.getElementById('tlist');
    const q = fold(travelQuery.trim());
    const match = p => !q || [p.de, p.romaji, p.jp, p.kana, CAT[p.cat].name].some(f => fold(f).includes(q));
    const hits = D.phrases.filter(match);
    let html = '';
    const favs = S.favs.map(id => P[id]).filter(p => p && match(p));
    if (favs.length) html += `<div class="group-title">⭐ Favoriten</div><div class="list">${favs.map(travelItem).join('')}</div>`;
    for (const c of D.categories) {
      const items = hits.filter(p => p.cat === c.id);
      if (items.length) html += `<div class="group-title">${c.emoji} ${esc(c.name)}</div><div class="list">${items.map(travelItem).join('')}</div>`;
    }
    box.innerHTML = html || `<div class="empty"><div class="big">🤷</div>Nichts gefunden für „${esc(travelQuery)}“</div>`;
    bindCommon(box);
    box.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.dataset.fav;
      S.favs = S.favs.includes(id) ? S.favs.filter(x => x !== id) : [...S.favs, id];
      save(); renderTravelList();
    }));
    box.querySelectorAll('[data-show]').forEach(el => el.addEventListener('click', () => openShow(el.dataset.show)));
  }
  let showEl = null;
  function openShow(id) {
    const p = P[id];
    closeShow();
    showEl = document.createElement('div');
    showEl.className = 'show';
    showEl.innerHTML = `
      <button class="close-x close" aria-label="Schließen">✕</button>
      <button class="close-x rotate" aria-label="Drehen" title="Für dein Gegenüber drehen">🔄</button>
      <div id="show-text" style="transition:transform .3s">
        <div class="jp" lang="ja">${esc(p.jp)}</div>
        ${p.kana !== p.jp ? `<div class="kana" lang="ja">${esc(p.kana)}</div>` : ''}
      </div>
      <div class="romaji">${esc(p.romaji)}</div>
      <div class="de">${esc(p.de)}</div>
      <button class="round-btn big" data-play="${id}" aria-label="Abspielen">🔊</button>`;
    document.body.appendChild(showEl);
    bindCommon(showEl);
    let turned = false;
    showEl.querySelector('.rotate').addEventListener('click', () => {
      turned = !turned; showEl.querySelector('#show-text').style.transform = turned ? 'rotate(180deg)' : '';
    });
    // Eigener History-Eintrag, damit die Android-Zurück-Taste nur die Großanzeige schließt
    history.pushState({ show: id }, '');
    showEl.querySelector('.close').addEventListener('click', () => history.back());
  }
  function closeShow() { if (showEl) { showEl.remove(); showEl = null; stopAudio(); } }
  window.addEventListener('popstate', closeShow);

  // ── Einstellungen ────────────────────────────────────────────────────────
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  $sheet.addEventListener('click', e => { if (e.target === $sheet) $sheet.hidden = true; });
  function openSettings() {
    const s = S.settings;
    const sw = (key, label, sub) => `<div class="setting"><label for="s-${key}">${label}${sub ? `<small>${sub}</small>` : ''}</label>
      <input type="checkbox" class="switch" id="s-${key}" data-set="${key}" ${s[key] ? 'checked' : ''}></div>`;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-seg="${key}" data-val="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    $sheet.innerHTML = `<div class="sheet">
      <h2>⚙️ Einstellungen</h2>
      <div class="section-title" style="margin-top:4px">Anzeige</div>
      ${sw('jp', '日本 Japanische Schrift', 'Kanji & Kana')}
      ${sw('kana', 'あ Lesung in Hiragana', 'nur wenn Kanji vorkommen')}
      ${sw('romaji', 'Aa Romaji', 'Lateinische Umschrift')}
      ${sw('de', '🇩🇪 Deutsch', 'Übersetzung auf der Rückseite')}
      <div class="section-title">Audio</div>
      <div class="setting"><label>Stimme<small>MP3 = Neural-Stimme, Handy = Sprachausgabe des Geräts</small></label>${seg('audio', [['mp3', '🎵 MP3'], ['tts', '📱 Handy']])}</div>
      ${sw('autoplay', '🔊 Automatisch abspielen', 'beim Umdrehen & im Quiz')}
      <div class="setting"><label>Test</label><button class="btn secondary" id="s-test" style="padding:8px 14px">🔊 こんにちは</button></div>
      <div class="section-title">Lernen</div>
      <div class="setting"><label>Tagesziel</label>${seg('goal', [[30, '30 ⭐'], [50, '50 ⭐'], [100, '100 ⭐']])}</div>
      <div class="section-title">🎤 Aussprache</div>
      <div class="setting"><label>Aufnehmen & Vergleichen<small>${canRecord ? '✅ funktioniert offline, ohne Signalton' : '❌ in diesem Browser nicht möglich'}</small></label></div>
      <div class="setting" id="asr-box"></div>
      <div class="setting"><label>Japanische Handy-Stimme<small>${jaVoice() ? '✅ ' + esc(jaVoice().name) : '⚠️ keine gefunden – MP3 nutzen'}</small></label></div>
      <button class="btn bad block" id="s-reset" style="margin-top:14px">🗑️ Fortschritt zurücksetzen</button>
      <p class="small muted" style="text-align:center;margin-top:16px">MG Nihongo · ${D.phrases.length} Phrasen · Grundlage:
        <a href="https://www.youtube.com/watch?v=26VUZNqJ89c" target="_blank" rel="noopener">WanderWeib-Video</a></p>
      <button class="btn secondary block" id="s-close">Fertig</button>
    </div>`;
    $sheet.hidden = false;
    $sheet.querySelectorAll('[data-set]').forEach(i => i.addEventListener('change', () => {
      s[i.dataset.set] = i.checked;
      if (!s.jp && !s.romaji && !s.kana) { s.romaji = true; $sheet.querySelector('#s-romaji').checked = true; toast('Romaji bleibt an, sonst gäbe es nichts zu lesen'); }
      save(); if (!sess) render();
    }));
    $sheet.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.seg; s[k] = k === 'goal' ? Number(b.dataset.val) : b.dataset.val; save();
      $sheet.querySelectorAll(`[data-seg="${k}"]`).forEach(x => x.classList.toggle('on', x === b));
      if (!sess) render();
    }));
    $sheet.querySelector('#s-test').addEventListener('click', e => play('konnichiwa', e.currentTarget));
    $sheet.querySelector('#s-reset').addEventListener('click', () => {
      if (!confirm('Wirklich den gesamten Lernfortschritt, Punkte und Favoriten löschen?')) return;
      S = structuredClone(DEFAULTS); S.settings = s; save(); $sheet.hidden = true; sess = null; render(); toast('Fortschritt zurückgesetzt');
    });
    $sheet.querySelector('#s-close').addEventListener('click', () => { $sheet.hidden = true; });
    renderAsrBox();
  }

  // Offline-Bewertung (Whisper) laden / entfernen
  let asrDownloading = false;
  function renderAsrBox(pct) {
    const box = document.getElementById('asr-box');
    if (!box) return;
    const s = S.settings;
    if (asrDownloading) {
      box.innerHTML = `<label style="flex:1">Offline-Bewertung wird geladen …<small>${pct != null ? Math.round(pct * 100) + ' %' : 'startet …'} – App offen lassen</small>
        <div class="bar"><i style="width:${Math.round((pct || 0) * 100)}%"></i></div></label>`;
    } else if (s.asr) {
      box.innerHTML = `<label>Offline-Bewertung<small>✅ installiert – bewertet deine Aufnahmen ohne Internet</small></label>
        <button class="btn secondary" id="asr-del" style="padding:8px 12px">Entfernen</button>`;
      box.querySelector('#asr-del').addEventListener('click', async () => {
        if (!confirm('Offline-Bewertung (~80 MB) vom Gerät löschen?')) return;
        ASR.reset();
        try { await caches.delete('transformers-cache'); } catch { /* ignorieren */ }
        s.asr = false; save(); renderAsrBox();
      });
    } else {
      box.innerHTML = `<label>Offline-Bewertung<small>Automatische Bewertung per Whisper-Modell, einmalig ~80 MB (WLAN empfohlen)</small></label>
        <button class="btn" id="asr-dl" style="padding:8px 12px">Laden</button>`;
      box.querySelector('#asr-dl').addEventListener('click', downloadAsr);
    }
  }
  async function downloadAsr() {
    if (asrDownloading) return;
    asrDownloading = true; renderAsrBox(); updateModeDesc();
    ASR.onProgress = pct => { renderAsrBox(pct); updateModeDesc(pct); };
    try {
      await ASR.ensure();
      S.settings.asr = true; save();
      navigator.storage?.persist?.().catch(() => {});
      if (S.settings.mode !== 'offline') ASR.reset(); // nur geladen, nicht benutzt → Speicher freigeben
      toast('✅ Offline-Bewertung bereit');
    } catch (err) {
      toast('⚠️ Laden fehlgeschlagen: ' + err.message, 4000);
    } finally {
      asrDownloading = false; ASR.onProgress = null; renderAsrBox(); updateModeDesc();
    }
  }

  // ── Start ────────────────────────────────────────────────────────────────
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
