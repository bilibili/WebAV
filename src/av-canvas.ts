import { Rect, TCtrlKey } from './sprites/rect'
import { ESpriteManagerEvt, SpriteManager } from './sprites/sprite-manager'
import { draggabelSprite } from './sprites/sprite-op'
import { IResolution } from './types'
import { createEl } from './utils'

function createInitCvsEl (resolution: IResolution): HTMLCanvasElement {
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

  constructor (container: HTMLElement, opts: {
    resolution: IResolution
    bgColor: string
  }) {
    this.#cvsEl = createInitCvsEl(opts.resolution)
    const ctx = this.#cvsEl.getContext('2d', { alpha: false })
    if (ctx == null) throw Error('canvas context is null')
    this.#cvsCtx = ctx
    container.appendChild(this.#cvsEl)

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
      )
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

  destory (): void {
    this.#destroyed = true
    this.#cvsEl.remove()
    this.#clears.forEach(fn => fn())
  }

  captureStream (): MediaStream {
    const ms = new MediaStream()
    this.#cvsEl.captureStream().getTracks().concat(
      this.spriteManager.audioMSDest.stream.getTracks()
    ).forEach((t) => {
      ms.addTrack(t)
    })
    return ms
  }

  #render (): void {
    const cvsCtx = this.#cvsCtx
    const list = this.spriteManager.getSprites()
    list.forEach(r => r.render(cvsCtx))

    // todo: 使用dom替代canvas绘制控制点
    // 绘制 ctrls
    const actSpr = this.spriteManager.activeSprite
    if (actSpr == null) return
    cvsCtx.fillStyle = '#ffffff'
    const { center, ctrls, angle } = actSpr.rect
    cvsCtx.setTransform(
      // 水平 缩放、倾斜
      1, 0,
      // 垂直 倾斜、缩放
      0, 1,
      // 坐标原点偏移 x y
      center.x, center.y
    )
    cvsCtx.rotate(angle)
    Object.values(ctrls).forEach(({ x, y, w, h }) => {
      cvsCtx.fillRect(x, y, w, h)
    })
    cvsCtx.resetTransform()
  }
}

/**
 * 鼠标点击，激活 sprite
 */
function activeSprite (
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height
  }

  // 排在后面的层级更高
  let sprList = sprMng.getSprites().reverse()
  const offAddSpr = sprMng.on(ESpriteManagerEvt.AddSprite, () => {
    sprList = sprMng.getSprites().reverse()
  })

  const onCvsMouseDown = (evt: MouseEvent): void => {
    if (evt.button !== 0) return
    const { offsetX, offsetY } = evt
    const ofx = offsetX / cvsRatio.w
    const ofy = offsetY / cvsRatio.h
    if (sprMng.activeSprite != null) {
      const [ctrlKey] = Object.entries(sprMng.activeSprite.rect.ctrls)
        .find(([, rect]) => rect.checkHit(ofx, ofy)) as [TCtrlKey, Rect ] ?? []
      if (ctrlKey != null) return
    }
    sprMng.activeSprite = sprList.find(s => s.rect.checkHit(
      ofx,
      ofy
    )) ?? null
  }

  cvsEl.addEventListener('mousedown', onCvsMouseDown)

  return () => {
    offAddSpr()
    cvsEl.removeEventListener('mousedown', onCvsMouseDown)
  }
}
/**
 * 根据当前位置（sprite & ctrls），动态调整鼠标样式
 */
function dynamicCusor (
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height
  }

  let actSpr = sprMng.activeSprite
  sprMng.on(ESpriteManagerEvt.ActiveSpriteChange, (s) => {
    actSpr = s
    if (s == null) cvsEl.style.cursor = ''
  })
  // 鼠标按下时，在操作过程中，不需要变换鼠标样式
  let isMSDown = false
  const onDown = ({ offsetX, offsetY }: MouseEvent): void => {
    isMSDown = true
    // 将鼠标点击偏移坐标映射成 canvas 坐，
    const ofx = offsetX / cvsRatio.w
    const ofy = offsetY / cvsRatio.h
    // 直接选中 sprite 时，需要改变鼠标样式为 move
    if (actSpr?.rect.checkHit(ofx, ofy) === true) {
      cvsEl.style.cursor = 'move'
    }
  }
  const onUp = (): void => {
    isMSDown = false
  }

  // 八个 ctrl 点位对应的鼠标样式，构成循环
  const curStyles = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize']
  const curInitIdx = { t: 0, rt: 1, r: 2, rb: 3, b: 4, lb: 5, l: 6, lt: 7 }

  const onMove = (evt: MouseEvent): void => {
    // 按下之后，不在变化，因为可能是在拖拽控制点
    if (actSpr == null || isMSDown) return
    const { offsetX, offsetY } = evt
    const ofx = offsetX / cvsRatio.w
    const ofy = offsetY / cvsRatio.h
    const [ctrlKey] = Object.entries(actSpr.rect.ctrls)
      .find(([, rect]) => rect.checkHit(ofx, ofy)) as [TCtrlKey, Rect ] ?? []

    if (ctrlKey != null) {
      if (ctrlKey === 'rotate') {
        cvsEl.style.cursor = 'crosshair'
        return
      }
      // 旋转后，控制点的箭头指向也需要修正
      const angle = actSpr.rect.angle
      const oa = (angle < 0 ? angle + 2 * Math.PI : angle)
      // 每个控制点的初始样式（idx） + 旋转角度导致的偏移，即为新鼠标样式
      // 每旋转45°，偏移+1，以此在curStyles中循环
      const idx = (curInitIdx[ctrlKey] + Math.floor((oa + Math.PI / 8) / (Math.PI / 4))) % 8
      cvsEl.style.cursor = curStyles[idx]
      return
    }
    if (actSpr.rect.checkHit(ofx, ofy)) {
      cvsEl.style.cursor = 'move'
      return
    }
    // 未命中 ctrls、sprite，重置为默认鼠标样式
    cvsEl.style.cursor = ''
  }

  cvsEl.addEventListener('mousemove', onMove)
  cvsEl.addEventListener('mousedown', onDown)
  window.addEventListener('mouseup', onUp)

  return () => {
    cvsEl.removeEventListener('mousemove', onMove)
    cvsEl.removeEventListener('mousedown', onDown)
    window.removeEventListener('mouseup', onUp)
  }
}
