import { Log, Rect, TCtrlKey } from '@webav/av-cliper'
import { renderCtrls } from './sprites/render-ctrl'
import { ESpriteManagerEvt, SpriteManager } from './sprites/sprite-manager'
import { activeSprite, draggabelSprite } from './sprites/sprite-op'
import { IResolution } from './types'
import { createEl } from './utils'

function createInitCvsEl(resolution: IResolution): HTMLCanvasElement {
  const cvsEl = createEl('canvas') as HTMLCanvasElement
  cvsEl.style.cssText = `
    width: 100%;
    height: 100%;
  `
  cvsEl.width = resolution.width
  cvsEl.height = resolution.height

  return cvsEl
}

export class AVCanvas {
  #cvsEl: HTMLCanvasElement

  spriteManager: SpriteManager

  #cvsCtx: CanvasRenderingContext2D

  #destroyed = false

  #clears: Array<() => void> = []

  constructor(container: HTMLElement, opts: {
    resolution: IResolution
    bgColor: string
  }) {
    this.#cvsEl = createInitCvsEl(opts.resolution)
    const ctx = this.#cvsEl.getContext('2d', { alpha: false })
    if (ctx == null) throw Error('canvas context is null')
    this.#cvsCtx = ctx
    container.appendChild(this.#cvsEl)

    Rect.CTRL_SIZE = 14 / (this.#cvsEl.clientWidth / this.#cvsEl.width)
    this.spriteManager = new SpriteManager()

    this.#clears.push(
      // 鼠标样式、控制 sprite 依赖 activeSprite，
      // activeSprite 需要在他们之前监听到 mousedown 事件 (代码顺序需要靠前)
      activeSprite(
        this.#cvsEl,
        this.spriteManager
      ),
      dynamicCusor(this.#cvsEl, this.spriteManager),
      draggabelSprite(
        this.#cvsEl,
        this.spriteManager
      ),
      renderCtrls(container, this.#cvsEl, this.spriteManager),
      this.spriteManager.on(ESpriteManagerEvt.AddSprite, (s) => {
        const { rect } = s
        // 默认居中
        if (rect.x === 0 && rect.y === 0) {
          rect.x = (this.#cvsEl.width - rect.w) / 2
          rect.y = (this.#cvsEl.height - rect.h) / 2
        }
      })
    )

    const loop = (): void => {
      if (this.#destroyed) return

      this.#cvsCtx.fillStyle = opts.bgColor
      this.#cvsCtx.fillRect(0, 0, opts.resolution.width, opts.resolution.height)
      this.#render()
      requestAnimationFrame(loop)
    }
    loop()

    // ;(window as any).cvsEl = this.#cvsEl
  }

  destroy(): void {
    this.#destroyed = true
    this.#cvsEl.remove()
    this.#clears.forEach(fn => fn())
    this.spriteManager.destroy()
  }

  captureStream(): MediaStream {
    const ms = new MediaStream()
    this.#cvsEl.captureStream().getTracks().concat(
      this.spriteManager.audioMSDest.stream.getTracks()
    ).forEach((t) => {
      ms.addTrack(t)
    })
    Log.info('AVCanvas.captureStream, tracks:', ms.getTracks().map(t => t.kind))
    return ms
  }

  #render(): void {
    const cvsCtx = this.#cvsCtx
    const list = this.spriteManager.getSprites()
    list.forEach(r => r.render(cvsCtx))

    cvsCtx.resetTransform()
  }
}

/**
 * 根据当前位置（sprite & ctrls），动态调整鼠标样式
 */
function dynamicCusor(
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height
  }

  const observer = new ResizeObserver(() => {
    cvsRatio.w = cvsEl.clientWidth / cvsEl.width
    cvsRatio.h = cvsEl.clientHeight / cvsEl.height
  })
  observer.observe(cvsEl)

  const cvsStyle = cvsEl.style

  let actSpr = sprMng.activeSprite
  sprMng.on(ESpriteManagerEvt.ActiveSpriteChange, (s) => {
    actSpr = s
    if (s == null) cvsStyle.cursor = ''
  })
  // 鼠标按下时，在操作过程中，不需要变换鼠标样式
  let isMSDown = false
  const onDown = ({ offsetX, offsetY }: MouseEvent): void => {
    isMSDown = true
    // 将鼠标点击偏移坐标映射成 canvas 坐，
    const ofx = offsetX / cvsRatio.w
    const ofy = offsetY / cvsRatio.h
    // 直接选中 sprite 时，需要改变鼠标样式为 move
    if (
      actSpr?.rect.checkHit(ofx, ofy) === true &&
      cvsStyle.cursor === ''
    ) {
      cvsStyle.cursor = 'move'
    }
  }
  const onWindowUp = (): void => {
    isMSDown = false
  }

  // 八个 ctrl 点位对应的鼠标样式，构成循环
  const curStyles = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize']
  const curInitIdx = { t: 0, rt: 1, r: 2, rb: 3, b: 4, lb: 5, l: 6, lt: 7 }

  const onMove = (evt: MouseEvent): void => {
    // 按下之后，不再变化，因为可能是在拖拽控制点
    if (actSpr == null || isMSDown) return
    const { offsetX, offsetY } = evt
    const ofx = offsetX / cvsRatio.w
    const ofy = offsetY / cvsRatio.h
    const [ctrlKey] = Object.entries(actSpr.rect.ctrls)
      .find(([, rect]) => rect.checkHit(ofx, ofy)) as [TCtrlKey, Rect] ?? []

    if (ctrlKey != null) {
      if (ctrlKey === 'rotate') {
        cvsStyle.cursor = 'crosshair'
        return
      }
      // 旋转后，控制点的箭头指向也需要修正
      const angle = actSpr.rect.angle
      const oa = (angle < 0 ? angle + 2 * Math.PI : angle)
      // 每个控制点的初始样式（idx） + 旋转角度导致的偏移，即为新鼠标样式
      // 每旋转45°，偏移+1，以此在curStyles中循环
      const idx = (curInitIdx[ctrlKey] + Math.floor((oa + Math.PI / 8) / (Math.PI / 4))) % 8
      cvsStyle.cursor = curStyles[idx]
      return
    }
    if (actSpr.rect.checkHit(ofx, ofy)) {
      cvsStyle.cursor = 'move'
      return
    }
    // 未命中 ctrls、sprite，重置为默认鼠标样式
    cvsStyle.cursor = ''
  }

  cvsEl.addEventListener('mousemove', onMove)
  cvsEl.addEventListener('mousedown', onDown)
  window.addEventListener('mouseup', onWindowUp)

  return () => {
    observer.disconnect()
    cvsEl.removeEventListener('mousemove', onMove)
    cvsEl.removeEventListener('mousedown', onDown)
    window.removeEventListener('mouseup', onWindowUp)
  }
}
