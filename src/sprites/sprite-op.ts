import { BaseSprite, Rect } from '.'

/**
 * 让canvas中的sprite可以被拖拽
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
    hitSpr = sprList.find(s => s.checkHit(
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
