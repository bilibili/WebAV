import { MP4Clip } from '../src/clips'
  ; (async () => {
    const resp1 = await fetch('./video/123.mp4')
    const clip = new MP4Clip(resp1.body!)
    await clip.ready
    let time = 0
    while (true) {
      const { state, video, audio } = await clip.tick(time)
      console.log('worker decode', { time, video, audio, state })
      if (state === 'done') break
      if (video != null && state === 'success') {
        video.close()
      }
      time += 33000
    }
    clip.destroy()
  })()
