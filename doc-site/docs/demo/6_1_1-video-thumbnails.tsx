import { useState, useEffect } from 'react';
import { MP4Clip } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['video/bunny.mp4']);

async function start() {
  const clip = new MP4Clip((await fetch(resList[0])).body!);
  await clip.ready;
  let t = performance.now();
  const imgList = await clip.thumbnails();
  const cost = ((performance.now() - t) / 1000).toFixed(2);
  return {
    imgList,
    cost,
  };
}

export default function UI() {
  const [imgList, setImgList] = useState<Array<{ ts: number; img: string }>>(
    [],
  );
  const [cost, setCost] = useState(0);

  useEffect(() => {
    (async () => {
      const { imgList, cost } = await start();
      setImgList(
        imgList.map((it) => ({
          ts: it.ts,
          img: URL.createObjectURL(it.img),
        })),
      );
      setCost(cost);
    })();
  }, []);

  return (
    <>
      <div>
        {imgList.length === 0
          ? 'loading...'
          : `耗时：${cost}s，关键帧数：${imgList.length}`}
      </div>
      <br />
      <div className="flex flex-wrap">
        {imgList.map((it) => (
          <div key={it.ts}>
            <div className="text-center">{(it.ts / 1e6).toFixed(2)}s</div>
            <img src={it.img}></img>
          </div>
        ))}
      </div>
    </>
  );
}
