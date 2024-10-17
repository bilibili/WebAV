---
nav: DEMO
group:
  title: 合成

order: 5
---

# 合成再拼接

代码处理过程：

1. 移除三个视频素材的绿幕背景
2. 再给视频添加背景图片，合成输出三个独立的视频文件
3. 使用 `fastConcatMP4` 将三个视频文件首尾拼接成一个视频文件

<code src="./2_5_1-video-compsite-and-concat.tsx"></code>
