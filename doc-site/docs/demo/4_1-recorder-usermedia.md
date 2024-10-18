---
nav: DEMO
group:
  title: 视频录制

order: 2
---

# 摄像头

录制摄像头，输出 MP4（AVC, AAC）实时视频流，视频流可以写入本地文件，或上传到服务器。

下面示例演示将流写入本地文件，录制过程中流式写入数据，所以一开始就需要创建一个本地文件。

<code src="./4_1_1-recorder-usermedia.tsx"></code>

## 修复输出文件不显示时长

实时视频流不能确定结束时间，所以会缺失**总时长**字段，大部分播放器能分析 Sample 显示正确的总时长；
但某些兼容性较差的播放器（Windows Media Player）无法显示时长信息。

`fixFMP4Duration` 临时将内容保存到一个 [OPFS][1] 中，在视频流结束时添加总时长字段；
因为需要在流结束的时候去修正时长信息，所以无法在录制过程中实时上传数据。

```ts
const outStream = await fixFMP4Duration(recorder.start());
```

以下是完整的示例代码，与上一个示例的差异在于：
视频数据临时保存在 OPFS 中，在录制结束时修正了时长（duration）字段，所以在点击 **Stop** 时才需要创建本地文件。

<code src="./4_1_2-recorder-usermedia.tsx"></code>

[1]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
