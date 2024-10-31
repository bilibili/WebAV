---
nav: DEMO
group:
  title: decode
  order: 2
order: 4
---

# Decode and Play

Using `WebCodecs + canvas + Web Audio` to decode and play video, the original image and audio data of the video can be obtained.

This gives you the most complete playback control you can get with a native `video` tag, such as:

- buffer control for low-latency scenarios.
- Drop frames based on device pressure conditions.
- Automatic recovery when decoding exception.
- Play frame by frame, super fast double speed play.
- Play audio at double speed without scaling
- Custom playback FPS.

The **cost** of this solution is complexity, and using `video` should be preferred unless you can't meet your needs.

### Play MP4

<code src="./1_4_1-play-video.tsx"></code>
