---
nav: DEMO
group:
  title: record video

order: 4
---

# Camera

Recording camera, output MP4 (AVC, AAC) real-time video stream, video stream can be written to a local file, or uploaded to the server.

The following example shows how to stream to a local file.The stream writes data during the recording process, so you'll need to create a local file to start with.

<code src="./4_1_1-recorder-usermedia.tsx"></code>

## Fixed output file not showing duration

Live video streams can't determine the end time, so the **total duration** field is missing. Most players can analyze the Sample and display the correct total duration;

However, some less compatible players (Windows Media Player) are unable to display duration information.

`fixFMP4Duration` temporarily saves the content to an [OPFS][1], adding the total duration field at the end of the video stream;

Because the duration information needs to be corrected at the end of the stream, it is not possible to upload the data in real time during the recording.

```ts
const outStream = await fixFMP4Duration(recorder.start());
```

Here is the complete example code, with the differences from the previous example:

The video data is temporarily saved in OPFS, and the duration field is fixed at the end of the recording, so the local file is only created when **Stop** is clicked.

<code src="./4_1_2-recorder-usermedia.tsx"></code>

[1]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
