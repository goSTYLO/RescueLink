"""Self-check: decode_audio works without librosa (prod path)."""
import os
import tempfile
import wave

try:
    from audio.decode import decode_audio
except ImportError:
    from decode import decode_audio


def main():
    sample_rate = 16000
    frames = sample_rate  # 1 second
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        with wave.open(path, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b"\x00\x00" * frames)

        y, sr, duration = decode_audio(path, prefer_librosa=False)
        assert sr == sample_rate, sr
        assert abs(duration - 1.0) < 0.05, duration
        assert y is not None
        print("ok")
    finally:
        os.remove(path)


if __name__ == "__main__":
    main()
