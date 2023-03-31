export async function mediaStream2Video (
  stream: MediaStream
): Promise<HTMLVideoElement> {
  const video = document.createElement('video')

  let timer: number

  video.srcObject = stream

  return await new Promise((resolve, reject) => {
    let failed = false
    video.addEventListener('loadedmetadata', () => {
      if (failed) return
      clearTimeout(timer)
      video.play()
        .then(() => resolve(video))
        .catch(reject)
    })
    timer = window.setTimeout(() => {
      failed = true
      reject(new Error('video load failed'))
    }, 2000)
  })
}

export function createEl (tagName: string): HTMLElement {
  return document.createElement(tagName)
}
