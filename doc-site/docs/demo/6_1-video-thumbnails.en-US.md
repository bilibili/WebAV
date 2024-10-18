---
nav: DEMO
group:
  title: Clip
  order: 2
order: 1
---

# Thumbnail

Video thumbnails are often used in the timeline module of editing tools. This DEMO extracts all key frames of a video, generates a thumbnail with a default width of 100px (customizable), and provides the corresponding timestamp.

<code src="./6_1_1-video-thumbnails.tsx"></code>

:::info
The "Time" in DEMO includes the consumption of decoding video frames + encoding thumbnails, excluding the time consumed by network loading video resources.
:::
