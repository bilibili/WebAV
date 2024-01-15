import { MP4Previewer } from "../src/mp4-utils/mp4-previewer";
import { OPFSFileWrap } from "../src/mp4-utils/opfs-file-wrap";

const previewer = new MP4Previewer((await fetch('./video/webav1.mp4')).body!)
const imgEl = document.querySelector('#img') as HTMLImageElement

for (let i = 0; i < 10; i += 1) {
  const t = performance.now()
  const img = await previewer.getImage(i)
  console.log('cost:', performance.now() - t, img)
  if (img == null) break
  imgEl.src = img
}


// 测试 OPFSFileWrap
const opfsFile = new OPFSFileWrap('1111')

await opfsFile.write(new Uint8Array([1, 2, 3, 4, 5]))
await opfsFile.write(new Uint8Array([6, 7, 8, 9, 0]))