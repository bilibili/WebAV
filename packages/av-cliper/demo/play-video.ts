export async function playOutputStream (stream: ReadableStream) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const stateEl = document.createElement('div')
  stateEl.textContent = 'processing...'
  container.appendChild(stateEl)

  const videoEl = document.createElement('video')
  videoEl.controls = true
  videoEl.autoplay = true
  videoEl.style.cssText = `
    width: 900px;
    height: 500px;
    display: block;
  `

  let timeStart = performance.now()
  videoEl.src = URL.createObjectURL(await new Response(stream).blob())
  stateEl.textContent = `cost: ${Math.round(performance.now() - timeStart)}ms`

  const closeEl = document.createElement('button')
  closeEl.textContent = 'close'
  closeEl.style.marginRight = '16px'

  const downloadEl = document.createElement('button')
  downloadEl.textContent = 'download'
  downloadEl.onclick = () => {
    const aEl = document.createElement('a')
    document.body.appendChild(aEl)
    aEl.setAttribute('href', videoEl.src)
    aEl.setAttribute('download', `WebAv-export-${Date.now()}.mp4`)
    aEl.setAttribute('target', '_self')
    aEl.click()
  }

  container.appendChild(closeEl)
  container.appendChild(downloadEl)
  container.appendChild(videoEl)

  const close = () => {
    container.remove()
    URL.revokeObjectURL(videoEl.src)
  }
  closeEl.onclick = close

  return close
}
