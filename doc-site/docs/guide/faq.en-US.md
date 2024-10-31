---
nav:
  title: Guide
  order: 2
group:
  title: other
order: 2
---

# FAQ

### Supported Video Formats

- MP4Clip supports video formats: mp4, mov, m4a.
- AudioClip supports popular audio formats (mp3, wav, m4a...), refer to WebAudio API for specific supported formats.
- Supported video codecs: AVC (H264), HEVC (H265).
  - AV1 is currently not supported.
  - HEVC (H265) support depends on your device.

For more details, read the article: [Compatibility Testing for Video Formats with WebCodecs](https://github.com/hughfenghen/hughfenghen.github.io/issues/129).

### WebAV Performance

Please refer to [WebCodecs Performance and Optimization Strategies](https://hughfenghen.github.io/posts/2024/07/27/webcodecs-performance-benchmark/).

Summary: Performance on some devices is close to native solutions, but there is still a slight gap overall, with further optimizations planned.

### WebAV Compatibility

Supported on Chrome/Edge 102+, not supported on Safari or Firefox.

**The website must use HTTPS or localhost**, otherwise:

- WebCodecs API will be detected as incompatible.
- The console will report the error: `Cannot read properties of undefined (reading 'getDirectory')`.
