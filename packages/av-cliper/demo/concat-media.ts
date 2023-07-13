import { AudioClip, ImgClip, MP4Clip, concatAudioClip } from '../src/clips'
import { Combinator } from '../src/combinator'
import { Log } from '../src/log'
import { OffscreenSprite } from '../src/offscreen-sprite'
import { renderTxt2ImgBitmap } from '../src/dom-utils'
import { EmbedSubtitlesClip } from '../src/clips/embed-subtitles-clip'
import { playOutputStream } from './play-video'
import { createChromakey, fastConcatMP4 } from '../src'

// const cvs = document.querySelector('canvas') as HTMLCanvasElement
// const ctx = cvs.getContext('2d')!

const playerContiner = document.querySelector('#player-continer')!

document.querySelector('#mp4-img')?.addEventListener('click', () => {
  ;(async () => {
    const resList = ['./public/video/webav1.mp4', './public/img/bunny.png']
    const { updateState, loadStream } = playOutputStream(
      resList,
      playerContiner
    )

    const spr1 = new OffscreenSprite(
      'spr1',
      new MP4Clip((await fetch(resList[0])).body!)
    )

    const spr2 = new OffscreenSprite(
      'spr4',
      new ImgClip(
        await renderTxt2ImgBitmap(
          '水印',
          `font-size:40px; color: white; text-shadow: 2px 2px 6px red;`
        )
      )
    )
    spr2.setAnimation(
      {
        '0%': { x: 0, y: 0 },
        '25%': { x: 1200, y: 680 },
        '50%': { x: 1200, y: 0 },
        '75%': { x: 0, y: 680 },
        '100%': { x: 0, y: 0 }
      },
      { duration: 4, iterCount: 1 }
    )
    spr2.zIndex = 10
    spr2.opacity = 0.5

    const spr3 = new OffscreenSprite(
      'spr3',
      new ImgClip(
        await createImageBitmap(await (await fetch(resList[1])).blob())
      )
    )
    // 初始旋转 180°
    spr3.rect.angle = Math.PI
    spr3.setAnimation(
      {
        from: { angle: Math.PI, x: 0, y: 0, opacity: 1 },
        to: { angle: Math.PI * 2, x: 300, y: 300, opacity: 0 }
      },
      { duration: 3 }
    )

    const com = new Combinator({
      width: 1280,
      height: 720,
      bgColor: 'white'
    })

    await com.add(spr1, { main: true })
    await com.add(spr2, { offset: 0, duration: 5 })
    await com.add(spr3)

    com.on('OutputProgress', v => {
      console.log('----- progress:', v)
      updateState(`progress: ${Math.round(v * 100)}%`)
    })
    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#mp4-mp3')?.addEventListener('click', () => {
  ;(async () => {
    const resList = [
      './public/video/webav1.mp4',
      './public/audio/44.1kHz-2chan.mp3'
    ]
    const { updateState, loadStream } = playOutputStream(
      resList,
      playerContiner
    )

    // const resp1 = await fetch('./public/video/pri-bunny_avc_frag.mp4')
    const resp1 = await fetch(resList[0])
    const spr1 = new OffscreenSprite('spr1', new MP4Clip(resp1.body!))

    const resp2 = await fetch(resList[1])
    const spr2 = new OffscreenSprite(
      'spr2',
      new AudioClip(resp2.body!, {
        // volume: 2,
        loop: true
      })
    )
    const com = new Combinator({
      width: 1280,
      height: 720
    })
    await com.add(spr1, { duration: 10, main: true })
    await com.add(spr2)

    com.on('OutputProgress', v => {
      console.log('----- progress:', v)
      updateState(`progress: ${Math.round(v * 100)}%`)
    })
    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#mix-audio')?.addEventListener('click', () => {
  ;(async () => {
    const resList = [
      './public/audio/44.1kHz-2chan.m4a',
      './public/audio/16kHz-1chan.mp3'
    ]
    const { updateState, loadStream } = playOutputStream(
      resList,
      playerContiner
    )

    const resp1 = await fetch(resList[0])
    const resp2 = await fetch(resList[1])
    const spr1 = new OffscreenSprite(
      '1',
      new AudioClip(resp1.body!, { volume: 0.5 })
    )
    const spr2 = new OffscreenSprite('2', new AudioClip(resp2.body!))

    const com = new Combinator({ width: 1280, height: 720 })
    await com.add(spr1, { offset: 0, duration: 5 })
    await com.add(spr2, { offset: 0, duration: 4 })

    com.on('OutputProgress', v => {
      console.log('----- progress:', v)
      updateState(`progress: ${Math.round(v * 100)}%`)
    })
    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#concat-audio')?.addEventListener('click', () => {
  ;(async () => {
    const resList = [
      './public/audio/16kHz-1chan.mp3',
      './public/audio/44.1kHz-2chan.m4a'
    ]
    const { updateState, loadStream } = playOutputStream(
      resList,
      playerContiner
    )

    const clip = await concatAudioClip(
      await Promise.all(
        resList.map(async url => new AudioClip((await fetch(url)).body!))
      )
    )
    const spr1 = new OffscreenSprite('1', clip)

    const com = new Combinator({ width: 1280, height: 720 })
    await com.add(spr1, { offset: 0, duration: 30 })

    com.on('OutputProgress', v => {
      console.log('----- progress:', v)
      updateState(`progress: ${Math.round(v * 100)}%`)
    })
    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#gif-m4a')?.addEventListener('click', () => {
  ;(async () => {
    const resList = [
      './public/img/animated.gif',
      './public/audio/44.1kHz-2chan.m4a'
    ]
    const { updateState, loadStream } = playOutputStream(
      resList,
      playerContiner
    )

    const resp1 = await fetch(resList[0])
    const spr1 = new OffscreenSprite(
      's1',
      new ImgClip({ type: 'image/gif', stream: resp1.body! })
    )
    const resp2 = await fetch(resList[1])
    const spr2 = new OffscreenSprite('s2', new AudioClip(resp2.body!))
    const com = new Combinator({ width: 1280, height: 720 })
    await com.add(spr1, { duration: 10, offset: 0 })
    await com.add(spr2, { duration: 10, offset: 0 })

    com.on('OutputProgress', v => {
      console.log('----- progress:', v)
      updateState(`progress: ${Math.round(v * 100)}%`)
    })
    await loadStream(com.output(), com)
  })()
})

document.querySelector('#mp4-srt')?.addEventListener('click', () => {
  ;(async () => {
    const resList = [
      './public/video/webav1.mp4',
      './public/subtitles/test-sample.srt'
    ]
    const { updateState, loadStream } = playOutputStream(
      resList,
      playerContiner
    )

    const resp1 = await fetch(resList[0])
    const spr1 = new OffscreenSprite('s1', new MP4Clip(resp1.body!))
    const resp2 = await fetch(resList[1])
    const spr2 = new OffscreenSprite(
      's2',
      new EmbedSubtitlesClip(await resp2.text(), {
        videoWidth: 1280,
        videoHeight: 720,
        fontSize: 44,
        fontFamily: 'Noto Sans SC',
        stroke: {
          color: '#000'
        },
        textShadow: {
          offsetX: 2,
          offsetY: 2,
          blur: 4,
          color: 'rgba(0,0,0,0.25)'
        }
      })
    )
    const com = new Combinator({ width: 1280, height: 720 })
    await com.add(spr1, { duration: 10, offset: 0 })
    await com.add(spr2, { duration: 10, offset: 0 })

    com.on('OutputProgress', v => {
      console.log('----- progress:', v)
      updateState(`progress: ${Math.round(v * 100)}%`)
    })
    await loadStream(com.output(), com)
  })()
})

document.querySelector('#mp4-chromakey')?.addEventListener('click', () => {
  ;(async () => {
    const resList = [
      './public/video/chromakey-test.mp4',
      './public/img/bunny.png'
    ]
    const { updateState, loadStream } = playOutputStream(
      resList,
      playerContiner
    )

    const width = 1280
    const height = 720

    const chromakey = createChromakey()
    const clip = new MP4Clip((await fetch(resList[0])).body!)
    clip.tickInterceptor = async (_, tickRet) => {
      if (tickRet.video == null) return tickRet
      return {
        ...tickRet,
        video: await chromakey(tickRet.video)
      }
    }

    const spr1 = new OffscreenSprite('spr1', clip)
    await spr1.ready
    spr1.zIndex = 1
    spr1.rect.x = (width - spr1.rect.w) / 2
    spr1.rect.y = (height - spr1.rect.h) / 2

    const spr2 = new OffscreenSprite(
      'spr3',
      new ImgClip(
        await createImageBitmap(await (await fetch(resList[1])).blob())
      )
    )

    const com = new Combinator({
      width,
      height,
      bgColor: 'white'
    })

    await com.add(spr1, { main: true })
    await com.add(spr2)

    com.on('OutputProgress', v => {
      console.log('----- progress:', v)
      updateState(`progress: ${Math.round(v * 100)}%`)
    })
    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#complex')?.addEventListener('click', () => {
  ;(async () => {
    const mp4List = [
      './public/video/123.mp4',
      './public/video/223.mp4',
      './public/video/323.mp4'
    ]

    const width = 1280
    const height = 720

    const chromakey = createChromakey()

    const coms = (
      await Promise.all(mp4List.map(async vurl => (await fetch(vurl)).body!))
    )
      .map(sbody => {
        const clip = new MP4Clip(sbody)
        clip.tickInterceptor = async (_, tickRet) => {
          // console.log(2222, _, tickRet)
          if (tickRet.video == null) return tickRet
          return {
            ...tickRet,
            video: await chromakey(tickRet.video)
          }
        }
        return clip
      })
      .map(clip => new OffscreenSprite('spr', clip))
      .map(async spr => {
        const com = new Combinator({ width, height })
        const imgSpr = new OffscreenSprite(
          'spr3',
          new ImgClip(
            await createImageBitmap(
              await (await fetch('./public/img/bunny.png')).blob()
            )
          )
        )
        await com.add(imgSpr)
        await com.add(spr, { main: true })
        return com.output()
      })

    const { loadStream } = playOutputStream(mp4List, playerContiner)

    await loadStream(fastConcatMP4(await Promise.all(coms)))
  })().catch(Log.error)
})
