import mp4box, {
  AudioTrackOpts,
  MP4ABoxParser,
  MP4File,
  MP4Info,
  TrakBoxParser,
  VideoTrackOpts
} from '@webav/mp4box.js'
import { DEFAULT_AUDIO_CONF } from '../clips'

export function extractFileConfig(file: MP4File, info: MP4Info) {
  const vTrack = info.videoTracks[0]
  const rs: {
    videoTrackConf?: VideoTrackOpts
    videoDecoderConf?: Parameters<VideoDecoder['configure']>[0]
    audioTrackConf?: AudioTrackOpts
    audioDecoderConf?: Parameters<AudioDecoder['configure']>[0]
  } = {}
  if (vTrack != null) {
    const videoDesc = parseVideoCodecDesc(file.getTrackById(vTrack.id)).buffer
    const { descKey, type } = vTrack.codec.startsWith('avc1')
      ? { descKey: 'avcDecoderConfigRecord', type: 'avc1' }
      : vTrack.codec.startsWith('hvc1')
        ? { descKey: 'hevcDecoderConfigRecord', type: 'hvc1' }
        : { descKey: '', type: '' }
    if (descKey !== '') {
      rs.videoTrackConf = {
        timescale: vTrack.timescale,
        duration: vTrack.duration,
        width: vTrack.video.width,
        height: vTrack.video.height,
        brands: info.brands,
        type,
        [descKey]: videoDesc
      }
    }

    rs.videoDecoderConf = {
      codec: vTrack.codec,
      codedHeight: vTrack.video.height,
      codedWidth: vTrack.video.width,
      description: videoDesc
    }
  }

  const aTrack = info.audioTracks[0]
  if (aTrack != null) {
    rs.audioTrackConf = {
      timescale: aTrack.timescale,
      samplerate: aTrack.audio.sample_rate,
      channel_count: aTrack.audio.channel_count,
      hdlr: 'soun',
      type: aTrack.codec.startsWith('mp4a') ? 'mp4a' : aTrack.codec,
      description: getESDSBoxFromMP4File(file)
    }
    rs.audioDecoderConf = {
      codec: aTrack.codec.startsWith('mp4a')
        ? DEFAULT_AUDIO_CONF.codec
        : aTrack.codec,
      numberOfChannels: aTrack.audio.channel_count,
      sampleRate: aTrack.audio.sample_rate
    }
  }
  return rs
}

// track is H.264, H.265 or VPX.
function parseVideoCodecDesc(track: TrakBoxParser): Uint8Array {
  for (const entry of track.mdia.minf.stbl.stsd.entries) {
    // @ts-expect-error
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC
    if (box != null) {
      const stream = new mp4box.DataStream(
        undefined,
        0,
        mp4box.DataStream.BIG_ENDIAN
      )
      box.write(stream)
      return new Uint8Array(stream.buffer.slice(8)) // Remove the box header.
    }
  }
  throw Error('avcC, hvcC or VPX not found')
}

function getESDSBoxFromMP4File(file: MP4File, codec = 'mp4a') {
  const mp4aBox = file.moov?.traks
    .map(t => t.mdia.minf.stbl.stsd.entries)
    .flat()
    .find(({ type }) => type === codec) as MP4ABoxParser

  return mp4aBox?.esds
}

export function sample2ChunkOpts(s: {
  is_sync: boolean
  cts: number
  timescale: number
  duration: number
  data: ArrayBuffer
}): EncodedAudioChunkInit | EncodedVideoChunkInit {
  return {
    type: (s.is_sync ? 'key' : 'delta') as EncodedVideoChunkType,
    timestamp: (1e6 * s.cts) / s.timescale,
    duration: (1e6 * s.duration) / s.timescale,
    data: s.data
  }
}
