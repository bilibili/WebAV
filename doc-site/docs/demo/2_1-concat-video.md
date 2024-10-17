---
nav: DEMO
group:
  title: 合成
  order: 3

order: 1
---

# 视频合成

在视频上叠加一个其他素材（图片、文字、视频），可用于在视频中嵌入水印，或合成两个视频文件。

**下面是一个视频添加水印的示例**  
原理是在视频上方绘制一张图片（水印），然后给图片设置动画。  
`renderTxt2ImgBitmap` 将水印文字转换成图片，是因为 css 能轻松实现复杂的文字样式效果。

<code src="./2_1_1-watermark.tsx"></code>

:::warning
`renderTxt2ImgBitmap` 依赖 DOM，所以不能在 WebWorker 中使用。
:::

如果你想在视频中绘制普通图片，可参考以下方式创建 `ImgClip` 实例，再添加到 `Combinator`

```js
new ImgClip((await fetch('<img url>')).body);
```

如果你想在视频上方再叠加另一个视频，参考 DEMO：“绿幕抠图 - 视频背景”
