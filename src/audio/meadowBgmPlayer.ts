import { meadowPlaylistTracks } from '../config/meadowPlaylist'

const LOG_PREFIX = '[meadow-bgm]'

/**
 * HTML5 Audio playlist for Cosmic Lullaby — started on [ START ] user gesture.
 * Tracks load via `/meadow-assets` CDN rewrite; waits for `canplay` before play().
 */
class MeadowBgmPlayer {
  private readonly urls: readonly string[]
  private readonly audio: HTMLAudioElement
  private index = 0
  private started = false
  private muted = false
  private prepared = false

  constructor(urls: readonly string[]) {
    this.urls = urls
    this.audio = new Audio()
    this.audio.preload = 'auto'
    this.audio.crossOrigin = 'anonymous'

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

  /** Begin fetching track 1 during the loading screen (no play yet). */
  prepare(): void {
    if (this.prepared || this.urls.length === 0) return
    this.prepared = true
    this.audio.src = this.urls[0]!
    this.audio.load()
  }

  /** Call from [ START ] click — must run inside a user gesture. */
  start(): void {
    if (this.started) return
    this.started = true
    this.index = 0
    this.audio.muted = this.muted
    console.info(`${LOG_PREFIX} starting playlist (${this.urls.length} tracks)`)
    this.playIndex(0)
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.audio.muted = muted
  }

  private playIndex(nextIndex: number): void {
    if (this.urls.length === 0) return

    this.index = ((nextIndex % this.urls.length) + this.urls.length) % this.urls.length
    const url = this.urls[this.index]!

    const beginPlay = () => {
      this.audio.muted = this.muted
      const playPromise = this.audio.play()
      if (playPromise) {
        void playPromise
          .then(() => {
            console.info(`${LOG_PREFIX} playing`, url)
          })
          .catch((err: unknown) => {
            console.error(`${LOG_PREFIX} play() rejected for`, url, err)
            if (this.started) this.playIndex(this.index + 1)
          })
      }
    }

    if (this.audio.src !== new URL(url, window.location.origin).href) {
      this.audio.src = url
      this.audio.load()
    }

    if (this.audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      beginPlay()
      return
    }

    const onCanPlay = () => {
      this.audio.removeEventListener('canplay', onCanPlay)
      beginPlay()
    }
    this.audio.addEventListener('canplay', onCanPlay)
  }
}

let player: MeadowBgmPlayer | null = null

function getPlayer(): MeadowBgmPlayer {
  if (!player) {
    player = new MeadowBgmPlayer(meadowPlaylistTracks.map((t) => t.url))
  }
  return player
}

export function prepareMeadowBgm(): void {
  getPlayer().prepare()
}

export function startMeadowBgm(): void {
  getPlayer().start()
}

export function setMeadowBgmMuted(muted: boolean): void {
  getPlayer().setMuted(muted)
}
