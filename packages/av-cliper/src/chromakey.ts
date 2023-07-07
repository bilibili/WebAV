const vertexShader = `
  attribute vec4 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main () {
    gl_Position = a_position;
    v_texCoord = a_texCoord;
  }
`

const fragmentShader = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform vec4 keyRGBA;    // key color as rgba
  uniform vec2 range;      // the smoothstep range

  varying vec2 v_texCoord;

  vec2 RGBToCC(vec4 rgba) {
    float Y = 0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b;
    return vec2((rgba.b - Y) * 0.565, (rgba.r - Y) * 0.713);
  }

  void main() {
    // 从贴图获取源像素
    vec4 srcColor = texture2D(u_texture, v_texCoord);
    // 源像素 RGB 转换为 YUV
    vec2 srcCC = RGBToCC(srcColor);
    // 目标颜色转换为 YUV
    vec2 keyCC = RGBToCC(keyRGBA);

    // 计算距离
    float mask = sqrt(pow(keyCC.x - srcCC.x, 2.0) + pow(keyCC.y - srcCC.y, 2.0));
    // 对距离值在range中进行平滑映射取值
    mask = smoothstep(range.x, range.y, mask);

    // 低于range下限
    if (mask == 0.0) { discard; }
    // 超过range上限
    else if (mask == 1.0) { gl_FragColor = srcColor; }
    // 处于range之中
    else {
      // 某些源像素（如头发边缘）混合了绿幕颜色，需要减去绿幕颜色，否则边缘会有绿斑
      gl_FragColor = max(srcColor - (1.0 - mask) * keyRGBA, 0.0);
    }
  }
`

const POINT_POS = [-1, 1, -1, -1, 1, -1, 1, -1, 1, 1, -1, 1]
const TEX_COORD_POS = [0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1]

//  初始化着色器程序，让 WebGL 知道如何绘制我们的数据
function initShaderProgram (
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
    throw Error('Unable to initialize the shader program')
  }

  return shaderProgram
}

// 创建指定类型的着色器，上传 source 源码并编译
function loadShader (gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!

  // Send the source to the shader object
  gl.shaderSource(shader, source)

  // Compile the shader program
  gl.compileShader(shader)

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    throw Error('An error occurred compiling the shaders')
  }

  return shader
}

function loadTexture (gl: WebGLRenderingContext, img: TexImageSourceWebCodecs) {
  var texture = gl.createTexture()
  if (texture == null) throw Error('Could not create texture')

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)

  return texture
}

function initCvs (opts: {
  width: number
  height: number
  keyColor: [number, number, number]
}) {
  const cvs = new OffscreenCanvas(opts.width, opts.height)
  const gl = cvs.getContext('webgl', {
    premultipliedAlpha: false,
    alpha: true
  })

  if (gl == null) throw Error('Cant create gl context')

  const shaderProgram = initShaderProgram(gl, vertexShader, fragmentShader)
  gl.useProgram(shaderProgram)

  gl.uniform4fv(gl.getUniformLocation(shaderProgram, 'keyRGBA'), [
    ...opts.keyColor.map(v => v / 255),
    1.0
  ])
  gl.uniform2fv(gl.getUniformLocation(shaderProgram, 'range'), [0.2, 0.48])

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

/**
 * 绿幕抠图
 * @param opts: { keyColor: [r, g, b] }
 */
export const createChromakey = (opts: {
  keyColor: [number, number, number]
}) => {
  let cvs: OffscreenCanvas | null = null
  let gl: WebGLRenderingContext | null = null

  return async (imgSource: VideoFrame | ImageBitmap | HTMLImageElement) => {
    if (cvs == null || gl == null) {
      const [width, height] =
        imgSource instanceof VideoFrame
          ? [imgSource.codedWidth, imgSource.codedHeight]
          : [imgSource.width, imgSource.height]
      ;({ cvs, gl } = initCvs({
        ...opts,
        width,
        height
      }))
    }
    const tex = loadTexture(gl, imgSource)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    if (imgSource instanceof VideoFrame) {
      const rs = new VideoFrame(cvs, {
        alpha: 'keep',
        timestamp: imgSource.timestamp,
        duration: imgSource.duration ?? undefined
      })
      imgSource.close()
      return rs
    }

    return createImageBitmap(cvs)
  }
}
