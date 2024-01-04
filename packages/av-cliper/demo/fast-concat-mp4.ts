import { Log } from '../src/log'
import { fastConcatMP4, mixinMP4AndAudio } from '../src/mp4-utils'
import { playOutputStream } from './play-video'

document.querySelector('#fast-concat-mp4')?.addEventListener('click', () => {
  ; (async () => {
    const resList = ['./video/webav1.mp4', './video/webav2.mp4']
    const stream = await fastConcatMP4(
      await Promise.all(resList.map(async url => (await fetch(url)).body!))
    )
    const { loadStream } = playOutputStream(resList, document.body)
    await loadStream(stream)
  })().catch(Log.error)
})

document.querySelector('#mixin-mp4-audio')?.addEventListener('click', () => {
  ; (async () => {
    const resList = [
      './video/webav1.mp4',
      './audio/44.1kHz-2chan.mp3'
    ]
    const stream = mixinMP4AndAudio((await fetch(resList[0])).body!, {
      stream: (await fetch(resList[1])).body!,
      volume: 1,
      loop: true
    })
    const { loadStream } = playOutputStream(resList, document.body)
    await loadStream(stream)
  })().catch(Log.error)
})

document.querySelector('#concat-and-mixin')?.addEventListener('click', () => {
  ; (async () => {
    const resList = [
      './video/webav1.mp4',
      './video/webav2.mp4',
      './audio/44.1kHz-2chan.mp3'
    ]
    const mp4Stream = await fastConcatMP4([
      (await fetch(resList[0])).body!,
      (await fetch(resList[1])).body!
    ])
    const stream = mixinMP4AndAudio(mp4Stream, {
      stream: (await fetch(resList[2])).body!,
      volume: 1,
      loop: false
    })
    const { loadStream } = playOutputStream(resList, document.body)
    await loadStream(stream)
  })().catch(Log.error)
})
