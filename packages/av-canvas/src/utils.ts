// todo: 待合并
import mp4box, { TrakBoxParser } from 'mp4box'

export function createEl (tagName: string): HTMLElement {
  return document.createElement(tagName)
}

// track is H.264 or H.265.
export function parseVideoCodecDesc (track: TrakBoxParser): Uint8Array {
  for (const entry of track.mdia.minf.stbl.stsd.entries) {
    if ('avcC' in entry || 'hvcC ' in entry) {
      const stream = new mp4box.DataStream(
        undefined,
        0,
        mp4box.DataStream.BIG_ENDIAN
      )
      // @ts-expect-error
      const box = 'avcC' in entry ? entry.avcC : entry.hvcC
      box.write(stream)
      return new Uint8Array(stream.buffer, 8) // Remove the box header.
    }
  }
  throw Error('avcC or hvcC not found')
}

export async function sleep (time: number): Promise<void> {
  return await new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}
