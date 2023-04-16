# WebAV

Audio and video tools built using pure web technology, which is planned to include creation, editing, and export features, which can be applied to live streaming, recorded tutorials, video clips, etc.  
使用纯Web技术构建的音视频工具，计划包含创建、编辑、导出功能，可应用于直播、教程录制、视频剪辑等产品中。  

## Motivation
Chrome version 94 supports the WebCodecs API, meaning that JS can also have the ability to process audio and video.  
Chrome 94 开放了 WebCodecs API，意味着 JS 也能处理音视频了。  

This is an experimental project that tries to provide an easy-to-use API for processing audio and video data in the browser.  
这是一个实验性项目，尝试提供简单易用的 API 在浏览器中处理音视频数据。  

## Packages
- [AVCanvas](packages/av-canvas/README.md)  
  Combine Text, Image, Video, Audio, UserMedia, DisplayMedia to generate MediaStream.  
- [AVRecorder](packages/av-recorder/README.md)  
  Record MediaStream, export MP4 stream.  