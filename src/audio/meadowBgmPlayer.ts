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
  private pendingCanPlay: (() => void) | null = null
  private playGeneration = 0

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
    this.audio.volume = 1
    console.info(`${LOG_PREFIX} starting playlist (${this.urls.length} tracks)`)
    this.playIndex(0, { eager: true })
  }

  stop(): void {
    this.started = false
    this.clearPendingCanPlay()
    this.playGeneration += 1
    this.audio.pause()
    this.audio.currentTime = 0
    this.audio.removeAttribute('src')
    this.audio.load()
    this.prepared = false
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.audio.muted = muted
  }

  private resolveSrc(url: string): string {
    return new URL(url, window.location.origin).href
  }

  private clearPendingCanPlay(): void {
    if (!this.pendingCanPlay) return
    this.audio.removeEventListener('canplay', this.pendingCanPlay)
    this.pendingCanPlay = null
  }

  private playIndex(nextIndex: number, options: { eager?: boolean } = {}): void {
    if (this.urls.length === 0 || !this.started) return

    this.clearPendingCanPlay()
    this.audio.pause()

    const targetIndex = ((nextIndex % this.urls.length) + this.urls.length) % this.urls.length
    const url = this.urls[targetIndex]!
    const resolvedSrc = this.resolveSrc(url)
    const needsLoad = this.audio.src !== resolvedSrc
    const generation = ++this.playGeneration

    this.index = targetIndex

    const beginPlay = () => {
      if (!this.started || generation !== this.playGeneration || this.index !== targetIndex) {
        return
      }

      this.audio.muted = this.muted
      this.audio.volume = 1
      const playPromise = this.audio.play()
      if (!playPromise) return

      void playPromise
        .then(() => {
          if (generation !== this.playGeneration) return
          console.info(`${LOG_PREFIX} playing`, url)
        })
        .catch((err: unknown) => {
          console.error(`${LOG_PREFIX} play() rejected for`, url, err)
          if (this.started && generation === this.playGeneration) {
            this.playIndex(this.index + 1)
          }
        })
    }

    if (needsLoad) {
      this.audio.src = url
      this.audio.load()
    }

    if (options.eager) {
      beginPlay()
    }

    if (!needsLoad && this.audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      beginPlay()
      return
    }

    const onCanPlay = () => {
      this.clearPendingCanPlay()
      beginPlay()
    }

    this.pendingCanPlay = onCanPlay
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

export function stopMeadowBgm(): void {
  getPlayer().stop()
}

export function setMeadowBgmMuted(muted: boolean): void {
  getPlayer().setMuted(muted)
}
