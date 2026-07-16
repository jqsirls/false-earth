import { meadowPlaylistTracks } from '../config/meadowPlaylist'

const LOG_PREFIX = '[meadow-bgm]'

type PlaybackListener = (playing: boolean) => void
const playbackListeners = new Set<PlaybackListener>()

function notifyPlayback(playing: boolean): void {
  playbackListeners.forEach((listener) => listener(playing))
}

/** Wind ducking and UI sync — true when Cosmic Lullaby is audibly playing. */
export function subscribeMeadowBgmPlayback(listener: PlaybackListener): () => void {
  playbackListeners.add(listener)
  return () => {
    playbackListeners.delete(listener)
  }
}

/**
 * HTML5 Audio playlist for Cosmic Lullaby — started on [ START ] user gesture.
 * Tracks load via `/meadow-assets` CDN rewrite; START stays gated until track 1 can play.
 */
class MeadowBgmPlayer {
  private readonly urls: readonly string[]
  private readonly audio: HTMLAudioElement
  private index = 0
  private started = false
  private muted = false
  private prepared = false
  private firstTrackReady = false
  private prepareResolve: (() => void) | null = null
  private pendingCanPlay: (() => void) | null = null
  private playGeneration = 0

  constructor(urls: readonly string[]) {
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

  /** True when Cosmic Lullaby is audibly playing right now. */
  get isAudiblyPlaying(): boolean {
    return this.started && !this.muted && !this.audio.paused
  }

  /** Begin fetching track 1 during the loading screen (no play yet). */
  prepare(): void {
    if (this.prepared || this.urls.length === 0) return
    this.prepared = true

    const url = this.resolveSrc(this.urls[0]!)
    this.applyCrossOrigin(url)
    this.audio.src = url
    this.audio.load()

    const markReady = () => {
      if (this.firstTrackReady) return
      if (this.audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return
      this.firstTrackReady = true
      this.prepareResolve?.()
      this.prepareResolve = null
    }

    if (this.audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      markReady()
      return
    }

    const onReady = () => markReady()
    this.audio.addEventListener('canplaythrough', onReady, { once: true })
    this.audio.addEventListener('canplay', onReady, { once: true })
    this.audio.addEventListener(
      'error',
      () => {
        console.error(`${LOG_PREFIX} prepare failed for`, url)
        if (!this.firstTrackReady) {
          this.firstTrackReady = true
          this.prepareResolve?.()
          this.prepareResolve = null
        }
      },
      { once: true },
    )
  }

  /** Resolves when track 1 is buffered enough for a synchronous gesture play(). */
  whenFirstTrackReady(): Promise<void> {
    if (this.firstTrackReady) return Promise.resolve()
    if (!this.prepared) this.prepare()

    return new Promise((resolve) => {
      this.prepareResolve = resolve
      window.setTimeout(() => {
        if (this.firstTrackReady) return
        console.warn(`${LOG_PREFIX} first track slow — allowing START anyway`)
        this.firstTrackReady = true
        this.prepareResolve?.()
        this.prepareResolve = null
        resolve()
      }, 15_000)
    })
  }

  /** Call from [ START ] click — must run inside a user gesture. */
  start(): void {
    if (this.started) return
    this.started = true
    this.index = 0
    this.audio.muted = this.muted
    this.audio.volume = 1
    if (import.meta.env.DEV) {
      console.info(`${LOG_PREFIX} starting playlist (${this.urls.length} tracks)`)
    }
    this.playIndex(0, { fromUserGesture: true })
  }

  stop(): void {
    this.started = false
    notifyPlayback(false)
    this.clearPendingCanPlay()
    this.playGeneration += 1
    this.audio.pause()
    this.audio.currentTime = 0
    this.audio.removeAttribute('src')
    this.audio.load()
    this.prepared = false
    this.firstTrackReady = false
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.audio.muted = muted
    if (this.started) {
      notifyPlayback(!muted && !this.audio.paused)
    }
  }

  /** Soft pause (CTA handoff) — keeps the playlist position; resume via resumeIfPaused(). */
  pause(): void {
    if (!this.started || this.audio.paused) return
    this.audio.pause()
    notifyPlayback(false)
  }

  /** Resume a soft pause. Call from a user gesture so play() is never policy-blocked. */
  resumeIfPaused(): void {
    if (!this.started || !this.audio.paused) return
    this.audio.muted = this.muted
    const playPromise = this.audio.play()
    if (!playPromise) return
    void playPromise
      .then(() => notifyPlayback(!this.muted))
      .catch((err: unknown) => {
        console.warn(`${LOG_PREFIX} resume play() rejected`, err)
      })
  }

  private applyCrossOrigin(resolvedUrl: string): void {
    try {
      const origin = new URL(resolvedUrl).origin
      if (origin !== window.location.origin) {
        this.audio.crossOrigin = 'anonymous'
      } else {
        this.audio.removeAttribute('crossorigin')
      }
    } catch {
      this.audio.removeAttribute('crossorigin')
    }
  }

  private resolveSrc(url: string): string {
    return new URL(url, window.location.origin).href
  }

  private clearPendingCanPlay(): void {
    if (!this.pendingCanPlay) return
    this.audio.removeEventListener('canplay', this.pendingCanPlay)
    this.pendingCanPlay = null
  }

  private playIndex(nextIndex: number, options: { fromUserGesture?: boolean } = {}): void {
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
          if (import.meta.env.DEV) {
            console.info(`${LOG_PREFIX} playing`, url)
          }
          notifyPlayback(!this.muted)
        })
        .catch((err: unknown) => {
          const errorName = err instanceof Error ? err.name : ''
          if (errorName === 'NotAllowedError') {
            console.warn(`${LOG_PREFIX} play() blocked by autoplay policy`, url)
            return
          }
          if (this.audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            console.warn(`${LOG_PREFIX} play() before ready — waiting for canplay`, url)
            return
          }
          console.error(`${LOG_PREFIX} play() rejected for`, url, err)
          if (this.started && generation === this.playGeneration) {
            this.playIndex(this.index + 1)
          }
        })
    }

    if (needsLoad) {
      this.applyCrossOrigin(resolvedSrc)
      this.audio.src = resolvedSrc
      this.audio.load()
    }

    if (
      options.fromUserGesture ||
      this.audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      beginPlay()
    }

    if (this.audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
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

export function whenMeadowBgmPrepared(): Promise<void> {
  return getPlayer().whenFirstTrackReady()
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

export function pauseMeadowBgm(): void {
  getPlayer().pause()
}

export function resumeMeadowBgmIfPaused(): void {
  getPlayer().resumeIfPaused()
}

/** Readonly hook for programmatic production verification — same pattern as __MEADOW_EVENTS__. */
declare global {
  interface Window {
    __MEADOW_BGM__?: { readonly playing: boolean }
  }
}

if (typeof window !== 'undefined') {
  window.__MEADOW_BGM__ = {
    get playing() {
      return getPlayer().isAudiblyPlaying
    },
  }
}
