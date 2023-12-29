// 改编自 https://jameshfisher.com/2020/08/11/production-ready-green-screen-in-the-browser/
const vertexShader = `#version 300 es
  layout (location = 0) in vec4 a_position;
  layout (location = 1) in vec2 a_texCoord;
  out vec2 v_texCoord;
  void main () {
    gl_Position = a_position;
    v_texCoord = a_texCoord;
  }
`

const fragmentShader = `#version 300 es
precision mediump float;
out vec4 FragColor;
in vec2 v_texCoord;

uniform sampler2D frameTexture;
uniform vec3 keyColor;

// 色度的相似度计算
uniform float similarity;
// 透明度的平滑度计算
uniform float smoothness;
// 降低绿幕饱和度，提高抠图准确度
uniform float spill;

vec2 RGBtoUV(vec3 rgb) {
  return vec2(
    rgb.r * -0.169 + rgb.g * -0.331 + rgb.b *  0.5    + 0.5,
    rgb.r *  0.5   + rgb.g * -0.419 + rgb.b * -0.081  + 0.5
  );
}

void main() {
  // 获取当前像素的rgba值
  vec4 rgba = texture(frameTexture, v_texCoord);
  // 计算当前像素与绿幕像素的色度差值
  vec2 chromaVec = RGBtoUV(rgba.rgb) - RGBtoUV(keyColor);
  // 计算当前像素与绿幕像素的色度距离（向量长度）, 越相像则色度距离越小
  float chromaDist = sqrt(dot(chromaVec, chromaVec));
  // 设置了一个相似度阈值，baseMask为负，则表明是绿幕，为正则表明不是绿幕
  float baseMask = chromaDist - similarity;
  // 如果baseMask为负数，fullMask等于0；baseMask为正数，越大，则透明度越低
  float fullMask = pow(clamp(baseMask / smoothness, 0., 1.), 1.5);
  rgba.a = fullMask; // 设置透明度
  // 如果baseMask为负数，spillVal等于0；baseMask为整数，越小，饱和度越低
  float spillVal = pow(clamp(baseMask / spill, 0., 1.), 1.5);
  float desat = clamp(rgba.r * 0.2126 + rgba.g * 0.7152 + rgba.b * 0.0722, 0., 1.); // 计算当前像素的灰度值
  rgba.rgb = mix(vec3(desat, desat, desat), rgba.rgb, spillVal);
  FragColor = rgba;
}
`

const POINT_POS = [-1, 1, -1, -1, 1, -1, 1, -1, 1, 1, -1, 1]
const TEX_COORD_POS = [0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1]

//  初始化着色器程序，让 WebGL 知道如何绘制我们的数据
function initShaderProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)!
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)!

  // 创建着色器程序
  const shaderProgram = gl.createProgram()!
  gl.attachShader(shaderProgram, vertexShader)
  gl.attachShader(shaderProgram, fragmentShader)
  gl.linkProgram(shaderProgram)

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw Error(
      gl.getProgramInfoLog(shaderProgram) ??
      'Unable to initialize the shader program'
    )
  }

  return shaderProgram
}

// 创建指定类型的着色器，上传 source 源码并编译
function loadShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!

  // Send the source to the shader object
  gl.shaderSource(shader, source)

  // Compile the shader program
  gl.compileShader(shader)

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const errMsg = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw Error(errMsg ?? 'An error occurred compiling the shaders')
  }

  return shader
}

function updateTexture(
  gl: WebGLRenderingContext,
  img: TImgSource,
  texture: WebGLTexture
) {
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

function initTexture(gl: WebGLRenderingContext) {
  const texture = gl.createTexture()
  if (texture == null) throw Error('Create WebGL texture error')
  gl.bindTexture(gl.TEXTURE_2D, texture)

  // put a single pixel in the texture so we can use it immediately.
  const level = 0
  const internalFormat = gl.RGBA
  const width = 1
  const height = 1
  const border = 0
  const srcFormat = gl.RGBA
  const srcType = gl.UNSIGNED_BYTE
  const pixel = new Uint8Array([0, 0, 255, 255]) // opaque blue
  gl.texImage2D(
    gl.TEXTURE_2D,
    level,
    internalFormat,
    width,
    height,
    border,
    srcFormat,
    srcType,
    pixel
  )

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  return texture
}

interface IChromakeyOpts {
  keyColor: [number, number, number]
  similarity: number
  smoothness: number
  spill: number
}

function initCvs(opts: {
  width: number
  height: number
} & IChromakeyOpts) {
  const cvs = new OffscreenCanvas(opts.width, opts.height)
  const gl = cvs.getContext('webgl2', {
    premultipliedAlpha: false,
    alpha: true
  })

  if (gl == null) throw Error('Cant create gl context')

  const shaderProgram = initShaderProgram(gl, vertexShader, fragmentShader)
  gl.useProgram(shaderProgram)

  gl.uniform3fv(gl.getUniformLocation(shaderProgram, 'keyColor'),
    opts.keyColor.map(v => v / 255),
  )
  gl.uniform1f(gl.getUniformLocation(shaderProgram, 'similarity'), opts.similarity)
  gl.uniform1f(gl.getUniformLocation(shaderProgram, 'smoothness'), opts.smoothness)
  gl.uniform1f(gl.getUniformLocation(shaderProgram, 'spill'), opts.spill)

  const posBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(POINT_POS), gl.STATIC_DRAW)
  const a_position = gl.getAttribLocation(shaderProgram, 'a_position')
  gl.vertexAttribPointer(
    a_position,
    2,
    gl.FLOAT,
    false,
    Float32Array.BYTES_PER_ELEMENT * 2,
    0
  )
  gl.enableVertexAttribArray(a_position)

  const texCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(TEX_COORD_POS),
    gl.STATIC_DRAW
  )
  const a_texCoord = gl.getAttribLocation(shaderProgram, 'a_texCoord')
  gl.vertexAttribPointer(
    a_texCoord,
    2,
    gl.FLOAT,
    false,
    Float32Array.BYTES_PER_ELEMENT * 2,
    0
  )
  gl.enableVertexAttribArray(a_texCoord)

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)

  return { cvs, gl }
}

type TImgSource =
  | HTMLVideoElement
  | HTMLCanvasElement
  | HTMLImageElement
  | ImageBitmap
  | OffscreenCanvas
  | VideoFrame

function getSourceWH(imgSource: TImgSource) {
  return imgSource instanceof VideoFrame
    ? { width: imgSource.codedWidth, height: imgSource.codedHeight }
    : { width: imgSource.width, height: imgSource.height }
}

function getKeyColor(imgSource: TImgSource) {
  const cvs = new OffscreenCanvas(1, 1)
  const ctx = cvs.getContext('2d')!
  ctx.drawImage(imgSource, 0, 0)
  const {
    data: [r, g, b]
  } = ctx.getImageData(0, 0, 1, 1)
  return [r, g, b] as [number, number, number]
}

/**
 * 绿幕抠图
 * keyColor 需要扣除的背景色，若不传则取第一个像素点
 * similarity 背景色相似度阈值，过小可能保留背景色，过大可能扣掉更多非背景像素点
 * smoothness 平滑度；过小可能出现锯齿，过大导致整体变透明
 * spill      饱和度；过小可能保留绿色混合，过大导致图片变灰度
 * @param opts: {
 *   keyColor?: [r, g, b]
 *   similarity: number
 *   smoothness: number
 *   spill: number
 * }
 */
export const createChromakey = (
  opts: Omit<IChromakeyOpts, 'keyColor'> & { keyColor?: [number, number, number] }
) => {
  let cvs: OffscreenCanvas | null = null
  let gl: WebGLRenderingContext | null = null
  let keyC = opts.keyColor
  let texture: WebGLTexture | null = null

  return async (imgSource: TImgSource) => {
    if (cvs == null || gl == null || texture == null) {
      if (keyC == null) keyC = getKeyColor(imgSource)
        ; ({ cvs, gl } = initCvs({
          ...getSourceWH(imgSource),
          keyColor: keyC,
          ...opts
        }))
      texture = initTexture(gl)
    }

    updateTexture(gl, imgSource, texture)

    if (
      globalThis.VideoFrame != null &&
      imgSource instanceof globalThis.VideoFrame
    ) {
      const rs = new VideoFrame(cvs, {
        alpha: 'keep',
        timestamp: imgSource.timestamp,
        duration: imgSource.duration ?? undefined
      })
      imgSource.close()
      return rs
    }

    return createImageBitmap(cvs, {
      imageOrientation: imgSource instanceof ImageBitmap ? 'flipY' : 'none'
    })
  }
}
