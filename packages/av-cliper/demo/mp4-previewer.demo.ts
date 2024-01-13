import { MP4Previewer } from "../src/mp4-utils/mp4-previewer";

const previewer = new MP4Previewer((await fetch('./video/webav1.mp4')).body!)

console.log(previewer.getVideoFrame(5))