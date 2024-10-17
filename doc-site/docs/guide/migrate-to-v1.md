---
nav:
  title: 指南
  order: 2
group:
  title: 其他
  order: 4
order: 4
---

# 迁移至 v1 版本

v1 版本的 API 有少量破坏性变更，请按以下步骤迁移。

### API: setAnimation

`OffscreenSprite.setAnimation, VisibleSprite.setAnimation` 时间参数 `{ duration, delay }` 单位由**秒**改为**微秒**，跟其他 API 的时间参数单位保持一致。

```diff
offscreenSprite.setAnimation(
  {
    '0%': { x: 0, y: 0 },
    '25%': { x: 1200, y: 680 },
    '50%': { x: 1200, y: 0 },
    '75%': { x: 0, y: 680 },
    '100%': { x: 0, y: 0 },
  },
- { duration: 4, delay: 1 },
+ { duration: 4e6, delay: 1e6 },
);
```

### 回收 API

为了简化 API，且降低未来出现破坏性变更的几率，所以从 v1 版本移出以下跟 `av-cliper` 的核心功能无关的 API。

```
decodeImg
audioResample
ringSliceFloat32Array
mixinPCM
concatFloat32Array
concatPCMFragments
extractPCM4AudioData
extractPCM4AudioBuffer
adjustAudioDataVolume
renderTxt2Img
createEl
createHLSLoader
workerTimer
autoReadStream
EventTool
file2stream
recodemux
```

如果社区有需要这些能力，可考虑在新 package 中开放出来，跟 av-cliper 保持隔离。

如果能的项目依赖了其中部分 API，可以考虑从 WebAV 源码中 copy 一份到自己的项目中。

### 重构 Rect.ctrls

移除 `Rect` 下的 `CTRL_SIZE, CTRL_KEYS, get ctrls()`。

因为如果页面中包含多个 AVCanvas，全局控制 `Rect.CTRL_SIZE` (Rect 控制点的大小)会导致冲突。

为了保持控制点大小这视觉上一致，应根据当前画布（Canvas）的分辨率与画布的显示尺寸动态变化；  
v1 版本不支持动态调整控制点大小，在 AVCanvas 内部动态调整控制点大小，保持视觉大小一致。

v0.x 版本中 AVCanvas 就强行动态调整了 `Rect.CTRL_SIZE`，所以此项变更应该不用影响实际用户。

## todo

- 中英文 demo 页面复用代码
