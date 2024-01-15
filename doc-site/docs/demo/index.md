# DEMO 前言

左侧包含多个可体验的 DEMO，是基于 [WebAV 项目][2]实现在纯浏览器环境中处理音视频数据的各种示例。

```tsx
import { Combinator } from '@webav/av-cliper';
import React, { useState, useEffect } from 'react';

export default function UI() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const msg =
    isSupported == null
      ? '检测中'
      : isSupported === true
      ? '🎉 当前浏览器支持 WebCodecs，可继续体验 DEMO 🎉'
      : '💔 当前浏览器不支持 WebCodecs，请使用 Chrome、Edge（并升级到新版本）体验 ❤️‍🩹';

  useEffect(() => {
    (async () => {
      setIsSupported(await Combinator.isSupported());
    })();
  }, []);
  return <strong>{msg}</strong>;
}
```

体验 DEMO 前

1. 确保你的浏览器支持 WebCodecs API（Chrome 94+），查看详细[浏览器兼容性][1]
2. 音视频资源托管在 Github Pages，没有科学联网的设备可能需要**耐心等待资源加载**
   1. 最好能科学上网，否则资源可能加载失败
   2. 或先体验**视频录制**等不需要加载视频资源的示例
   3. 也可 clone [WebAV 项目][2]，在本地环境运行

[1]: https://caniuse.com/?search=WebCodecs
[2]: https://github.com/hughfenghen/WebAV
