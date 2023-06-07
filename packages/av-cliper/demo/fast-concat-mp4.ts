import { Log } from '../src/log'
import { fastConcatMP4, mixinMP4AndAudio } from '../src/mp4-utils'
import { playOutputStream } from './play-video'

document.querySelector('#fast-concat-mp4')?.addEventListener('click', () => {
  ;(async () => {
    const resList = [
      './public/video/webav1.mp4',
      './public/video/webav2.mp4',
      './public/video/webav3.mp4'
    ]
    const stream = fastConcatMP4(
      await Promise.all(resList.map(async url => (await fetch(url)).body!))
    )
    playOutputStream(stream, resList, document.body)
  })().catch(Log.error)
})

document.querySelector('#mixin-mp4-audio')?.addEventListener('click', () => {
  ;(async () => {
    const resList = ['./public/video/0.mp4', './public/audio/44.1kHz-2chan.mp3']
    const outStream = mixinMP4AndAudio((await fetch(resList[0])).body!, {
      stream: (await fetch(resList[1])).body!,
      volume: 1,
      loop: true
    })
    playOutputStream(outStream, resList, document.body)
  })().catch(Log.error)
})

document.querySelector('#concat-and-mixin')?.addEventListener('click', () => {
  ;(async () => {
    const resList = [
      './public/video/webav1.mp4',
      './public/video/webav2.mp4',
      './public/audio/44.1kHz-2chan.mp3'
    ]
    const mp4Stream = fastConcatMP4([
      (await fetch(resList[0])).body!,
      (await fetch(resList[1])).body!
    ])
    const mp43Stream = mixinMP4AndAudio(mp4Stream, {
      stream: (await fetch(resList[2])).body!,
      volume: 1,
      loop: false
    })
    playOutputStream(mp43Stream, resList, document.body)
  })().catch(Log.error)
})
