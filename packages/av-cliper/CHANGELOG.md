# @webav/av-cliper

## 1.0.6

### Patch Changes

- Updated dependencies [3cc3cc7]
  - @webav/internal-utils@1.0.6

## 1.0.5

### Patch Changes

- ce5ebc8: fix: corrected the link to av-recorder
- 27e74c1: refactor: change the split method of the IClip interface to be optional #324
- Updated dependencies [ce5ebc8]
  - @webav/internal-utils@1.0.5

## 1.0.4

### Patch Changes

- f934fe6: fix: decode HEVC error when start with SEI
- edda979: workflow: add ci workflow to run ci:test
- Updated dependencies [edda979]
  - @webav/internal-utils@1.0.4

## 1.0.3

### Patch Changes

- b178269: chore: replace prepublishOnly with prepare scripts to auto build @webav/av-cliper and @webav/internal-utils
- Updated dependencies [b178269]
  - @webav/internal-utils@1.0.3

## 1.0.2

### Patch Changes

- 35aae3f: feat: createCombinator support more augs
  - @webav/internal-utils@1.0.2

## 1.0.1

### Patch Changes

- 720f20b: fix: black frame #308
  - @webav/internal-utils@1.0.1

## 1.0.0

### Major Changes

- 8212cb5: feat: v1

### Patch Changes

- 5631c29: fix: IDR frame recognition for HEVC #306
- Updated dependencies [8212cb5]
  - @webav/internal-utils@1.0.0

## 1.0.0-beta.1

### Patch Changes

- 5631c29: fix: IDR frame recognition for HEVC #306
  - @webav/internal-utils@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- feat: v1

### Patch Changes

- Updated dependencies
  - @webav/internal-utils@1.0.0-beta.0

## 0.16.5

### Patch Changes

- 3019a88: fix: IDR frame recognition for HEVC #306

## 0.16.4

### Patch Changes

- 759fecd: fix: other types of isIDRFrame judgments
- ed3c8ee: fix: wrong audio data when combination #299

## 0.16.3

### Patch Changes

- a67e569: Feature: add fixedScaleCenter mode in rect

## 0.16.2

## 0.16.1

### Patch Changes

- ef8605b: refactor: optimize the parsing of large MP4 files.

## 0.16.0

### Minor Changes

- e2a1387: feat: support change playbackRate for Sprite

## 0.15.5

### Patch Changes

- e3b9a74: fix: thumbnails error #265

## 0.15.4

## 0.15.3

### Patch Changes

- e9b5351: fix: recoder ouput vdieo cant play

## 0.15.2

### Patch Changes

- 21ffb44: fix: The output video has a corrupted image (artifacting)

## 0.15.1

### Patch Changes

- bd37284: fix: not has video frame when recode usermedia

## 0.15.0

### Minor Changes

- d935bdc: feat: custom fps for Combinator

### Patch Changes

- 8d76376: chore: merge bugfix

## 0.15.0-beta.1

### Patch Changes

- chore: merge bugfix

## 0.15.0-beta.0

### Minor Changes

- feat: custom fps for Combinator

## 0.14.15

### Patch Changes

- 7980ebd: fix: unable to recognize HEVC IDR frames #258
- a9d810a: fix: thumbnailByKeyFrame throw decoder error

## 0.14.14

### Patch Changes

- bd23942: chore: upgrade opfs-tools

## 0.14.13

### Patch Changes

- 95c37f8: fix: first frame incorrect when split MP4Clip #245

## 0.14.12

### Patch Changes

- 9bc7c2a: fix: remove debug code

## 0.14.11

### Patch Changes

- aff0d9f: fix: update the duration when the first sample is reset to 0.
- d81f8e3: fix: decoding error when fist item not IDR frame

## 0.14.10

## 0.14.9

### Patch Changes

- b4635d5: perf: mutli encoder

## 0.14.8

### Patch Changes

- 35f6811: fix: throw error when import sdk on node.js

## 0.14.7

### Patch Changes

- b65cb58: fix: timeout when quick seeking
- 42dc0fa: fix: fix the first render after seeking

## 0.14.6

### Patch Changes

- 8475ab0: perf: pre-decode and update calmdown strategy

## 0.14.5

### Patch Changes

- b77bd86: fix: VideoEncoder bug #203

## 0.14.4

### Patch Changes

- 2e7bfad: chore: upgrade opfs-tools

## 0.14.3

### Patch Changes

- 663f948: fix: MP4Clip.split does not correctly mark samples #207

## 0.14.2

### Patch Changes

- 85512d0: fix: A/V not sync

## 0.14.1

### Patch Changes

- 1443b24: fix: range error: array buffer allocation failed #201

## 0.14.0

### Minor Changes

- b2efb6f: perf: imporve perf for mp4clip

### Patch Changes

- 23ba479: perf: imporve perf for MP4Clip

## 0.13.10

### Patch Changes

- 623d12c: fix: not working in nested inlined worker

## 0.13.9

### Patch Changes

- 60fd9ed: fix: deocde timeout because many thumbnails task

## 0.13.8

### Patch Changes

- c7fcdcf: fix: gen thumbnails throw decode error

## 0.13.7

### Patch Changes

- 0fe21e5: chore: add timeout error log

## 0.13.6

### Patch Changes

- 737cb31: fix: cant stop decode audio when reset

## 0.13.5

### Patch Changes

- ebbb64c: fix: decode error when IDR frame has SEI data

## 0.13.4

### Patch Changes

- 5971c9b: feat: improve storage for mpclip

## 0.13.3

### Patch Changes

- bf41f68: fix: create log file error when init

## 0.13.2

### Patch Changes

- 6eebf28: fix: throw Error when MP4Clip.splitTrack then invoke split

## 0.13.1

### Patch Changes

- 68eab28: feat: custom changeset commit

## 0.13.0

### Minor Changes

- f83b3fa: docs(api): add a lot of api doc

## 0.12.6

### Patch Changes

- fix: mp4clip timeout, because dec.flush not resoloved

## 0.12.5

## 0.12.4

### Patch Changes

- abeae6a: fix: mp4clip timeout error

## 0.12.3

### Patch Changes

- 53b37c7: fix: hardware decode error

## 0.12.2

### Patch Changes

- 01b6724: feat: add progress event for hlsloader
- 834d322: fix: MP4Clip throw error when fisrt sample not key frame

## 0.12.1

### Patch Changes

- refactor: remove yarn, lerna

## 0.12.0

### Minor Changes

- refactor: switch to pnpm
