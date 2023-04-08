import { ICvsRatio, IPoint } from '../types'
import { createEl } from '../utils'
import { BaseSprite } from './base-sprite'
import { CTRL_KEYS, TCtrlKey } from './rect'
import { ESpriteManagerEvt, SpriteManager } from './sprite-manager'

export function renderCtrls (
  container: HTMLElement,
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager
): () => void {
  const { x: ctnX, y: ctnY } = container.getBoundingClientRect()
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height
  }

  const { rectEl, ctrlsEl } = createRectAndCtrlEl(container)
  const offSprChange = sprMng.on(ESpriteManagerEvt.ActiveSpriteChange, (s) => {
    if (s == null) {
      rectEl.style.display = 'none'
      return
    }
    syncCtrlElPos(
      s,
      rectEl,
      ctrlsEl,
      { x: ctnX, y: ctnY },
      cvsRatio
    )
    rectEl.style.display = ''
  })

  let isDown = false
  const onDown = (evt: MouseEvent): void => {
    if (evt.button !== 0) return
    isDown = true
  }
  const onWinowUp = (): void => { isDown = false }

  const onMove = (): void => {
    if (!isDown || sprMng.activeSprite == null) return
    syncCtrlElPos(
      sprMng.activeSprite,
      rectEl,
      ctrlsEl,
      { x: ctnX, y: ctnY },
      cvsRatio
    )
  }

  cvsEl.addEventListener('mousedown', onDown)
  window.addEventListener('mouseup', onWinowUp)
  cvsEl.addEventListener('mousemove', onMove)

  return () => {
    offSprChange()
    rectEl.remove()
    cvsEl.removeEventListener('mousedown', onDown)
    window.removeEventListener('mouseup', onWinowUp)
    cvsEl.removeEventListener('mousemove', onMove)
  }
}

function createRectAndCtrlEl (
  container: HTMLElement
): {
    rectEl: HTMLElement
    ctrlsEl: Record<TCtrlKey, HTMLElement>
  } {
  const rectEl = createEl('div')
  rectEl.style.cssText = `
    position: absolute;
    pointer-events: none;
    border: 1px solid #eee;
    display: none;
  `
  const ctrlsEl = Object.fromEntries(CTRL_KEYS.map((k) => {
    const d = createEl('div')
    d.style.cssText = `
      position: absolute;
      border: 1px solid #3ee;
      box-sizing: border-box;
      border-radius: 50%;
      background-color: #fff;
    `
    return [k, d]
  })) as Record<TCtrlKey, HTMLElement>

  Object.values(ctrlsEl)
    .forEach(d => rectEl.appendChild(d))
  container.appendChild(rectEl)
  return {
    rectEl,
    ctrlsEl
  }
}

function syncCtrlElPos (
  s: BaseSprite,
  rectEl: HTMLElement,
  ctrlsEl: Record<TCtrlKey, HTMLElement>,
  // 容器偏移
  ctnOffset: IPoint,
  cvsRatio: ICvsRatio
): void {
  const { x, y, w, h, angle, ctrls } = s.rect
  Object.assign(rectEl.style, {
    left: `${ctnOffset.x + x * cvsRatio.w}px`,
    top: `${ctnOffset.y + y * cvsRatio.h}px`,
    width: `${w * cvsRatio.w}px`,
    height: `${h * cvsRatio.h}px`,
    rotate: `${angle}rad`
  })
  Object.entries(ctrls)
    .forEach(([k, { x, y, w, h }]) => {
      // ctrl 是相对中心点定位的
      Object.assign(ctrlsEl[k as TCtrlKey].style, {
        left: '50%',
        top: '50%',
        width: `${w * cvsRatio.w}px`,
        height: `${h * cvsRatio.h}px`,
        // border 1px, 所以要 -1
        transform: `translate(${x * cvsRatio.w - 1}px, ${y * cvsRatio.h - 1}px)`
      })
    })
}
