import { MEADOW_PLAYLIST_TRACKS } from './meadow'

export type MeadowPlaylistTrack = {
  id: string
  url: string
  volume?: number
  detune?: number
}

export const meadowPlaylistTracks: MeadowPlaylistTrack[] = MEADOW_PLAYLIST_TRACKS.map(
  (track) => ({ ...track }),
)
