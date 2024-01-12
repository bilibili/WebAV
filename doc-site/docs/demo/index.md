---
nav:
  title: DEMO
  order: 2
---

左侧包含多个可体验的 DEMO，在纯浏览器环境中实现音视频数据处理。

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

体验 DEMO 前：

1. 确保你的浏览器支持 WebCodecs API（Chrome 94+），查看详细[浏览器兼容性][1]
2. 音视频资源托管在 Github Pages，没有科学联网的设备可能耐心等待资源加载

[1]: https://caniuse.com/?search=WebCodecs
