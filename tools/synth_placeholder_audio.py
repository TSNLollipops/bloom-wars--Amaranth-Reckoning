#!/usr/bin/env python3
"""
Bloom Wars — synthesized placeholder audio, 9 Sep 2026.

Real CC0 audio (Kenney.nl, freesound) is unreachable from this sandbox — the
proxy 403s on both hosts. Rather than ship silence, these eight files are
procedurally synthesized in pure Python (numpy, stdlib `wave`) so the game
has *something* in every slot the feature-gap report's A6 item calls for.
They are explicitly placeholder, not a final art pass — drop-in replacement
is one file each, see engine/audio/AudioManager.ts's own header for the
exact key -> filename map this script's output has to match.

The two ambient loops are built entirely from sine partials whose
frequencies are integer multiples of 1/LOOP_S — that makes each loop
period-exact (sample-for-sample identical phase at t=0 and t=LOOP_S), so
Phaser's normal `loop: true` playback has no seam, click, or pop at the
wrap point without needing a manual crossfade.
"""
import math
import wave
import struct
import numpy as np

SR = 44100


def write_wav(path, samples_stereo, sr=SR):
    """samples_stereo: float32 array shape (N, 2), range roughly [-1, 1]."""
    peak = np.max(np.abs(samples_stereo)) or 1.0
    if peak > 0.98:
        samples_stereo = samples_stereo * (0.98 / peak)
    ints = np.clip(samples_stereo * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(ints.tobytes())


def nearest_grid_freq(target_hz, loop_s):
    """Round target_hz to the nearest exact multiple of 1/loop_s so a tone
    built from it is perfectly phase-continuous across one loop."""
    step = 1.0 / loop_s
    k = round(target_hz / step)
    return k * step


def pad_tone(t, freq_hz, loop_s, phase=0.0):
    f = nearest_grid_freq(freq_hz, loop_s)
    return np.sin(2 * math.pi * f * t + phase)


def slow_lfo(t, cycles_per_loop, loop_s, phase=0.0):
    """An LFO that also completes a whole number of cycles per loop, so
    amplitude/filter modulation stays seamless too."""
    f = cycles_per_loop / loop_s
    return np.sin(2 * math.pi * f * t + phase)


def make_ambient(path, loop_s, chord_hz, detune_cents, hum_hz, hum_amt, brightness, seed):
    """A soft sustained pad: a few detuned sine partials per chord tone
    (for a bit of chorus-y width, still period-exact — the detune amount
    itself is chosen from the 1/loop_s grid, not a free-running detune),
    a slow amplitude breathing LFO, and a very quiet low hum for texture.
    """
    rng = np.random.default_rng(seed)
    n = int(loop_s * SR)
    t = np.arange(n) / SR

    left = np.zeros(n)
    right = np.zeros(n)
    # Each chord tone gets three detuned voices (equal-power panned: dead
    # center, and the +/- cents pair leaning slightly opposite ways) for a
    # bit of chorus width without breaking the period-exact loop guarantee
    # — every voice's frequency still comes off the 1/loop_s grid.
    for hz in chord_hz:
        for cents in (-detune_cents, 0.0, detune_cents):
            f = hz * (2.0 ** (cents / 1200.0))
            phase = rng.uniform(0, 2 * math.pi)
            amp = 0.55 if cents == 0.0 else 0.3
            tone = pad_tone(t, f, loop_s, phase) * amp
            pan = 0.0 if cents == 0.0 else (0.35 if cents > 0 else -0.35)  # -1..1
            lg = math.sqrt(0.5 * (1 - pan))
            rg = math.sqrt(0.5 * (1 + pan))
            left += tone * lg
            right += tone * rg

    breathing = 0.82 + 0.18 * slow_lfo(t, 2, loop_s)  # 2 slow swells per loop
    left *= breathing
    right *= breathing

    hum = slow_lfo(t, round(hum_hz * loop_s), loop_s) * hum_amt
    left += hum
    right += hum

    # Brightness: mix in a quiet octave-up shimmer so "battle" can read
    # tenser/brighter than "hub" from the same chord-building code.
    if brightness > 0:
        for hz in chord_hz:
            f = hz * 2.0
            phase = rng.uniform(0, 2 * math.pi)
            tone = pad_tone(t, f, loop_s, phase) * brightness
            left += tone
            right += tone

    stereo = np.stack([left, right], axis=1).astype(np.float32)
    # Normalize to a modest, non-fatiguing ambient level.
    stereo *= 0.5
    write_wav(path, stereo)


def env_ad(n, attack_n, decay_n, curve=1.0):
    """Simple attack/decay envelope, length n."""
    e = np.zeros(n)
    a = min(attack_n, n)
    e[:a] = np.linspace(0, 1, a) ** curve
    rest = n - a
    if rest > 0:
        e[a:] = np.linspace(1, 0, rest) ** (1.0 / curve)
    return e


def noise_burst(n, seed, lp_alpha=0.2):
    rng = np.random.default_rng(seed)
    raw = rng.uniform(-1, 1, n)
    # Cheap one-pole low-pass so the noise reads as a physical impact/whoosh
    # rather than pure static.
    out = np.zeros(n)
    prev = 0.0
    for i in range(n):
        prev = prev + lp_alpha * (raw[i] - prev)
        out[i] = prev
    return out


def make_hit(path):
    dur = 0.22
    n = int(dur * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * math.pi * 95 * t) * env_ad(n, int(0.002 * SR), int(0.16 * SR), curve=0.5)
    crack = noise_burst(n, seed=1, lp_alpha=0.6) * env_ad(n, int(0.001 * SR), int(0.06 * SR), curve=0.6)
    mono = thump * 0.8 + crack * 0.5
    stereo = np.stack([mono, mono], axis=1).astype(np.float32) * 0.9
    write_wav(path, stereo)


def make_dodge(path):
    dur = 0.18
    n = int(dur * SR)
    t = np.arange(n) / SR
    sweep_hz = np.linspace(1400, 500, n)
    phase = 2 * math.pi * np.cumsum(sweep_hz) / SR
    tone = np.sin(phase) * env_ad(n, int(0.005 * SR), int(0.15 * SR), curve=0.7)
    hiss = noise_burst(n, seed=2, lp_alpha=0.8) * env_ad(n, int(0.005 * SR), int(0.1 * SR), curve=1.5) * 0.25
    mono = tone * 0.5 + hiss
    stereo = np.stack([mono, mono], axis=1).astype(np.float32) * 0.7
    write_wav(path, stereo)


def make_kill(path):
    dur = 0.55
    n = int(dur * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * math.pi * 70 * t) * env_ad(n, int(0.003 * SR), int(0.45 * SR), curve=0.4)
    crunch = noise_burst(n, seed=3, lp_alpha=0.35) * env_ad(n, int(0.002 * SR), int(0.3 * SR), curve=0.6)
    sweep_hz = np.linspace(2200, 90, n)
    phase = 2 * math.pi * np.cumsum(sweep_hz) / SR
    fall = np.sin(phase) * env_ad(n, int(0.003 * SR), int(0.4 * SR), curve=0.5) * 0.4
    mono = boom * 0.9 + crunch * 0.6 + fall
    stereo = np.stack([mono, mono], axis=1).astype(np.float32) * 0.85
    write_wav(path, stereo)


def make_click(path):
    dur = 0.07
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * math.pi * 820 * t) * env_ad(n, int(0.001 * SR), int(0.06 * SR), curve=0.8)
    tick = noise_burst(n, seed=4, lp_alpha=0.9) * env_ad(n, int(0.001 * SR), int(0.015 * SR), curve=1.0) * 0.3
    mono = tone * 0.6 + tick
    stereo = np.stack([mono, mono], axis=1).astype(np.float32) * 0.6
    write_wav(path, stereo)


def make_mission_win(path):
    dur = 1.6
    n = int(dur * SR)
    t = np.arange(n) / SR
    notes_hz = [392.0, 523.25, 659.25, 784.0]  # G4, C5, E5, G5 — simple rising major arpeggio
    note_len = 0.22
    mono = np.zeros(n)
    for i, hz in enumerate(notes_hz):
        start = int(i * note_len * SR)
        seg_n = n - start
        if seg_n <= 0:
            continue
        tseg = t[:seg_n]
        tone = np.sin(2 * math.pi * hz * tseg) + 0.4 * np.sin(2 * math.pi * hz * 2 * tseg)
        env = env_ad(seg_n, int(0.01 * SR), seg_n - int(0.01 * SR), curve=0.35)
        mono[start:start + seg_n] += tone * env * 0.5
    # A final held chord tail.
    chord_start = int(len(notes_hz) * note_len * SR)
    seg_n = n - chord_start
    if seg_n > 0:
        tseg = t[:seg_n]
        chord = sum(np.sin(2 * math.pi * hz * tseg) for hz in [523.25, 659.25, 784.0])
        env = env_ad(seg_n, int(0.02 * SR), seg_n - int(0.02 * SR), curve=0.4)
        mono[chord_start:chord_start + seg_n] += chord * env * 0.25
    stereo = np.stack([mono, mono], axis=1).astype(np.float32) * 0.7
    write_wav(path, stereo)


def make_pilot_lost(path):
    dur = 1.3
    n = int(dur * SR)
    t = np.arange(n) / SR
    # A slow, minor, descending two-note fall — deliberately restrained
    # rather than dramatic; this plays at a permadeath moment.
    notes = [(392.0, 0.0, 0.6), (349.23, 0.5, 0.8)]  # G4 -> F4, minor-feeling drop
    mono = np.zeros(n)
    for hz, start_s, len_s in notes:
        start = int(start_s * SR)
        seg_n = min(n - start, int(len_s * SR))
        if seg_n <= 0:
            continue
        tseg = t[:seg_n]
        tone = np.sin(2 * math.pi * hz * tseg) + 0.3 * np.sin(2 * math.pi * hz * 0.5 * tseg)
        env = env_ad(seg_n, int(0.02 * SR), seg_n - int(0.02 * SR), curve=0.6)
        mono[start:start + seg_n] += tone * env * 0.45
    stereo = np.stack([mono, mono], axis=1).astype(np.float32) * 0.65
    write_wav(path, stereo)


if __name__ == "__main__":
    import os
    out = os.path.dirname(os.path.abspath(__file__))

    # Hub — warm, settled, low harmonic tension. A2/E3/A3-ish chord.
    make_ambient(
        os.path.join(out, "hub_ambient.wav"),
        loop_s=12.0,
        chord_hz=[110.0, 164.81, 220.0],
        detune_cents=6.0,
        hum_hz=0.5,
        hum_amt=0.03,
        brightness=0.0,
        seed=10,
    )
    # Battle — lower root, added tritone-adjacent tension tone, brighter
    # shimmer layer, faster hum — reads tenser without being loud.
    make_ambient(
        os.path.join(out, "battle_ambient.wav"),
        loop_s=12.0,
        chord_hz=[98.0, 138.59, 196.0],
        detune_cents=9.0,
        hum_hz=1.5,
        hum_amt=0.045,
        brightness=0.03,
        seed=20,
    )
    make_hit(os.path.join(out, "sfx_hit.wav"))
    make_dodge(os.path.join(out, "sfx_dodge.wav"))
    make_kill(os.path.join(out, "sfx_kill.wav"))
    make_click(os.path.join(out, "sfx_click.wav"))
    make_mission_win(os.path.join(out, "sfx_mission_win.wav"))
    make_pilot_lost(os.path.join(out, "sfx_pilot_lost.wav"))
    print("done")
