import { meadowPlaylistTracks } from '../config/meadowPlaylist'

const LOG_PREFIX = '[meadow-bgm]'

/**
 * HTML5 Audio playlist for Cosmic Lullaby — started on [ START ] user gesture.
 * Independent of THREE.AudioLoader / WebGPU mini-canvas (footsteps stay on Web Audio).
 */
class MeadowBgmPlayer {
  private readonly urls: string[]
  private readonly audio: HTMLAudioElement
  private index = 0
  private started = false
  private muted = false

  constructor(urls: string[]) {
    this.urls = urls
    this.audio = new Audio()
    this.audio.preload = 'auto'

    this.audio.addEventListener('ended', () => {
      if (!this.started) return
      this.playIndex(this.index + 1)
    })

    this.audio.addEventListener('error', () => {
      const failed = this.urls[this.index]
      console.error(`${LOG_PREFIX} track failed (${this.audio.error?.code ?? 'unknown'}):`, failed)
      if (!this.started) return
      this.playIndex(this.index + 1)
    })
  }

  /** Call from [ START ] click — must run inside a user gesture. */
  start(): void {
    if (this.started) return
    this.started = true
    this.index = 0
    this.audio.muted = this.muted
    if (import.meta.env.DEV) {
      console.info(`${LOG_PREFIX} starting playlist:`, this.urls)
    }
    this.playIndex(0)
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.audio.muted = muted
  }

  private playIndex(nextIndex: number): void {
    if (this.urls.length === 0) return

    this.index = ((nextIndex % this.urls.length) + this.urls.length) % this.urls.length
    const url = this.urls[this.index]
    this.audio.src = url
    this.audio.load()

    const playPromise = this.audio.play()
    if (playPromise) {
      void playPromise.catch((err: unknown) => {
        console.error(`${LOG_PREFIX} play() rejected for`, url, err)
        if (this.started) this.playIndex(this.index + 1)
      })
    }
  }
}

let player: MeadowBgmPlayer | null = null

function getPlayer(): MeadowBgmPlayer {
  if (!player) {
    player = new MeadowBgmPlayer(meadowPlaylistTracks.map((t) => t.url))
  }
  return player
}

export function startMeadowBgm(): void {
  getPlayer().start()
}

export function setMeadowBgmMuted(muted: boolean): void {
  getPlayer().setMuted(muted)
}
