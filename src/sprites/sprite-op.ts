import { BaseSprite } from '.'
import { Rect, TCtrlKey } from './rect'

/**
 * 让canvas中的sprite可以被拖拽移动
 */
export function draggabelSprite (
  cvsEl: HTMLCanvasElement,
  spriteList: BaseSprite[]
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height
  }

  // 排在后面的层级更高
  const sprList = spriteList.reverse()
  let startX = 0
  let startY = 0
  let hitSpr: BaseSprite | null = null
  let rect: Rect | null = null
  let limit: Record<'xl' | 'xr' | 'yt' | 'yb', number> | null = null

  // 按下cvs，寻找选中的 sprite，监听移动事件
  const onCvsMouseDown = (evt: MouseEvent): void => {
    // 鼠标左键才能拖拽移动
    if (evt.button !== 0) return
    const { offsetX, offsetY, clientX, clientY } = evt
    hitSpr = sprList.find(s => s.rect.checkHit(
      offsetX / cvsRatio.w,
      offsetY / cvsRatio.h
    )) ?? null
    if (hitSpr == null) return
    rect = hitSpr.rect.clone()
    // 保留 10px，避免移出边界，无法拖回来
    limit = {
      xl: -rect.w + 10,
      xr: cvsEl.width - 10,
      yt: -rect.h + 10,
      yb: cvsEl.height - 10
    }

    startX = clientX
    startY = clientY
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', clearWindowEvt)
  }

  const onMouseMove = (evt: MouseEvent): void => {
    if (hitSpr == null || rect == null || limit == null) return
    const { clientX, clientY } = evt
    let newX = rect.x + (clientX - startX) / cvsRatio.w
    let newY = rect.y + (clientY - startY) / cvsRatio.h

    // 限制不能完全拖拽出容器边界
    newX = newX <= limit.xl ? limit.xl : newX >= limit.xr ? limit.xr : newX
    newY = newY <= limit.yt ? limit.yt : newY >= limit.yb ? limit.yb : newY
    hitSpr.rect.x = newX
    hitSpr.rect.y = newY
  }

  cvsEl.addEventListener('mousedown', onCvsMouseDown)

  const clearWindowEvt = (): void => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', clearWindowEvt)
  }

  return (): void => {
    clearWindowEvt()
    cvsEl.removeEventListener('mousedown', onCvsMouseDown)
  }
}

/**
 * 让sprite可缩放
 */
export function scalableSprite (
  cvsEl: HTMLCanvasElement,
  s: BaseSprite
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height
  }
  const { ctrls } = s.rect

  let startX = 0
  let startY = 0
  // 点击事件命中的控制点名字
  let ctrlKey: TCtrlKey | null = null
  let ctrlRect: Rect | null = null
  const onCvsMouseDown = (evt: MouseEvent): void => {
    // 鼠标左键才能拖拽移动
    if (evt.button !== 0) return
    const { offsetX, offsetY, clientX, clientY } = evt
    // 将鼠标点击偏移坐标映射成 canvas 坐标，然后映射成相对 sprite 的中心坐标
    // 因为 ctrls 是相对 sprite 中心点定位的
    const ofx = offsetX / cvsRatio.w - s.rect.center.x
    const ofy = offsetY / cvsRatio.h - s.rect.center.y
    const it = Object.entries(ctrls)
      .find(([, rect]) => rect.checkHit(ofx, ofy))
    if (it == null) return
    ctrlKey = it[0] as TCtrlKey
    ctrlRect = it[1]

    startX = clientX
    startY = clientY
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', clearWindowEvt)
  }
  cvsEl.addEventListener('mousedown', onCvsMouseDown)

  const onMouseMove = (evt: MouseEvent): void => {
    if (ctrlRect == null) return
    const { clientX, clientY } = evt
    const deltaX = (clientX - startX) / cvsRatio.w
    const deltaY = (clientY - startY) / cvsRatio.h
    switch (ctrlKey) {
      // t 控制点随着鼠标移动，改变 sprite 的高度 和 y 坐标
      case 't':
        s.rect.y += deltaY
        s.rect.h += -deltaY
    }
  }

  const clearWindowEvt = (): void => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', clearWindowEvt)
  }

  return () => {
    clearWindowEvt()
    cvsEl.removeEventListener('mousedown', onCvsMouseDown)
  }
}
