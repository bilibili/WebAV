import { BaseSprite, SpriteManager } from '.'
import { Rect, TCtrlKey } from './rect'

/**
 * 让canvas中的sprite可以被拖拽移动
 */
export function draggabelSprite (
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height
  }

  // 排在后面的层级更高
  let sprList = sprMng.getSprites().reverse()
  const offAddSpr = sprMng.on('add', () => {
    sprList = sprMng.getSprites().reverse()
  })
  let offScale = (): void => {}

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
    if (hitSpr == null) {
      sprMng.activeSprite = null
      return
    }
    sprMng.activeSprite = hitSpr

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
    window.addEventListener('mouseup', () => {
      clearWindowEvt()
      if (sprMng.activeSprite != null) {
        offScale()
        offScale = scalableSprite(cvsEl, sprMng.activeSprite)
      }
    })
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
    offAddSpr()
    offScale()
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

  const startRect = s.rect.clone()
  const onMouseMove = (evt: MouseEvent): void => {
    if (ctrlKey == null || ctrlRect == null) return
    const { clientX, clientY } = evt
    const deltaX = (clientX - startX) / cvsRatio.w
    const deltaY = (clientY - startY) / cvsRatio.h

    // 对角线上的点是等比例缩放，key 的长度为 2
    // const hanler = ctrlKey.length === 1
    //   ? stretchScale
    //   : fixedRatioScale
    const { x, y, w, h } = startRect
    const { incW, incH, incS, rotateAngle } = stretchScale({
      deltaX,
      deltaY,
      angle: s.rect.angle,
      ctrlKey
    })

    // 最小缩放限定
    const minSize = 10
    let newW = w + incW
    newW = newW < minSize ? minSize : newW
    let newH = h + incH
    newH = newH < minSize ? minSize : newH

    const newCntX = incS / 2 * Math.cos(rotateAngle) + x + w / 2
    const newCntY = incS / 2 * Math.sin(rotateAngle) + y + h / 2

    const newX = newCntX - newW / 2
    const newY = newCntY - newH / 2

    s.rect.x = newX
    s.rect.y = newY
    s.rect.w = newW
    s.rect.h = newH
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

/**
 * 拉伸缩放
 */
function stretchScale ({
  deltaX, deltaY, angle, ctrlKey
}: { deltaX: number, deltaY: number, angle: number, ctrlKey: TCtrlKey }): {
    incW: number
    incH: number
    incS: number
    rotateAngle: number
  } {
  // 计算矩形增加的宽度
  let incS = 0
  let incW = 0
  let incH = 0
  let rotateAngle = angle
  if (ctrlKey === 'l' || ctrlKey === 'r') {
    incS = deltaX * Math.cos(angle) + deltaY * Math.sin(angle)
    // l 缩放是反向的
    incW = incS * (ctrlKey === 'l' ? -1 : 1)
  } else if (ctrlKey === 't' || ctrlKey === 'b') {
    // 计算矩形增加的宽度，旋转坐标系让x轴与角度重合，鼠标位置在x轴的投影（x值）即为增加的高度
    rotateAngle = angle - Math.PI / 2
    incS = deltaX * Math.cos(rotateAngle) + deltaY * Math.sin(rotateAngle)
    incH = incS * (ctrlKey === 'b' ? -1 : 1)
  }

  return { incW, incH, incS, rotateAngle }
}

/**
 * 等比例缩放
 */
function fixedRatioScale ({
  ox, oy, angle, ctrlKey, rect
}: { ox: number, oy: number, angle: number, ctrlKey: TCtrlKey, rect: Rect }): {
    incW: number
    incH: number
    incS: number
    rotateAngle: number
  } {
  // 对角线角度
  const diagonalAngle = Math.atan2(rect.h, rect.w)
  // 坐标系旋转角度， lb->rt的对角线的初始角度为负数，所以需要乘以-1
  const rotateAngle = (
    ctrlKey === 'lt' || ctrlKey === 'rb' ? 1 : -1
  ) * diagonalAngle + angle
  // 旋转坐标系让x轴与对角线重合，鼠标位置在x轴的投影（x值）即为增加的长度
  const incS = ox * Math.cos(rotateAngle) + oy * Math.sin(rotateAngle)
  // lb lt 缩放值是反向
  const coefficient = ctrlKey === 'lt' || ctrlKey === 'lb' ? -1 : 1
  // 等比例缩放，增加宽高等于长度乘以对应的角度函数
  // 因为等比例缩放，中心及被拖拽的点，一定在对角线上
  const incW = incS * Math.cos(diagonalAngle) * coefficient
  const incH = incS * Math.sin(diagonalAngle) * coefficient

  return { incW, incH, incS, rotateAngle }
}
