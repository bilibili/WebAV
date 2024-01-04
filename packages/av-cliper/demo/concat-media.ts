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
  ; (async () => {
    if (!(await Combinator.isSupported())) {
      alert('Your browser does not support WebCodecs')
    }
  })()

const playerContiner = document.querySelector('#player-continer')!

document.querySelector('#mp4-img')?.addEventListener('click', () => {
  ; (async () => {
    const resList = ['./video/webav1.mp4', './img/bunny.png']
    const { loadStream } = playOutputStream(resList, playerContiner)

    const spr1 = new OffscreenSprite(
      'spr1',
      new MP4Clip((await fetch(resList[0])).body!)
    )

    const spr2 = new OffscreenSprite(
      'spr2',
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

    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#mp4-mp3')?.addEventListener('click', () => {
  ; (async () => {
    const resList = [
      './video/webav1.mp4',
      './audio/44.1kHz-2chan.mp3'
    ]
    const { loadStream } = playOutputStream(resList, playerContiner)

    // const resp1 = await fetch('./video/pri-bunny_avc_frag.mp4')
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

    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#mix-audio')?.addEventListener('click', () => {
  ; (async () => {
    const resList = [
      './audio/44.1kHz-2chan.m4a',
      './audio/16kHz-1chan.mp3'
    ]
    const { loadStream } = playOutputStream(resList, playerContiner)

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

    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#concat-audio')?.addEventListener('click', () => {
  ; (async () => {
    const resList = [
      './audio/16kHz-1chan.mp3',
      './audio/44.1kHz-2chan.m4a'
    ]
    const { loadStream } = playOutputStream(resList, playerContiner)

    const clip = await concatAudioClip(
      await Promise.all(
        resList.map(async url => new AudioClip((await fetch(url)).body!))
      )
    )
    const spr1 = new OffscreenSprite('1', clip)

    const com = new Combinator({ width: 1280, height: 720 })
    await com.add(spr1, { offset: 0, duration: 30 })

    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#gif-m4a')?.addEventListener('click', () => {
  ; (async () => {
    const resList = [
      './img/animated.gif',
      './audio/44.1kHz-2chan.m4a'
    ]
    const { loadStream } = playOutputStream(resList, playerContiner)

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

    await loadStream(com.output(), com)
  })()
})

document.querySelector('#mp4-srt')?.addEventListener('click', () => {
  ; (async () => {
    const resList = [
      './video/webav1.mp4',
      './subtitles/test-sample.srt'
    ]
    const { loadStream } = playOutputStream(resList, playerContiner)

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
        strokeStyle: '#000',
        lineWidth: 20,
        lineJoin: 'round',
        lineCap: 'round',
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

    await loadStream(com.output(), com)
  })()
})

document.querySelector('#mp4-chromakey')?.addEventListener('click', () => {
  ; (async () => {
    const resList = [
      './video/chromakey-test.mp4',
      './img/bunny.png'
    ]
    const { loadStream } = playOutputStream(resList, playerContiner)

    const width = 1280
    const height = 720

    const chromakey = createChromakey({
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.1,
    })
    const originSpr = new OffscreenSprite(
      'originSpr',
      new MP4Clip((await fetch(resList[0])).body!)
    )
    await originSpr.ready
    originSpr.zIndex = 1
    originSpr.rect.x = (width - originSpr.rect.w * 2 - 100) / 2
    originSpr.rect.y = (height - originSpr.rect.h) / 2

    const targetClip = new MP4Clip((await fetch(resList[0])).body!)
    targetClip.tickInterceptor = async (_, tickRet) => {
      if (tickRet.video == null) return tickRet
      return {
        ...tickRet,
        video: await chromakey(tickRet.video)
      }
    }

    const targetSpr = new OffscreenSprite('targetSpr', targetClip)
    await targetSpr.ready
    targetSpr.zIndex = 1
    targetSpr.rect.x = originSpr.rect.x + targetSpr.rect.w + 100
    targetSpr.rect.y = (height - targetSpr.rect.h) / 2

    const bgImgSpr = new OffscreenSprite(
      'bgImgSpr',
      new ImgClip(
        await createImageBitmap(await (await fetch(resList[1])).blob())
      )
    )

    const com = new Combinator({
      width,
      height,
      bgColor: 'white'
    })

    await com.add(originSpr, { main: true })
    await com.add(targetSpr)
    await com.add(bgImgSpr)

    await loadStream(com.output(), com)
  })().catch(Log.error)
})

document.querySelector('#complex')?.addEventListener('click', () => {
  ; (async () => {
    const mp4List = [
      './video/123.mp4',
      './video/223.mp4',
      './video/323.mp4'
    ]

    const width = 1280
    const height = 720

    const chromakey = createChromakey({
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.1,
    })

    // Remove background, add bunny as new background, composite video
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
      .map(async (spr, idx) => {
        const com = new Combinator({ width, height })
        const imgSpr = new OffscreenSprite(
          'spr3',
          new ImgClip(
            await createImageBitmap(
              await (await fetch('./img/bunny.png')).blob()
            )
          )
        )
        await spr.ready
        spr.rect.x = idx * spr.rect.w
        await com.add(imgSpr)
        await com.add(spr, { main: true })
        return com.output()
      })

    const { loadStream } = playOutputStream(mp4List, playerContiner)

    // then concat multiple videos
    await loadStream(await fastConcatMP4(await Promise.all(coms)))
  })().catch(Log.error)
})
