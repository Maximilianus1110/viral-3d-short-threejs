import json
import math
import os
import wave
import numpy as np
from scipy import signal
import soundfile as sf
from piper.voice import PiperVoice, SynthesisConfig

os.makedirs("/home/antigravity/viral-3d-short/assets", exist_ok=True)

MODEL_PATH = "/home/antigravity/viral-3d-short/models/de_DE-thorsten-high.onnx"
voice = PiperVoice.load(MODEL_PATH)
syn_cfg = SynthesisConfig(length_scale=0.85, noise_scale=0.667, noise_w_scale=0.78)

# 15 punchy phrases across 6 scenes combining all 3 requested styles
SCRIPT_PHRASES = [
    # SCENE 1: HOOK (Style 1: 3D Storytelling / Explainer)
    {
        "id": "p1",
        "scene": 1,
        "style": "STIL 1 · 3D STORYTELLING WORLD",
        "text": "Fragst du dich, wie diese viralen 3D-Kurzvideos entstehen?",
        "display": "Wie entstehen diese viralen 3D-Kurzvideos?",
        "highlights": ["viralen", "3D-Kurzvideos"],
        "pause_after": 0.18,
        "sfx": "bass_drop"
    },
    {
        "id": "p2",
        "scene": 1,
        "style": "STIL 1 · 3D STORYTELLING WORLD",
        "text": "Kein Blender, kein After Effects – dieses gesamte Video besteht zu hundert Prozent aus reinem Code!",
        "display": "Kein Blender, kein After Effects – 100% reiner Code!",
        "highlights": ["Kein Blender,", "100%", "reiner Code!"],
        "pause_after": 0.32,
        "sfx": "shatter_whoosh"
    },

    # SCENE 2: STEP 1 & 2 - PROMPT TO THREE.JS CODE (Style 2: Kinetic 3D Motion Graphics)
    {
        "id": "p3",
        "scene": 2,
        "style": "STIL 2 · KINETIC 3D MOTION GRAPHICS",
        "text": "Das Geheimnis ist eine simple Vier-Schritte-Pipeline:",
        "display": "Das Geheimnis: Die 4-Schritte Code-Pipeline",
        "highlights": ["Geheimnis:", "4-Schritte", "Code-Pipeline"],
        "pause_after": 0.15,
        "sfx": "whoosh_snap"
    },
    {
        "id": "p4",
        "scene": 2,
        "style": "STIL 2 · KINETIC 3D MOTION GRAPHICS",
        "text": "Erstens: Du beschreibst Claude im Prompt deine Szene, deine Story und den Kamera-Stil.",
        "display": "1. Prompt schreiben: Szene, Story & Kamera-Stil",
        "highlights": ["1. Prompt", "Szene,", "Kamera-Stil"],
        "pause_after": 0.18,
        "sfx": "typing_burst"
    },
    {
        "id": "p5",
        "scene": 2,
        "style": "STIL 2 · KINETIC 3D MOTION GRAPHICS",
        "text": "Zweitens: Claude generiert echten HTML- und Three-JS-Code – mit 3D-Meshes, Studio-Licht und mathematischen Kamera-Splines.",
        "display": "2. Claude baut HTML & Three.js: Meshes, Licht & Kamera-Splines",
        "highlights": ["2. Claude", "Three.js:", "Kamera-Splines"],
        "pause_after": 0.30,
        "sfx": "code_spawn"
    },

    # SCENE 3: STEP 3 & 4 - AUDIO SYNC & 60FPS FFMPEG RENDER (Style 1 + 2 Fusion)
    {
        "id": "p6",
        "scene": 3,
        "style": "STIL 1+2 · 3D RENDER-PIPELINE FABRIK",
        "text": "Drittens: Ein Python-Skript erzeugt automatisch Voiceover, Sounddesign und synchronisierte Captions.",
        "display": "3. Python erzeugt Voiceover, Sounddesign & Sync-Captions",
        "highlights": ["3. Python", "Voiceover,", "Sync-Captions"],
        "pause_after": 0.18,
        "sfx": "whoosh_pipeline"
    },
    {
        "id": "p7",
        "scene": 3,
        "style": "STIL 1+2 · 3D RENDER-PIPELINE FABRIK",
        "text": "Und viertens rendert Headless Chromium jedes einzelne Frame mit sechzig FPS über FFmpeg direkt als fertiges MP4-Video!",
        "display": "4. Headless Chrome + FFmpeg rendern exakt 60 FPS als MP4!",
        "highlights": ["4. Headless", "FFmpeg", "60 FPS", "MP4!"],
        "pause_after": 0.35,
        "sfx": "shutter_portal"
    },

    # SCENE 4: CLAUDE PRO 20$/MO 5-HOUR WINDOW MATH (Style 3: Hypnotic 3D Machine + Infographic)
    {
        "id": "p8",
        "scene": 4,
        "style": "STIL 3 · HYPNOTIC 3D MACHINE & INFOGRAFIK",
        "text": "Aber wie viele solche Videos schaffst du mit einem normalen Claude Pro Abo für zwanzig Dollar im Monat?",
        "display": "Wie viele 3D-Videos schafft ein Claude Pro Abo (20 $/Mo)?",
        "highlights": ["Wie viele", "Claude Pro", "(20 $/Mo)?"],
        "pause_after": 0.20,
        "sfx": "whoosh_clock"
    },
    {
        "id": "p9",
        "scene": 4,
        "style": "STIL 3 · HYPNOTIC 3D MACHINE & INFOGRAFIK",
        "text": "Im Pro-Abo arbeitest du in fünf-Stunden-Fenstern mit jeweils rund fünfundvierzig Prompts.",
        "display": "Pro 5-Stunden-Fenster: ~45 Prompts inklusive",
        "highlights": ["5-Stunden-Fenster:", "~45 Prompts"],
        "pause_after": 0.18,
        "sfx": "counter_45"
    },
    {
        "id": "p10",
        "scene": 4,
        "style": "STIL 3 · HYPNOTIC 3D MACHINE & INFOGRAFIK",
        "text": "Mit drei bis vier Prompts für Szene, Feinschliff und Timing entstehen zehn bis fünfzehn komplett fertige 3D-Videos pro Session!",
        "display": "3–4 Prompts pro Video = 10 bis 15 fertige 3D-Videos je 5h-Session!",
        "highlights": ["3–4 Prompts", "10 bis 15", "3D-Videos", "5h-Session!"],
        "pause_after": 0.35,
        "sfx": "chime_15"
    },

    # SCENE 5: MONTHLY SCALE - 400 VIDEOS FOR 5 CENTS (Style 3 + 1: Epic 3D Tower Matrix)
    {
        "id": "p11",
        "scene": 5,
        "style": "ALLE 3 STILE · 400 VIDEOS MONATS-SKALIERUNG",
        "text": "Selbst bei nur einer Session am Tag sind das rund vierhundert animierte 3D-Kurzvideos im Monat!",
        "display": "Auf den Monat gerechnet: ~400 fertige 3D-Kurzvideos!",
        "highlights": ["Monat", "~400 fertige", "3D-Kurzvideos!"],
        "pause_after": 0.18,
        "sfx": "epic_drop_400"
    },
    {
        "id": "p12",
        "scene": 5,
        "style": "ALLE 3 STILE · 400 VIDEOS MONATS-SKALIERUNG",
        "text": "Das entspricht Produktionskosten von gerade einmal fünf Cent pro fertigem 3D-Video.",
        "display": "Effektive Kosten: Nur ~0,05 $ (5 Cent) pro 3D-Video!",
        "highlights": ["~0,05 $", "(5 Cent)", "pro 3D-Video!"],
        "pause_after": 0.32,
        "sfx": "coin_sparkle"
    },

    # SCENE 6: OUTRO & INFINITE LOOP (Fusion of All 3 Styles)
    {
        "id": "p13",
        "scene": 6,
        "style": "FINALE · DEINE CODE-BASIERTE 3D-FABRIK",
        "text": "Prompt eingeben, Three-JS-Code generieren und mit sechzig FPS rendern – deine eigene 3D-Video-Fabrik läuft jetzt!",
        "display": "Prompt → Three.js → 60 FPS Render: Deine 3D-Fabrik läuft!",
        "highlights": ["Prompt", "Three.js", "60 FPS Render:", "3D-Fabrik"],
        "pause_after": 0.45,
        "sfx": "outro_loop"
    }
]

TARGET_SR = 44100

def resample_audio(data, orig_sr, target_sr):
    if orig_sr == target_sr:
        return data
    num_samples = int(round(len(data) * float(target_sr) / orig_sr))
    return signal.resample(data, num_samples)

def trim_silence(audio, sr, threshold=0.008, pad_ms=35):
    abs_a = np.abs(audio)
    idx = np.where(abs_a > threshold)[0]
    if len(idx) == 0:
        return audio
    pad = int(sr * pad_ms / 1000.0)
    start = max(0, idx[0] - pad)
    end = min(len(audio), idx[-1] + pad)
    return audio[start:end]

def enhance_voice(audio, sr):
    # High-pass filter at 85Hz to remove rumble
    sos_hp = signal.butter(2, 85, 'hp', fs=sr, output='sos')
    y = signal.sosfilt(sos_hp, audio)
    # Presence boost around 3.2kHz for crisp German intelligibility
    b_peak, a_peak = signal.iirpeak(3200, Q=1.2, fs=sr)
    y_peak = signal.lfilter(b_peak, a_peak, y)
    y = y + 0.35 * y_peak
    # Soft tanh saturation / compressor for broadcast punch
    y = np.tanh(y * 1.45) / np.tanh(1.45)
    # Normalize peak to 0.88
    peak = np.max(np.abs(y))
    if peak > 0:
        y = y * (0.88 / peak)
    return y

# Synthesize all phrases and record exact timestamps
phrase_records = []
voice_chunks = []
current_time = 0.35  # 0.35s intro beat before voice starts
voice_chunks.append(np.zeros(int(TARGET_SR * current_time), dtype=np.float32))

for item in SCRIPT_PHRASES:
    tmp_wav_raw = f"/tmp/phrase_raw_{item['id']}.wav"
    tmp_wav = f"/tmp/phrase_{item['id']}.wav"
    with wave.open(tmp_wav_raw, "wb") as wf:
        voice.synthesize_wav(item["text"], wf, syn_config=syn_cfg)
    os.system(f"ffmpeg -y -v error -i {tmp_wav_raw} -filter:a 'atempo=1.24' {tmp_wav}")
    raw_data, orig_sr = sf.read(tmp_wav, dtype="float32")
    if raw_data.ndim > 1:
        raw_data = raw_data[:, 0]
    resampled = resample_audio(raw_data, orig_sr, TARGET_SR)
    trimmed = trim_silence(resampled, TARGET_SR)
    enhanced = enhance_voice(trimmed, TARGET_SR)

    dur = len(enhanced) / TARGET_SR
    start_t = current_time
    end_t = start_t + dur

    # Compute word timings for display text
    disp_words = item["display"].split()
    weights = []
    for w in disp_words:
        weight = max(2, len(w))
        if any(p in w for p in [":", "–", ",", "!", "?"]):
            weight += 2.2
        weights.append(weight)
    total_w = sum(weights)
    w_cursor = start_t
    word_entries = []
    for w, weight in zip(disp_words, weights):
        w_dur = dur * (weight / total_w)
        clean_w = w
        is_hl = any(h.lower() in w.lower() or w.lower() in h.lower() for h in item["highlights"])
        word_entries.append({
            "word": clean_w,
            "start": round(w_cursor, 3),
            "end": round(w_cursor + w_dur, 3),
            "highlight": is_hl
        })
        w_cursor += w_dur

    phrase_records.append({
        "id": item["id"],
        "scene": item["scene"],
        "style": item["style"],
        "text": item["text"],
        "display": item["display"],
        "start": round(start_t, 3),
        "end": round(end_t, 3),
        "duration": round(dur, 3),
        "sfx": item["sfx"],
        "words": word_entries
    })

    voice_chunks.append(enhanced)
    pause_samples = int(TARGET_SR * item["pause_after"])
    voice_chunks.append(np.zeros(pause_samples, dtype=np.float32))
    current_time = end_t + item["pause_after"]

# Add 0.45s tail for clean loop resolution
tail_dur = 0.45
voice_chunks.append(np.zeros(int(TARGET_SR * tail_dur), dtype=np.float32))
total_duration = round(current_time + tail_dur, 3)

voice_track = np.concatenate(voice_chunks)
total_samples = len(voice_track)

# Compute scene boundaries from phrase_records
scenes_meta = []
for s_idx in range(1, 7):
    s_phrases = [p for p in phrase_records if p["scene"] == s_idx]
    s_start = 0.0 if s_idx == 1 else s_phrases[0]["start"] - 0.12
    s_end = total_duration if s_idx == 6 else [p for p in phrase_records if p["scene"] == s_idx + 1][0]["start"] - 0.12
    scenes_meta.append({
        "scene": s_idx,
        "style": s_phrases[0]["style"],
        "start": round(s_start, 3),
        "end": round(s_end, 3)
    })

print(f"Total video duration: {total_duration:.2f}s ({int(total_duration * 60)} frames at 60fps)")
for sm in scenes_meta:
    print(f"  Scene {sm['scene']} [{sm['style']}]: {sm['start']:.2f}s -> {sm['end']:.2f}s")

# ==============================================================================
# PROCEDURAL SOUNDTRACK & CINEMATIC SFX ENGINE (Stereo 44.1kHz)
# ==============================================================================
t_axis = np.arange(total_samples, dtype=np.float32) / TARGET_SR
music_L = np.zeros(total_samples, dtype=np.float32)
music_R = np.zeros(total_samples, dtype=np.float32)
sfx_L = np.zeros(total_samples, dtype=np.float32)
sfx_R = np.zeros(total_samples, dtype=np.float32)

def add_stereo_sound(buf_L, buf_R, start_t, sig_L, sig_R=None):
    if sig_R is None:
        sig_R = sig_L
    idx = int(start_t * TARGET_SR)
    if idx < 0 or idx >= total_samples:
        return
    end_idx = min(total_samples, idx + len(sig_L))
    length = end_idx - idx
    buf_L[idx:end_idx] += sig_L[:length]
    buf_R[idx:end_idx] += sig_R[:length]

# 1. Driving Dark-Tech Synthwave Arpeggio & Sub-Bass (125 BPM, D Minor: D - Bb - F - C)
bpm = 125.0
step_dur = (60.0 / bpm) / 4.0  # 16th note
total_steps = int(total_duration / step_dur)

# Chord progression in D minor (frequencies in Hz)
prog = [
    {"bass": 73.42, "arp": [293.66, 349.23, 440.00, 587.33]},  # Dm
    {"bass": 58.27, "arp": [233.08, 293.66, 349.23, 466.16]},  # Bb
    {"bass": 87.31, "arp": [261.63, 349.23, 440.00, 523.25]},  # F
    {"bass": 65.41, "arp": [261.63, 329.63, 392.00, 523.25]},  # C
]

for step in range(total_steps):
    st_time = step * step_dur
    bar = (step // 16) % 4
    chord = prog[bar]
    arp_note = chord["arp"][step % 4]

    # Pluck synth note
    n_samples = int(step_dur * 1.4 * TARGET_SR)
    nt = np.arange(n_samples, dtype=np.float32) / TARGET_SR
    env = np.exp(-nt * 14.0) * (1.0 - np.exp(-nt * 200.0))
    # Detuned stereo saw/triangle hybrid
    osc_L = 0.5 * np.sin(2 * np.pi * arp_note * nt) + 0.25 * np.sin(2 * np.pi * (arp_note * 2.003) * nt)
    osc_R = 0.5 * np.sin(2 * np.pi * (arp_note * 0.998) * nt) + 0.25 * np.sin(2 * np.pi * (arp_note * 1.997) * nt)
    pan = 0.65 + 0.25 * math.sin(step * 0.7)
    add_stereo_sound(music_L, music_R, st_time, osc_L * env * 0.14 * pan, osc_R * env * 0.14 * (1.3 - pan))

    # Deep pulsing bass on every 8th note (step % 2 == 0)
    if step % 2 == 0:
        b_samples = int(step_dur * 1.9 * TARGET_SR)
        bt = np.arange(b_samples, dtype=np.float32) / TARGET_SR
        b_freq = chord["bass"]
        b_env = np.exp(-bt * 6.5) * (1.0 - np.exp(-bt * 120.0))
        b_sig = (np.sin(2 * np.pi * b_freq * bt) + 0.35 * np.tanh(2.5 * np.sin(2 * np.pi * b_freq * 2 * bt))) * b_env * 0.22
        add_stereo_sound(music_L, music_R, st_time, b_sig, b_sig)

    # Crisp electronic kick on quarter notes (step % 4 == 0)
    if step % 4 == 0:
        k_samples = int(0.18 * TARGET_SR)
        kt = np.arange(k_samples, dtype=np.float32) / TARGET_SR
        k_freq = 52.0 + 110.0 * np.exp(-kt * 42.0)
        k_phase = 2 * np.pi * np.cumsum(k_freq) / TARGET_SR
        k_env = np.exp(-kt * 16.0)
        k_sig = np.sin(k_phase) * k_env * 0.26
        add_stereo_sound(music_L, music_R, st_time, k_sig, k_sig)

    # Crisp hi-hat on off-beats (step % 4 == 2)
    if step % 4 == 2:
        h_samples = int(0.055 * TARGET_SR)
        ht = np.arange(h_samples, dtype=np.float32) / TARGET_SR
        np.random.seed(step + 100)
        noise = np.random.randn(h_samples).astype(np.float32)
        sos_hh = signal.butter(2, 7000, 'hp', fs=TARGET_SR, output='sos')
        hh = signal.sosfilt(sos_hh, noise) * np.exp(-ht * 65.0) * 0.08
        add_stereo_sound(music_L, music_R, st_time, hh * 0.9, hh * 1.1)

# 2. Cinematic Sound Effects (Whooshes, Sub Drops, Digital Code Ticks, Chimes)
def make_sub_drop(dur=0.95):
    n = int(dur * TARGET_SR)
    t = np.arange(n, dtype=np.float32) / TARGET_SR
    f = 42.0 + 95.0 * np.exp(-t * 6.5)
    ph = 2 * np.pi * np.cumsum(f) / TARGET_SR
    env = np.exp(-t * 3.2) * (1.0 - np.exp(-t * 150.0))
    sig = np.tanh(np.sin(ph) * 1.8) * env * 0.45
    return sig, sig

def make_whoosh(dur=0.42, dir_pan=1):
    n = int(dur * TARGET_SR)
    t = np.arange(n, dtype=np.float32) / TARGET_SR
    np.random.seed(42)
    noise = np.random.randn(n).astype(np.float32)
    sos = signal.butter(2, [300, 3800], 'bp', fs=TARGET_SR, output='sos')
    filtered = signal.sosfilt(sos, noise)
    # Pitch-swept tonal layer
    sweep_f = 180.0 + 720.0 * np.sin(np.pi * t / dur)
    ph = 2 * np.pi * np.cumsum(sweep_f) / TARGET_SR
    tonal = np.sin(ph) * 0.35
    env = np.sin(np.pi * t / dur) ** 1.8
    pan_L = np.linspace(0.9 if dir_pan > 0 else 0.2, 0.2 if dir_pan > 0 else 0.9, n)
    pan_R = 1.1 - pan_L
    out = (filtered * 0.65 + tonal) * env * 0.32
    return out * pan_L, out * pan_R

def make_chime_burst(notes, spacing=0.075, note_dur=0.35):
    total_n = int((len(notes) * spacing + note_dur) * TARGET_SR)
    L = np.zeros(total_n, dtype=np.float32)
    R = np.zeros(total_n, dtype=np.float32)
    for i, f in enumerate(notes):
        n = int(note_dur * TARGET_SR)
        t = np.arange(n, dtype=np.float32) / TARGET_SR
        env = np.exp(-t * 11.0) * (1.0 - np.exp(-t * 300.0))
        sig = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.0 * t)) * env * 0.20
        idx = int(i * spacing * TARGET_SR)
        pan = 0.3 + 0.4 * (i % 2)
        L[idx:idx+n] += sig * pan
        R[idx:idx+n] += sig * (1.0 - pan)
    return L, R

for p in phrase_records:
    st = max(0.0, p["start"] - 0.08)
    sfx_type = p["sfx"]
    if sfx_type == "bass_drop":
        sL, sR = make_sub_drop(0.9)
        add_stereo_sound(sfx_L, sfx_R, 0.02, sL, sR)
    elif sfx_type in ("shatter_whoosh", "whoosh_snap", "whoosh_pipeline", "whoosh_clock"):
        sL, sR = make_whoosh(0.40, dir_pan=1 if p["scene"] % 2 == 0 else -1)
        add_stereo_sound(sfx_L, sfx_R, st, sL, sR)
    elif sfx_type == "typing_burst":
        # Futuristic digital UI clicks
        notes = [1200, 1450, 1100, 1600, 1350, 1750, 1500, 1900]
        sL, sR = make_chime_burst(notes, spacing=0.055, note_dur=0.09)
        add_stereo_sound(sfx_L, sfx_R, st + 0.15, sL * 0.55, sR * 0.55)
    elif sfx_type == "code_spawn":
        notes = [440.0, 554.37, 659.25, 880.0, 1108.73]
        sL, sR = make_chime_burst(notes, spacing=0.09, note_dur=0.4)
        add_stereo_sound(sfx_L, sfx_R, st + 0.2, sL, sR)
    elif sfx_type == "shutter_portal":
        sL, sR = make_whoosh(0.55, dir_pan=1)
        add_stereo_sound(sfx_L, sfx_R, st + 0.1, sL, sR)
        dL, dR = make_sub_drop(0.75)
        add_stereo_sound(sfx_L, sfx_R, p["end"] - 0.6, dL * 0.8, dR * 0.8)
    elif sfx_type == "counter_45":
        # Fast rising counter ticks for 45 prompts
        notes = [500 + i * 38 for i in range(12)]
        sL, sR = make_chime_burst(notes, spacing=0.06, note_dur=0.12)
        add_stereo_sound(sfx_L, sfx_R, st + 0.4, sL * 0.7, sR * 0.7)
    elif sfx_type == "chime_15":
        notes = [587.33, 698.46, 880.0, 1174.66, 1396.91]
        sL, sR = make_chime_burst(notes, spacing=0.08, note_dur=0.45)
        add_stereo_sound(sfx_L, sfx_R, p["end"] - 1.1, sL, sR)
    elif sfx_type == "epic_drop_400":
        wL, wR = make_whoosh(0.5, dir_pan=-1)
        add_stereo_sound(sfx_L, sfx_R, st, wL, wR)
        dL, dR = make_sub_drop(1.1)
        add_stereo_sound(sfx_L, sfx_R, st + 0.25, dL * 1.1, dR * 1.1)
    elif sfx_type == "coin_sparkle":
        notes = [1046.50, 1318.51, 1567.98, 2093.00]
        sL, sR = make_chime_burst(notes, spacing=0.07, note_dur=0.5)
        add_stereo_sound(sfx_L, sfx_R, st + 0.5, sL, sR)
    elif sfx_type == "outro_loop":
        wL, wR = make_whoosh(0.65, dir_pan=1)
        add_stereo_sound(sfx_L, sfx_R, p["end"] - 0.5, wL, wR)

# 3. Sidechain Ducking: lower music volume smoothly whenever voice is active
voice_env = np.abs(voice_track)
win = int(TARGET_SR * 0.08)
smooth_voice_env = np.convolve(voice_env, np.ones(win)/win, mode='same')
duck_gain = 1.0 - 0.62 * np.clip(smooth_voice_env * 4.5, 0.0, 1.0)

master_L = voice_track * 0.96 + music_L * duck_gain + sfx_L * 0.75
master_R = voice_track * 0.96 + music_R * duck_gain + sfx_R * 0.75

# Final soft limiter
master_stereo = np.stack([master_L, master_R], axis=1)
master_stereo = np.tanh(master_stereo * 1.15) / np.tanh(1.15) * 0.94

wav_out = "/home/antigravity/viral-3d-short/assets/master_audio.wav"
sf.write(wav_out, master_stereo, TARGET_SR)

# Compute 60fps amplitude envelopes for Three.js audio-reactive visuals
fps = 60
total_frames = int(math.ceil(total_duration * fps))
voice_60fps = []
bass_60fps = []
for f in range(total_frames):
    s0 = int((f / fps) * TARGET_SR)
    s1 = min(total_samples, int(((f + 1) / fps) * TARGET_SR))
    if s1 > s0:
        v_rms = float(np.sqrt(np.mean(voice_track[s0:s1] ** 2)))
        b_rms = float(np.sqrt(np.mean((music_L[s0:s1] + sfx_L[s0:s1]) ** 2)))
    else:
        v_rms, b_rms = 0.0, 0.0
    voice_60fps.append(round(min(1.0, v_rms * 3.8), 3))
    bass_60fps.append(round(min(1.0, b_rms * 4.2), 3))

timeline_data = {
    "fps": fps,
    "totalDuration": total_duration,
    "totalFrames": total_frames,
    "scenes": scenes_meta,
    "phrases": phrase_records,
    "voiceEnvelope": voice_60fps,
    "bassEnvelope": bass_60fps
}

with open("/home/antigravity/viral-3d-short/assets/timeline.json", "w", encoding="utf-8") as f:
    json.dump(timeline_data, f, ensure_ascii=False, indent=2)

print("Saved master_audio.wav and timeline.json successfully!")
