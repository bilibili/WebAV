---
nav: DEMO
group:
  title: Composite

order: 3
---

# Audio Composite

## Sound Mixing

Mix two audio files and output m4a audio file.

If `new Combiator` does not provide a `width, height` or any value of 0, then no video track will be created and an m4a audio file will be generated.

<code src="./2_3_1-audio-mixin.tsx"></code>

:::warning
`AudioClip` internally uses`AudioContext`to decode audio files, so it won't work in WebWorkers.
:::

## Splicing Audio

Concatenate the two audio files end to end to output the m4a audio file.

<code src="./2_3_2-audio-mixin.tsx"></code>
