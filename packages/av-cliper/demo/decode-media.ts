import { decodeImg, sleep } from '../src/av-utils'
import { AudioClip, DEFAULT_AUDIO_SAMPLE_RATE, MP4Clip } from '../src/clips'
import { EmbedSubtitles } from '../src/clips/embed-subtitles'
import { Log } from '../src/log'

const cvs = document.querySelector('canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d')!

const imgs = {
  'image/avif': './public/img/animated.avif',
  'image/webp': './public/img/animated.webp',
  'image/png': './public/img/animated.png',
  'image/gif': './public/img/animated.gif'
}

let stopImg = () => {}
document.querySelector('#decode-img')?.addEventListener('click', () => {
  ;(async () => {
    stopImg()
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
      const timer = setTimeout(() => {
        render(frames[++i])
      }, (vf.duration ?? 0) / 1000)
      stopImg = () => {
        clearTimeout(timer)
      }
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
    const clip = new AudioClip(resp1.body!)
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

const videos = {
  'alpha-hevc.mp4': './public/video/alpha-hevc.mp4',
  'bear-vp9.mp4': './public/video/bear-vp9.mp4'
}
document.querySelector('#decode-video')?.addEventListener('click', () => {
  ;(async () => {
    const videoType = (
      document.querySelector(
        'input[name=video-type]:checked'
      ) as HTMLInputElement
    ).value
    // @ts-expect-error
    const resp1 = await fetch(videos[videoType])
    const clip = new MP4Clip(resp1.body!)
    await clip.ready
    let time = 0
    while (true) {
      const { state, video } = await clip.tick(time)
      if (state === 'done') break
      if (video != null && state === 'success') {
        ctx.clearRect(0, 0, cvs.width, cvs.height)
        ctx.drawImage(video, 0, 0, video.codedWidth, video.codedHeight)
        video.close()
      }
      time += 40000
    }
    clip.destroy()
  })().catch(Log.error)
})

const subtitles = {
  'test-sample.srt': './public/subtitles/test-sample.srt'
}
document.querySelector('#decode-subtitles')?.addEventListener('click', () => {
  ;(async () => {
    stopImg()
    const subtitlesType = (
      document.querySelector(
        'input[name=subtitles-type]:checked'
      ) as HTMLInputElement
    ).value

    // @ts-expect-error
    const resp1 = await fetch(subtitles[subtitlesType])

    const es = new EmbedSubtitles(await resp1.text(), {
      fontSize: 80,
      color: 'yellow'
    })

    let time = 0
    while (time < 20 * 1e6) {
      const { state, video } = await es.tick(time)
      if (state === 'done') break
      ctx.clearRect(0, 0, cvs.width, cvs.height)
      ctx.drawImage(video!, 0, 0)
      video?.close()
      time += 33000
      await sleep(10)
    }
    console.log('decode subtitles done')
    es.destroy()
  })()
})

// 测试解码、重编码性能
// document.querySelector('#decode-video')?.addEventListener('click', () => {
//   ;(async () => {
//     const videoType = (
//       document.querySelector(
//         'input[name=video-type]:checked'
//       ) as HTMLInputElement
//     ).value
//     // @ts-expect-error
//     const resp1 = await fetch(videos[videoType])
//     const clip = new MP4Clip(resp1.body!)
//     await clip.ready
//     let time = 0
//     const cvs = new OffscreenCanvas(1280, 720)
//     const ctx = cvs.getContext('2d')!
//     const recoder = recodemux({
//       video: {
//         width: 1280,
//         height: 720,
//         expectFPS: 30
//       },
//       audio: {
//         codec: 'aac',
//         sampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
//         sampleSize: 16,
//         channelCount: 2
//       },
//       bitrate: 1_500_000
//     })
//     console.time('decode')
//     console.time('encode')
//     while (time < 3 * 60 * 1e6) {
//       const { state, video } = await clip.tick(time)
//       if (state === 'done') break
//       if (video != null && state === 'success') {
//         // ctx.clearRect(0, 0, cvs.width, cvs.height)
//         ctx.drawImage(video, 0, 0, video.codedWidth, video.codedHeight)
//         recoder.encodeVideo(
//           new VideoFrame(cvs, {
//             duration: 33000,
//             timestamp: time
//           })
//         )
//         video.close()
//       }
//       time += 33 * 1000
//     }
//     console.timeEnd('decode')
//     recoder.onEnded = () => {
//       console.timeEnd('encode')
//     }
//     clip.destroy()
//   })().catch(Log.error)
// })
