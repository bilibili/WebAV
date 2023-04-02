import { BaseSprite, SpriteManager } from '.'
import { ICvsRatio } from '../types'
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

  let startX = 0
  let startY = 0
  let hitSpr: BaseSprite | null = null
  let startRect: Rect | null = null
  let mvLimit: Record<'xl' | 'xr' | 'yt' | 'yb', number> | null = null

  // 寻找选中的 sprite，监听移动事件
  const onCvsMouseDown = (evt: MouseEvent): void => {
    // 鼠标左键才能拖拽移动
    if (evt.button !== 0) return
    const { offsetX, offsetY, clientX, clientY } = evt
    // 如果已有激活 sprite，先判定是否命中其 ctrls
    if (
      sprMng.activeSprite != null &&
      hitRectCtrls({
        rect: sprMng.activeSprite.rect,
        offsetX,
        offsetY,
        clientX,
        clientY,
        cvsRatio
      })
    ) {
      // 命中 ctrl 是缩放 sprite，略过后续移动 sprite 逻辑
      return
    }

    hitSpr = sprList.find(s => s.rect.checkHit(
      offsetX / cvsRatio.w,
      offsetY / cvsRatio.h
    )) ?? null
    sprMng.activeSprite = hitSpr
    if (hitSpr == null) return

    startRect = hitSpr.rect.clone()
    // 保留 10px，避免移出边界，无法拖回来
    mvLimit = {
      xl: -startRect.w + 10,
      xr: cvsEl.width - 10,
      yt: -startRect.h + 10,
      yb: cvsEl.height - 10
    }

    startX = clientX
    startY = clientY
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', clearWindowEvt)
  }

  const onMouseMove = (evt: MouseEvent): void => {
    if (hitSpr == null || startRect == null || mvLimit == null) return

    const { clientX, clientY } = evt
    let newX = startRect.x + (clientX - startX) / cvsRatio.w
    let newY = startRect.y + (clientY - startY) / cvsRatio.h

    // 限制不能完全拖拽出容器边界
    newX = newX <= mvLimit.xl ? mvLimit.xl : newX >= mvLimit.xr ? mvLimit.xr : newX
    newY = newY <= mvLimit.yt ? mvLimit.yt : newY >= mvLimit.yb ? mvLimit.yb : newY
    hitSpr.rect.x = newX
    hitSpr.rect.y = newY
  }

  cvsEl.addEventListener('mousedown', onCvsMouseDown)

  const clearWindowEvt = (): void => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', clearWindowEvt)
  }

  return () => {
    clearWindowEvt()
    offAddSpr()
    cvsEl.removeEventListener('mousedown', onCvsMouseDown)
  }
}

/**
 * 缩放 sprite
 */
function scaleSprite ({
  sprRect, startX, startY, ctrlKey, cvsRatio
}: {
  sprRect: Rect
  startX: number
  startY: number
  ctrlKey: TCtrlKey
  cvsRatio: ICvsRatio
}): () => void {
  const startRect = sprRect.clone()

  const onMouseMove = (evt: MouseEvent): void => {
    const { clientX, clientY } = evt
    const deltaX = (clientX - startX) / cvsRatio.w
    const deltaY = (clientY - startY) / cvsRatio.h

    // 对角线上的点是等比例缩放，key 的长度为 2
    const scaler = ctrlKey.length === 1
      ? stretchScale
      : fixedRatioScale
    const { x, y, w, h } = startRect
    // rect 对角线角度
    const diagonalAngle = Math.atan2(h, w)
    const { incW, incH, incS, rotateAngle } = scaler({
      deltaX,
      deltaY,
      angle: sprRect.angle,
      ctrlKey,
      diagonalAngle
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

    sprRect.x = newX
    sprRect.y = newY
    sprRect.w = newW
    sprRect.h = newH
  }

  const clearWindowEvt = (): void => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', clearWindowEvt)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', clearWindowEvt)

  return clearWindowEvt
}

/**
 * 拉伸缩放, 上t 下b 左l 右r
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
  deltaX, deltaY, angle, ctrlKey, diagonalAngle
}: {
  deltaX: number
  deltaY: number
  angle: number
  ctrlKey: TCtrlKey
  diagonalAngle: number
}): {
    incW: number
    incH: number
    incS: number
    rotateAngle: number
  } {
  // 坐标系旋转角度， lb->rt的对角线的初始角度为负数，所以需要乘以-1
  const rotateAngle = (
    ctrlKey === 'lt' || ctrlKey === 'rb' ? 1 : -1
  ) * diagonalAngle + angle
  // 旋转坐标系让x轴与对角线重合，鼠标位置在x轴的投影（x值）即为增加的长度
  const incS = deltaX * Math.cos(rotateAngle) + deltaY * Math.sin(rotateAngle)
  // lb lt 缩放值是反向
  const coefficient = ctrlKey === 'lt' || ctrlKey === 'lb' ? -1 : 1
  // 等比例缩放，增加宽高等于长度乘以对应的角度函数
  // 因为等比例缩放，中心及被拖拽的点，一定在对角线上
  const incW = incS * Math.cos(diagonalAngle) * coefficient
  const incH = incS * Math.sin(diagonalAngle) * coefficient

  return { incW, incH, incS, rotateAngle }
}

function hitRectCtrls ({
  rect, cvsRatio, offsetX, offsetY, clientX, clientY
}: {
  rect: Rect
  cvsRatio: ICvsRatio
  offsetX: number
  offsetY: number
  clientX: number
  clientY: number
}): boolean {
  // 将鼠标点击偏移坐标映射成 canvas 坐标，然后映射成相对 sprite 的中心坐标
  // 因为 ctrls 是相对 sprite 中心点定位的
  const ofx = offsetX / cvsRatio.w - rect.center.x
  const ofy = offsetY / cvsRatio.h - rect.center.y
  const [k] = Object.entries(rect.ctrls)
    .find(([, rect]) => rect.checkHit(ofx, ofy)) as [TCtrlKey, Rect] ?? []

  if (k == null) return false
  scaleSprite({
    sprRect: rect,
    ctrlKey: k,
    startX: clientX,
    startY: clientY,
    cvsRatio
  })
  // 命中 ctrl 后续是缩放 sprite，略过移动 sprite 逻辑
  return true
}
