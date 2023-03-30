import { BaseSprite } from './sprites'

export function draggabelSprite (
  cvsEl: HTMLCanvasElement,
  spriteList: BaseSprite[]
): () => void {
  const onMouseMove = (): void => {}

  const ratio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height
  }
  // 排在后面的层级更高
  const sprList = spriteList.reverse()
  let startX = 0
  let startY = 0
  // 按下cvs，寻找选中的 sprite，监听移动事件
  const onCvsMouseDown = (evt: MouseEvent): void => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', clearWindowEvt)

    // 鼠标左键才能拖拽移动
    if (evt.button !== 0) return
    const { offsetX, offsetY, clientX, clientY } = evt
    const hitSpr = sprList.find(s => s.checkHit(
      offsetX / ratio.w,
      offsetY / ratio.h
    ))
    // rect = getHitRect(offsetX, offsetY)
    if (hitSpr == null) return
    // todo: 保留 10px，避免移出边界，无法拖回来
    // limit = {
    //   xl: -rect.w + 10,
    //   xr: view.width - 10,
    //   yt: -rect.h + 10,
    //   yb: view.height - 10
    // }

    startX = clientX
    startY = clientY
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
