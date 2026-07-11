import type { AudioListener } from 'three/webgpu'
import { MEADOW_ORB_CHIME_DUCKED, MEADOW_ORB_CHIME_SOLO } from '../config/meadowAudio'

const LOG_PREFIX = '[orb-chime]'
const CHIME_URL = '/audio/orb-sfx.mp3'

/** ~45ms attack ramp guarantees a soft onset even if the sample has a sharp transient. */
const ATTACK_SECONDS = 0.045

let bufferPromise: Promise<AudioBuffer | null> | null = null

function loadBuffer(context: BaseAudioContext): Promise<AudioBuffer | null> {
  if (!bufferPromise) {
    bufferPromise = fetch(CHIME_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.arrayBuffer()
      })
      .then((data) => context.decodeAudioData(data))
      .catch((err: unknown) => {
        console.warn(`${LOG_PREFIX} failed to load`, err)
        return null
      })
  }
  return bufferPromise
}

/** Prefetch during idle so the first collect chime has no network gap. */
export function prepareOrbChime(listener: AudioListener | null): void {
  if (!listener) return
  void loadBuffer(listener.context)
}

/**
 * Single flat warm chime — no pitch ladder across collects, ducked under
 * Cosmic Lullaby when the BGM is audible (never over it).
 */
export function playOrbChime(listener: AudioListener | null, duckUnderBgm: boolean): void {
  if (!listener) return
  const context = listener.context

  if (context.state === 'suspended') {
    void (context as AudioContext).resume().catch(() => {})
  }

  void loadBuffer(context).then((buffer) => {
    if (!buffer) return

    const source = context.createBufferSource()
    source.buffer = buffer

    const gain = context.createGain()
    const now = context.currentTime
    // Owner mix 2026-07-11 (was 0.42 / 0.7): the ducked level must stay clearly
    // present under Cosmic Lullaby; sample peaks −7.3 dB so both stay clip-free.
    const target = duckUnderBgm ? MEADOW_ORB_CHIME_DUCKED : MEADOW_ORB_CHIME_SOLO
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(target, now + ATTACK_SECONDS)

    source.connect(gain)
    gain.connect(listener.getInput())
    source.start(now)

    source.onended = () => {
      source.disconnect()
      gain.disconnect()
    }
  })
}
