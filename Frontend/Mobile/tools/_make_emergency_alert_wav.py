"""Synthesize a continuous WEA two-tone amber blare (~60s, no silence gaps)."""
import math
import struct
import wave
from pathlib import Path

RATE = 22050
DURATION_S = 60.0
# EAS attention signal: both tones together = continuous attention blare
F_LOW = 853.0
F_HIGH = 960.0
AMP = 0.85

n_frames = int(RATE * DURATION_S)
# Soft fade in/out at ends only (avoid click), not between tones.
EDGE_S = 0.02
edge_n = int(RATE * EDGE_S)

pcm = bytearray()
for i in range(n_frames):
    t = i / RATE
    # Continuous dual-tone (no gaps) for the full minute.
    s = 0.5 * math.sin(2 * math.pi * F_LOW * t) + 0.5 * math.sin(2 * math.pi * F_HIGH * t)
    if i < edge_n:
        s *= i / edge_n
    elif i > n_frames - edge_n:
        s *= (n_frames - i) / edge_n
    s = max(-1.0, min(1.0, AMP * s))
    pcm.extend(struct.pack("<h", int(s * 32767.0)))

paths = [
    Path(r"e:/Github/RescueLink/Frontend/Mobile/android/app/src/main/res/raw/emergency_alert.wav"),
    Path(r"e:/Github/RescueLink/Frontend/Mobile/assets/sounds/emergency_alert.wav"),
    Path(r"e:/Github/RescueLink/Frontend/Mobile/ios/Runner/emergency_alert.wav"),
]

for out in paths:
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(pcm))
    print(f"wrote {out} size={out.stat().st_size}")

with wave.open(str(paths[0]), "rb") as w:
    print(
        "verify",
        w.getnchannels(),
        w.getframerate(),
        round(w.getnframes() / w.getframerate(), 2),
        "secs",
    )
