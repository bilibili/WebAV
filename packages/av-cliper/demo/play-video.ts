import { Combinator } from '../src'

export function playOutputStream (resourceList: string[], attachEl: Element) {
  const container = document.createElement('div')
  attachEl.appendChild(container)

  const resourceEl = document.createElement('div')
  resourceEl.innerHTML =
    `Resource:<br/>` +
    resourceList
      .map(str => `<a href="${str}" target="_blank">${str}</>`)
      .join('<br/>')
  container.appendChild(resourceEl)

  const stateEl = document.createElement('div')
  stateEl.textContent = 'loading...'
  container.appendChild(stateEl)

  const videoEl = document.createElement('video')
  videoEl.controls = true
  videoEl.autoplay = true
  videoEl.style.cssText = `
    width: 900px;
    height: 500px;
    display: block;
  `

  const btnContiner = document.createElement('div')
  container.appendChild(btnContiner)

  const closeEl = document.createElement('button')
  closeEl.textContent = 'close'
  closeEl.style.marginRight = '16px'

  btnContiner.appendChild(closeEl)
  container.appendChild(videoEl)

  return {
    loadStream: async (stream: ReadableStream, com?: Combinator) => {
      let closed = false
      closeEl.onclick = () => {
        closed = true
        com?.destroy()
        container.remove()
        URL.revokeObjectURL(videoEl.src)
      }

      let timeStart = performance.now()
      const src = await new Response(stream).blob()
      if (closed) return

      videoEl.src = URL.createObjectURL(src)
      stateEl.textContent = `cost: ${Math.round(
        performance.now() - timeStart
      )}ms`

      btnContiner.appendChild(createDownloadBtn(videoEl.src))
    },
    updateState: (desc: string) => {
      stateEl.textContent = desc
    }
  }
}

function createDownloadBtn (url: string) {
  const downloadEl = document.createElement('button')
  downloadEl.textContent = 'download'
  downloadEl.onclick = () => {
    const aEl = document.createElement('a')
    document.body.appendChild(aEl)
    aEl.setAttribute('href', url)
    aEl.setAttribute('download', `WebAv-export-${Date.now()}.mp4`)
    aEl.setAttribute('target', '_self')
    aEl.click()
  }
  return downloadEl
}
