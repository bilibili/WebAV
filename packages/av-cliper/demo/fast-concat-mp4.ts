import { Log } from '../src/log'
import { fastConcatMP4, mixinMP4AndAudio } from '../src/mp4-utils'
import { playOutputStream } from './play-video'

document.querySelector('#fast-concat-mp4')?.addEventListener('click', () => {
  ;(async () => {
    const stream = fastConcatMP4([
      (await fetch('./public/video/webav1.mp4')).body!,
      (await fetch('./public/video/webav2.mp4')).body!,
      (await fetch('./public/video/webav3.mp4')).body!
    ])
    playOutputStream(stream)
  })().catch(Log.error)
})

document.querySelector('#mixin-mp4-audio')?.addEventListener('click', () => {
  ;(async () => {
    const outStream = mixinMP4AndAudio(
      (await fetch('./public/video/0.mp4')).body!,
      {
        stream: (await fetch('./public/audio/44.1kHz-2chan.mp3')).body!,
        volume: 1,
        loop: true
      }
    )
    playOutputStream(outStream)
  })().catch(Log.error)
})

document.querySelector('#concat-and-mixin')?.addEventListener('click', () => {
  ;(async () => {
    const mp4Stream = fastConcatMP4([
      (await fetch('./public/video/webav1.mp4')).body!,
      (await fetch('./public/video/webav2.mp4')).body!
    ])
    const mp43Stream = mixinMP4AndAudio(mp4Stream, {
      stream: (await fetch('./public/audio/44.1kHz-2chan.mp3')).body!,
      volume: 1,
      loop: false
    })
    playOutputStream(mp43Stream)
  })().catch(Log.error)
})
