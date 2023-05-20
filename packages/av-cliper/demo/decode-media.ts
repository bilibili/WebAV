import { decodeImg } from '../src/av-utils'
import { AudioClip, DEFAULT_AUDIO_SAMPLE_RATE, MP4Clip } from '../src/clips'
import { Log } from '../src/log'

const cvs = document.querySelector('canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d')!

document.querySelector('#decode-frame')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./public/alpha-hevc.mp4')
    const clip = new MP4Clip(resp1.body as ReadableStream)
    await clip.ready
    let time = 0
    while (true) {
      const { state, video } = await clip.tick(time)
      if (state === 'done') break
      if (video != null && state === 'success') {
        ctx.drawImage(video, 0, 0, video.codedWidth, video.codedHeight)
        video.close()
      }
      time += 40000
    }
    clip.destroy()
  })().catch(Log.error)
})

const imgs = {
  'image/avif': './public/imgs/animated.avif',
  'image/webp': './public/imgs/animated.webp',
  'image/png': './public/imgs/animated.png',
  'image/gif': './public/imgs/animated.gif'
}

document.querySelector('#decode-img')?.addEventListener('click', () => {
  ;(async () => {
    const imgType = (
      document.querySelector('input[name=img-type]:checked') as HTMLInputElement
    ).value

    // @ts-expect-error
    const resp1 = await fetch(imgs[imgType])
    const frames = await decodeImg(resp1.body!, imgType)

    let i = 0
    function render (vf: VideoFrame) {
      if (vf == null) return
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      ctx.drawImage(vf, 0, 0)
      setTimeout(() => {
        render(frames[++i])
      }, (vf.duration ?? 0) / 1000)
    }
    render(frames[0])
  })()
})

const audios = {
  '44.1kHz-2chan.m4a': './public/audio/44.1kHz-2chan.m4a',
  '44.1kHz-2chan.mp3': './public/audio/44.1kHz-2chan.mp3',
  '16kHz-1chan.mp3': './public/audio/16kHz-1chan.mp3'
}

let stopAudio = () => {}
document.querySelector('#decode-audio')?.addEventListener('click', () => {
  ;(async () => {
    stopAudio()
    const audioType = (
      document.querySelector(
        'input[name=audio-type]:checked'
      ) as HTMLInputElement
    ).value
    // @ts-expect-error
    const resp1 = await fetch(audios[audioType])
    const clip = new AudioClip(await resp1.arrayBuffer())
    await clip.ready
    const ctx = new AudioContext()
    let time = 0
    async function play () {
      const { audio, state } = await clip.tick(time)
      time += 100000
      if (state === 'done') {
        console.log('--- ended')
        return
      }
      const len = audio[0].length
      if (len === 0) {
        play()
        return
      }

      const buf = ctx.createBuffer(2, len, DEFAULT_AUDIO_SAMPLE_RATE)
      buf.copyToChannel(audio[0], 0)
      buf.copyToChannel(audio[1], 1)
      const source = ctx.createBufferSource()
      source.buffer = buf
      source.connect(ctx.destination)
      source.onended = play
      source.start()
      stopAudio = () => {
        source.onended = null
        source.disconnect()
      }
    }
    play()
  })()
})
