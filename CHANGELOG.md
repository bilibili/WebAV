# [0.1.0](https://github.com/WebAV-Tech/WebAV/compare/v0.4.0...v0.3.3) (2024-03-31)

**支持基本的裁剪功能**

1. 新增 `MP4Clip.deleteRange` 删除不想要的片段
2. 新增 `MP4Clip.thumbnails` 返回所有关键帧的缩略图
3. 新增素材克隆 `IClip.clone`
4. 新增 `MP4Clip.splitTrack` 拆分视频的音视频轨道为独立素材
5. 新增三个剪辑 DEMO：缩略图、预览裁剪、视频轨道拆分
6. 重构 MP4Clip.tick 支持获取任意时刻的图像帧、音频 PCM 数据

**破坏性更改**

1. `MP4Clip` 构造函数移除 `start`、`end` 字段
   - 迁移方法：新支持 `deleteRange` 方法，用于支持更灵活、性能更好地裁剪片段
2. MP4Clip 构建函数参数 audio 字段默认值变更 false -> true，默认保留 MP4Clip 的音频
   - 迁移方法：搜索 `new MP4CLip` 关键字，需要移除音频的素材添加参数 `{ audio: false }`
3. 废弃 MP4Previewer；1.0 将删除该该 API
   - 迁移方法：使用 `MP4CLip.tick` 替代 `MP4Previewer.preview`

---

EN

**Support for basic clipping functionality**

1. Added `MP4Clip.deleteRange` to remove unwanted segments.
2. Added `MP4Clip.thumbnails` to return thumbnails of all keyframes.
3. Added asset cloning with `IClip.clone`.
4. Added `MP4Clip.splitTrack` to split video tracks into separate assets.
5. Added three new clip demos: thumbnails, preview trimming, and video track splitting.
6. Refactored `MP4Clip.tick` to support retrieving image frames and audio PCM data at any given moment.

**Breaking Changes**

1. Removed `start` and `end` fields from the `MP4Clip` constructor.
   - Migration: Use the new `deleteRange` method for more flexible and better performing clip trimming.
2. Changed default value of `audio` parameter in `MP4Clip` constructor from `false` to `true`, preserving audio by default.
   - Migration: For assets where audio should be removed, add the parameter `{ audio: false }` when creating a new `MP4Clip`.
3. Deprecated `MP4Previewer`; it will be removed in version 1.0.
   - Migration: Replace `MP4Previewer.preview` with `MP4Clip.tick`.
