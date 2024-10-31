import { ESpriteManagerEvt, SpriteManager } from './sprite-manager';
import { ICvsRatio, IPoint, RectCtrls, TCtrlKey } from '../types';
import { VisibleSprite, Rect } from '@webav/av-cliper';
import { createEl } from '../utils';

/**
 * 鼠标点击，激活 sprite
 */
export function activeSprite(
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager,
  rectCtrlsGetter: (rect: Rect) => RectCtrls,
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height,
  };

  const observer = new ResizeObserver(() => {
    cvsRatio.w = cvsEl.clientWidth / cvsEl.width;
    cvsRatio.h = cvsEl.clientHeight / cvsEl.height;
  });
  observer.observe(cvsEl);

  const onCvsMouseDown = (evt: MouseEvent): void => {
    if (evt.button !== 0) return;
    const { offsetX, offsetY } = evt;
    const ofx = offsetX / cvsRatio.w;
    const ofy = offsetY / cvsRatio.h;
    if (sprMng.activeSprite != null) {
      const [ctrlKey] =
        (Object.entries(rectCtrlsGetter(sprMng.activeSprite.rect)).find(
          ([, rect]) => rect.checkHit(ofx, ofy),
        ) as [TCtrlKey, Rect]) ?? [];
      if (ctrlKey != null) return;
    }
    sprMng.activeSprite =
      sprMng
        .getSprites()
        // 排在后面的层级更高
        .reverse()
        .find((s) => s.visible && s.rect.checkHit(ofx, ofy)) ?? null;
  };

  cvsEl.addEventListener('mousedown', onCvsMouseDown);

  return () => {
    observer.disconnect();
    cvsEl.removeEventListener('mousedown', onCvsMouseDown);
  };
}

/**
 * 让canvas中的sprite可以被拖拽移动
 */
export function draggabelSprite(
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager,
  container: HTMLElement,
  rectCtrlsGetter: (rect: Rect) => RectCtrls,
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height,
  };

  const observer = new ResizeObserver(() => {
    cvsRatio.w = cvsEl.clientWidth / cvsEl.width;
    cvsRatio.h = cvsEl.clientHeight / cvsEl.height;
  });
  observer.observe(cvsEl);

  let startX = 0;
  let startY = 0;
  let startRect: Rect | null = null;

  const refline = createRefline(cvsEl, container);

  let hitSpr: VisibleSprite | null = null;
  // sprMng.activeSprite 在 av-canvas.ts -> activeSprite 中被赋值
  const onCvsMouseDown = (evt: MouseEvent): void => {
    // 鼠标左键才能拖拽移动
    if (evt.button !== 0 || sprMng.activeSprite == null) return;
    hitSpr = sprMng.activeSprite;
    const { offsetX, offsetY, clientX, clientY } = evt;
    // 如果已有激活 sprite，先判定是否命中其 ctrls
    if (
      hitRectCtrls({
        rect: hitSpr.rect,
        offsetX,
        offsetY,
        clientX,
        clientY,
        cvsRatio,
        cvsEl,
        rectCtrlsGetter,
      })
    ) {
      // 命中 ctrl 是缩放 sprite，略过后续移动 sprite 逻辑
      return;
    }

    startRect = hitSpr.rect.clone();

    refline.magneticEffect(hitSpr.rect.x, hitSpr.rect.y, hitSpr.rect);

    startX = clientX;
    startY = clientY;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', clearWindowEvt);
  };

  const onMouseMove = (evt: MouseEvent): void => {
    if (hitSpr == null || startRect == null) return;

    const { clientX, clientY } = evt;
    let expectX = startRect.x + (clientX - startX) / cvsRatio.w;
    let expectY = startRect.y + (clientY - startY) / cvsRatio.h;

    updateRectWithSafeMargin(
      hitSpr.rect,
      cvsEl,
      refline.magneticEffect(expectX, expectY, hitSpr.rect),
    );
  };

  cvsEl.addEventListener('mousedown', onCvsMouseDown);

  const clearWindowEvt = (): void => {
    refline.hide();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', clearWindowEvt);
  };

  return () => {
    observer.disconnect();
    refline.destroy();
    clearWindowEvt();
    cvsEl.removeEventListener('mousedown', onCvsMouseDown);
  };
}

/**
 * 缩放 sprite
 */
function scaleRect({
  sprRect,
  startX,
  startY,
  ctrlKey,
  cvsRatio,
  cvsEl,
}: {
  sprRect: Rect;
  startX: number;
  startY: number;
  ctrlKey: TCtrlKey;
  cvsRatio: ICvsRatio;
  cvsEl: HTMLCanvasElement;
}): void {
  const startRect = sprRect.clone();

  const onMouseMove = (evt: MouseEvent): void => {
    const { clientX, clientY } = evt;
    const deltaX = (clientX - startX) / cvsRatio.w;
    const deltaY = (clientY - startY) / cvsRatio.h;

    // 对角线上的点是等比例缩放，key 的长度为 2
    const scaler = ctrlKey.length === 1 ? stretchScale : fixedRatioScale;
    const { x, y, w, h } = startRect;
    // rect 对角线角度
    const diagonalAngle = Math.atan2(h, w);
    const { incW, incH, incS, rotateAngle } = scaler({
      deltaX,
      deltaY,
      angle: sprRect.angle,
      ctrlKey,
      diagonalAngle,
    });

    // 最小宽高缩放限定
    const minSize = 10;
    let newW = w;
    let newH = h;
    // 中心点缩放时，宽高增量是原来的两倍
    let newIncW = startRect.fixedScaleCenter ? incW * 2 : incW;
    let newIncH = startRect.fixedScaleCenter ? incH * 2 : incH;
    // 最小长度缩放限定
    let newIncS = incS;
    // 起始对角线长度
    const startS = Math.sqrt(h ** 2 + w ** 2);
    // 最小对角线长度
    const minS = Math.sqrt((minSize * (h / w)) ** 2 + minSize ** 2);
    switch (ctrlKey) {
      // 非等比例缩放时，变化的增量范围 由原宽高跟 minSize 的差值决定
      // 非等比例缩放时，根据ctrlKey的不同，固定宽高中的一个，另一个根据增量计算，并考虑最小值限定
      case 'l':
        newW = Math.max(w + newIncW, minSize);
        newIncS = Math.min(incS, w - minSize);
        break;
      case 'r':
        newW = Math.max(w + newIncW, minSize);
        newIncS = Math.max(incS, minSize - w);
        break;
      case 'b':
        newH = Math.max(h + newIncH, minSize);
        newIncS = Math.min(incS, h - minSize);
        break;
      case 't':
        newH = Math.max(h + newIncH, minSize);
        newIncS = Math.max(incS, minSize - h);
        break;
      // 等比例缩放时，变化（对角线长度）的增量范围由原对角线长度跟 minSize 对角线的差值决定
      // 等比例缩放时，某一边达到最小值时保持宽高比例不变
      case 'lt':
      case 'lb':
        newW = Math.max(w + newIncW, minSize);
        newH = newW === minSize ? (h / w) * newW : h + newIncH;
        newIncS = Math.min(incS, startS - minS);
        break;
      case 'rt':
      case 'rb':
        newW = Math.max(w + newIncW, minSize);
        newH = newW === minSize ? (h / w) * newW : h + newIncH;
        newIncS = Math.max(incS, minS - startS);
        break;
    }
    let newX = x;
    let newY = y;
    if (startRect.fixedScaleCenter) {
      newX = x + w / 2 - newW / 2;
      newY = y + h / 2 - newH / 2;
    } else {
      const newCenterX = (newIncS / 2) * Math.cos(rotateAngle) + x + w / 2;
      const newCenterY = (newIncS / 2) * Math.sin(rotateAngle) + y + h / 2;
      newX = newCenterX - newW / 2;
      newY = newCenterY - newH / 2;
    }

    updateRectWithSafeMargin(sprRect, cvsEl, {
      x: newX,
      y: newY,
      w: newW,
      h: newH,
    });
  };

  const clearWindowEvt = (): void => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', clearWindowEvt);
  };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', clearWindowEvt);
}

/**
 * 拉伸缩放, 上t 下b 左l 右r
 */
function stretchScale({
  deltaX,
  deltaY,
  angle,
  ctrlKey,
}: {
  deltaX: number;
  deltaY: number;
  angle: number;
  ctrlKey: TCtrlKey;
}): {
  incW: number;
  incH: number;
  incS: number;
  rotateAngle: number;
} {
  // 计算矩形增加的宽度
  let incS = 0;
  let incW = 0;
  let incH = 0;
  let rotateAngle = angle;
  if (ctrlKey === 'l' || ctrlKey === 'r') {
    incS = deltaX * Math.cos(angle) + deltaY * Math.sin(angle);
    // l 缩放是反向的
    incW = incS * (ctrlKey === 'l' ? -1 : 1);
  } else if (ctrlKey === 't' || ctrlKey === 'b') {
    // 计算矩形增加的宽度，旋转坐标系让x轴与角度重合，鼠标位置在x轴的投影（x值）即为增加的高度
    rotateAngle = angle - Math.PI / 2;
    incS = deltaX * Math.cos(rotateAngle) + deltaY * Math.sin(rotateAngle);
    incH = incS * (ctrlKey === 'b' ? -1 : 1);
  }

  return { incW, incH, incS, rotateAngle };
}

/**
 * 等比例缩放
 */
function fixedRatioScale({
  deltaX,
  deltaY,
  angle,
  ctrlKey,
  diagonalAngle,
}: {
  deltaX: number;
  deltaY: number;
  angle: number;
  ctrlKey: TCtrlKey;
  diagonalAngle: number;
}): {
  incW: number;
  incH: number;
  incS: number;
  rotateAngle: number;
} {
  // 坐标系旋转角度， lb->rt的对角线的初始角度为负数，所以需要乘以-1
  const rotateAngle =
    (ctrlKey === 'lt' || ctrlKey === 'rb' ? 1 : -1) * diagonalAngle + angle;
  // 旋转坐标系让x轴与对角线重合，鼠标位置在x轴的投影（x值）即为增加的长度
  const incS = deltaX * Math.cos(rotateAngle) + deltaY * Math.sin(rotateAngle);
  // lb lt 缩放值是反向
  const coefficient = ctrlKey === 'lt' || ctrlKey === 'lb' ? -1 : 1;
  // 等比例缩放，增加宽高等于长度乘以对应的角度函数
  // 因为等比例缩放，中心及被拖拽的点，一定在对角线上
  const incW = incS * Math.cos(diagonalAngle) * coefficient;
  const incH = incS * Math.sin(diagonalAngle) * coefficient;

  return { incW, incH, incS, rotateAngle };
}

function hitRectCtrls({
  rect,
  cvsRatio,
  offsetX,
  offsetY,
  clientX,
  clientY,
  cvsEl,
  rectCtrlsGetter,
}: {
  rect: Rect;
  cvsRatio: ICvsRatio;
  offsetX: number;
  offsetY: number;
  clientX: number;
  clientY: number;
  cvsEl: HTMLCanvasElement;
  rectCtrlsGetter: (rect: Rect) => RectCtrls;
}): boolean {
  // 将鼠标点击偏移坐标映射成 canvas 坐，
  const ofx = offsetX / cvsRatio.w;
  const ofy = offsetY / cvsRatio.h;
  const [k] =
    (Object.entries(rectCtrlsGetter(rect)).find(([, rect]) =>
      rect.checkHit(ofx, ofy),
    ) as [TCtrlKey, Rect]) ?? [];

  if (k == null) return false;
  if (k === 'rotate') {
    rotateRect(rect, cntMap2Outer(rect.center, cvsRatio, cvsEl));
  } else {
    scaleRect({
      sprRect: rect,
      ctrlKey: k,
      startX: clientX,
      startY: clientY,
      cvsRatio,
      cvsEl,
    });
  }
  // 命中 ctrl 后续是缩放 sprite，略过移动 sprite 逻辑
  return true;
}

/**
 * 监听拖拽事件，将鼠标坐标转换为旋转角度
 * 旋转时，rect的坐标不变
 */
function rotateRect(rect: Rect, outCnt: IPoint): void {
  const onMove = ({ clientX, clientY }: MouseEvent): void => {
    // 映射为 中心点坐标系
    const x = clientX - outCnt.x;
    const y = clientY - outCnt.y;
    // 旋转控制点在正上方，与 x 轴是 -90°， 所以需要加上 Math.PI / 2
    const angle = Math.atan2(y, x) + Math.PI / 2;
    rect.angle = angle;
  };
  const clear = (): void => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', clear);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', clear);
}

/**
 * canvas 内部（resolution）坐标映射成外部（DOM）坐标
 */
function cntMap2Outer(
  cnt: IPoint,
  cvsRatio: ICvsRatio,
  cvsEl: HTMLElement,
): IPoint {
  const x = cnt.x * cvsRatio.w;
  const y = cnt.y * cvsRatio.h;

  const { left, top } = cvsEl.getBoundingClientRect();
  return {
    x: x + left,
    y: y + top,
  };
}

/**
 * 限制安全范围，避免 sprite 完全超出边界
 */
function updateRectWithSafeMargin(
  rect: Rect,
  cvsEl: HTMLCanvasElement,
  value: Partial<Pick<Rect, 'x' | 'y' | 'w' | 'h'>>,
) {
  const newState = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, ...value };
  const safeWidth = cvsEl.width * 0.05;
  const safeHeight = cvsEl.height * 0.05;
  if (newState.x < -newState.w + safeWidth) {
    newState.x = -newState.w + safeWidth;
  } else if (newState.x > cvsEl.width - safeWidth) {
    newState.x = cvsEl.width - safeWidth;
  }
  if (newState.y < -newState.h + safeHeight) {
    newState.y = -newState.h + safeHeight;
  } else if (newState.y > cvsEl.height - safeHeight) {
    newState.y = cvsEl.height - safeHeight;
  }
  rect.x = newState.x;
  rect.y = newState.y;
  rect.w = newState.w;
  rect.h = newState.h;
}

/**
 * 创建四周+中线参考线, 靠近具有磁吸效果
 */
function createRefline(cvsEl: HTMLCanvasElement, container: HTMLElement) {
  const reflineBaseCSS = `display: none; position: absolute;`;
  const baseSettings = { w: 0, h: 0, x: 0, y: 0 } as const;
  const reflineSettings: Record<
    'top' | 'bottom' | 'left' | 'right' | 'vertMiddle' | 'horMiddle',
    {
      // 四周加中线参考线，它们的坐标、宽高只能是 0 ｜ 50 ｜ 100
      w: 0 | 50 | 100;
      h: 0 | 50 | 100;
      x: 0 | 50 | 100;
      y: 0 | 50 | 100;
      ref: { prop: 'x' | 'y'; val: (rect: Rect) => number };
    }
  > = {
    vertMiddle: {
      ...baseSettings,
      h: 100,
      x: 50,
      ref: { prop: 'x', val: ({ w }) => (cvsEl.width - w) / 2 },
    },
    horMiddle: {
      ...baseSettings,
      w: 100,
      y: 50,
      ref: { prop: 'y', val: ({ h }) => (cvsEl.height - h) / 2 },
    },
    top: {
      ...baseSettings,
      w: 100,
      ref: { prop: 'y', val: () => 0 },
    },
    bottom: {
      ...baseSettings,
      w: 100,
      y: 100,
      ref: { prop: 'y', val: ({ h }) => cvsEl.height - h },
    },
    left: {
      ...baseSettings,
      h: 100,
      ref: { prop: 'x', val: () => 0 },
    },
    right: {
      ...baseSettings,
      h: 100,
      x: 100,
      ref: { prop: 'x', val: ({ w }) => cvsEl.width - w },
    },
  } as const;

  const lineWrap = createEl('div');
  lineWrap.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    box-sizing: border-box;
  `;
  const reflineEls = Object.fromEntries(
    Object.entries(reflineSettings).map(([key, { w, h, x, y }]) => {
      const lineEl = createEl('div');
      lineEl.style.cssText = `
        ${reflineBaseCSS}
        border-${w > 0 ? 'top' : 'left'}: 1px solid #3ee;
        top: ${y}%; left: ${x}%;
        ${x === 100 ? 'margin-left: -1px' : ''};
        ${y === 100 ? 'margin-top: -1px' : ''};
        width: ${w}%; height: ${h}%;
      `;
      lineWrap.appendChild(lineEl);
      return [key, lineEl];
    }),
  ) as Record<keyof typeof reflineSettings, HTMLDivElement>;
  container.appendChild(lineWrap);

  const magneticDistance = 6 / (900 / cvsEl.width);
  return {
    magneticEffect(expectX: number, expectY: number, rect: Rect) {
      const retVal = { x: expectX, y: expectY };
      let reflineKey: keyof typeof reflineSettings;
      let correctionState = { x: false, y: false };
      for (reflineKey in reflineSettings) {
        const { prop, val } = reflineSettings[reflineKey].ref;
        if (correctionState[prop]) continue;

        const refVal = val(rect);
        if (
          Math.abs(rect[prop] - refVal) <= magneticDistance &&
          Math.abs(rect[prop] - (prop === 'x' ? expectX : expectY)) <=
            magneticDistance
        ) {
          retVal[prop] = refVal;
          reflineEls[reflineKey].style.display = 'block';
          correctionState[prop] = true;
        } else {
          reflineEls[reflineKey].style.display = 'none';
        }
      }
      return retVal;
    },
    hide() {
      Object.values(reflineEls).forEach((el) => (el.style.display = 'none'));
    },
    destroy() {
      lineWrap.remove();
    },
  };
}

/**
 * 根据当前位置（sprite & ctrls），动态调整鼠标样式
 */
export function dynamicCusor(
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager,
  rectCtrlsGetter: (rect: Rect) => RectCtrls,
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height,
  };

  const observer = new ResizeObserver(() => {
    cvsRatio.w = cvsEl.clientWidth / cvsEl.width;
    cvsRatio.h = cvsEl.clientHeight / cvsEl.height;
  });
  observer.observe(cvsEl);

  const cvsStyle = cvsEl.style;

  let actSpr = sprMng.activeSprite;
  sprMng.on(ESpriteManagerEvt.ActiveSpriteChange, (s) => {
    actSpr = s;
    if (s == null) cvsStyle.cursor = '';
  });
  // 鼠标按下时，在操作过程中，不需要变换鼠标样式
  let isMSDown = false;
  const onDown = ({ offsetX, offsetY }: MouseEvent): void => {
    isMSDown = true;
    // 将鼠标点击偏移坐标映射成 canvas 坐，
    const ofx = offsetX / cvsRatio.w;
    const ofy = offsetY / cvsRatio.h;
    // 直接选中 sprite 时，需要改变鼠标样式为 move
    if (actSpr?.rect.checkHit(ofx, ofy) === true && cvsStyle.cursor === '') {
      cvsStyle.cursor = 'move';
    }
  };
  const onWindowUp = (): void => {
    isMSDown = false;
  };

  // 八个 ctrl 点位对应的鼠标样式，构成循环
  const curStyles = [
    'ns-resize',
    'nesw-resize',
    'ew-resize',
    'nwse-resize',
    'ns-resize',
    'nesw-resize',
    'ew-resize',
    'nwse-resize',
  ];
  const curInitIdx = { t: 0, rt: 1, r: 2, rb: 3, b: 4, lb: 5, l: 6, lt: 7 };

  const onMove = (evt: MouseEvent): void => {
    // 按下之后，不再变化，因为可能是在拖拽控制点
    if (actSpr == null || isMSDown) return;
    const { offsetX, offsetY } = evt;
    const ofx = offsetX / cvsRatio.w;
    const ofy = offsetY / cvsRatio.h;
    const [ctrlKey] =
      (Object.entries(rectCtrlsGetter(actSpr.rect)).find(([, rect]) =>
        rect.checkHit(ofx, ofy),
      ) as [TCtrlKey, Rect]) ?? [];

    if (ctrlKey != null) {
      if (ctrlKey === 'rotate') {
        cvsStyle.cursor = 'crosshair';
        return;
      }
      // 旋转后，控制点的箭头指向也需要修正
      const angle = actSpr.rect.angle;
      const oa = angle < 0 ? angle + 2 * Math.PI : angle;
      // 每个控制点的初始样式（idx） + 旋转角度导致的偏移，即为新鼠标样式
      // 每旋转45°，偏移+1，以此在curStyles中循环
      const idx =
        (curInitIdx[ctrlKey] + Math.floor((oa + Math.PI / 8) / (Math.PI / 4))) %
        8;
      cvsStyle.cursor = curStyles[idx];
      return;
    }
    if (actSpr.rect.checkHit(ofx, ofy)) {
      cvsStyle.cursor = 'move';
      return;
    }
    // 未命中 ctrls、sprite，重置为默认鼠标样式
    cvsStyle.cursor = '';
  };

  cvsEl.addEventListener('mousemove', onMove);
  cvsEl.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onWindowUp);

  return () => {
    observer.disconnect();
    cvsEl.removeEventListener('mousemove', onMove);
    cvsEl.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onWindowUp);
  };
}
