import { decodeImg } from "../av-utils";
import { Log } from "../log";
import { IClip } from "./iclip";

export class ImgClip implements IClip {
  ready: IClip["ready"];

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
  };

  #img: ImageBitmap | null = null;

  #frames: VideoFrame[] = [];

  constructor(
    dataSource: ImageBitmap | { type: "image/gif"; stream: ReadableStream },
  ) {
    if (dataSource instanceof ImageBitmap) {
      this.#img = dataSource;
      this.#meta.width = dataSource.width;
      this.#meta.height = dataSource.height;
      this.ready = Promise.resolve({
        width: dataSource.width,
        height: dataSource.height,
        duration: Infinity,
      });
    } else {
      this.ready = this.#gifInit(dataSource.stream, dataSource.type).then(
        () => ({
          width: this.#meta.width,
          height: this.#meta.height,
          duration: Infinity,
        }),
      );
    }
  }

  async #gifInit(stream: ReadableStream, type: string) {
    this.#frames = await decodeImg(stream, type);
    const firstVf = this.#frames[0];
    if (firstVf == null) throw Error("No frame available in gif");

    this.#meta = {
      duration: this.#frames.reduce((acc, cur) => acc + (cur.duration ?? 0), 0),
      width: firstVf.codedWidth,
      height: firstVf.codedHeight,
    };
    Log.info("ImgClip ready:", this.#meta);
  }

  async tick(time: number): Promise<{
    video: ImageBitmap | VideoFrame;
    state: "success";
  }> {
    if (this.#img != null) {
      return {
        video: await createImageBitmap(this.#img),
        state: "success",
      };
    }
    const tt = time % this.#meta.duration;
    return {
      video: (
        this.#frames.find(
          (f) => tt >= f.timestamp && tt <= f.timestamp + (f.duration ?? 0),
        ) ?? this.#frames[0]
      ).clone(),
      state: "success",
    };
  }

  destroy(): void {
    Log.info("ImgClip destroy");
    this.#img?.close();
    this.#frames.forEach((f) => f.close());
  }
}
