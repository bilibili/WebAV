import { concatMP4 } from '../src/concat-mp4'

document.querySelector('#concatMP4')?.addEventListener('click', () => {
  ;(async function () {
    const [f1, f2] = await Promise.all(
      (await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Video',
            accept: { 'video/*': ['.mp4'] }
          }
        ],
        multiple: true
      }))
        .map(async (fh: FileSystemFileHandle) => await fh.getFile())
    )

    if (f1 == null || f2 == null) throw new Error('选择两个文件')

    concatMP4(f1, f2)
  })().catch(console.error)
})

export {}

// // eslint-disable-next-line
// ;(async () => {
//   const cvs = new OffscreenCanvas(10, 10)
//   const ctx = cvs.getContext('2d')
//   if (ctx == null) return
//   ctx.fillStyle = 'red'
//   ctx.fillRect(0, 0, 10, 10)
//   const vf = new VideoFrame(cvs, { timestamp: 1 })
//   const ab = new ArrayBuffer(100 * 4)
//   await vf.copyTo(ab)
//   console.log(1111, ab)

//   ctx.fillStyle = 'blue'
//   ctx.fillRect(0, 0, 10, 10)
//   const vf1 = new VideoFrame(cvs, { timestamp: 2 })
//   const ab1 = new ArrayBuffer(100 * 4)
//   await vf1.copyTo(ab1)
//   console.log(22222, ab1)
// })().catch(console.error)
