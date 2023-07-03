const cvs = new OffscreenCanvas(1280, 720)
const gl = cvs.getContext('webgl', {
  alpha: true
})

const vsSource = [
  'precision mediump float;',

  'attribute vec4 position;',
  'attribute vec2 texCoord;',

  'uniform vec2 resolution;',
  'uniform mat4 transform;',

  'varying vec2 vTexCoord;',

  'uniform vec4 screen;',
  'uniform float balance;',
  'varying float screenSat;',
  'varying vec3 screenPrimary;',

  'void main(void) {',
  '	float fmin = min(min(screen.r, screen.g), screen.b);', //Min. value of RGB
  '	float fmax = max(max(screen.r, screen.g), screen.b);', //Max. value of RGB
  '	float secondaryComponents;',

  '	screenPrimary = step(fmax, screen.rgb);',
  '	secondaryComponents = dot(1.0 - screenPrimary, screen.rgb);',
  '	screenSat = fmax - mix(secondaryComponents - fmin, secondaryComponents / 2.0, balance);',

  // first convert to screen space
  '	vec4 screenPosition = vec4(position.xy * resolution / 2.0, position.z, position.w);',
  '	screenPosition = transform * screenPosition;',

  // convert back to OpenGL coords
  '	gl_Position = screenPosition;',
  '	gl_Position.xy = screenPosition.xy * 2.0 / resolution;',
  '	gl_Position.z = screenPosition.z * 2.0 / (resolution.x / resolution.y);',
  '	vTexCoord = texCoord;',
  '}'
].join('\n')

const fsSource = [
  // '#define MASK',
  '',
  'precision mediump float;',

  'varying vec2 vTexCoord;',

  'uniform sampler2D source;',
  'uniform vec4 screen;',
  'uniform float screenWeight;',
  'uniform float balance;',
  'uniform float clipBlack;',
  'uniform float clipWhite;',
  'uniform bool mask;',

  'varying float screenSat;',
  'varying vec3 screenPrimary;',

  'void main(void) {',
  '	float pixelSat, secondaryComponents;',
  '	vec4 sourcePixel = texture2D(source, vTexCoord);',

  '	float fmin = min(min(sourcePixel.r, sourcePixel.g), sourcePixel.b);', //Min. value of RGB
  '	float fmax = max(max(sourcePixel.r, sourcePixel.g), sourcePixel.b);', //Max. value of RGB
  //	luminance = fmax

  '	vec3 pixelPrimary = step(fmax, sourcePixel.rgb);',

  '	secondaryComponents = dot(1.0 - pixelPrimary, sourcePixel.rgb);',
  '	pixelSat = fmax - mix(secondaryComponents - fmin, secondaryComponents / 2.0, balance);', // Saturation

  // solid pixel if primary color component is not the same as the screen color
  '	float diffPrimary = dot(abs(pixelPrimary - screenPrimary), vec3(1.0));',
  '	float solid = step(1.0, step(pixelSat, 0.1) + step(fmax, 0.1) + diffPrimary);',

  /*
  Semi-transparent pixel if the primary component matches but if saturation is less
  than that of screen color. Otherwise totally transparent
  */
  '	float alpha = max(0.0, 1.0 - pixelSat / screenSat);',
  '	alpha = smoothstep(clipBlack, clipWhite, alpha);',
  '	vec4 semiTransparentPixel = vec4((sourcePixel.rgb - (1.0 - alpha) * screen.rgb * screenWeight) / max(0.00001, alpha), alpha);',

  '	vec4 pixel = mix(semiTransparentPixel, sourcePixel, solid);',

  /*
  Old branching code
  '	if (pixelSat < 0.1 || fmax < 0.1 || any(notEqual(pixelPrimary, screenPrimary))) {',
  '		pixel = sourcePixel;',

  '	} else if (pixelSat < screenSat) {',
  '		float alpha = max(0.0, 1.0 - pixelSat / screenSat);',
  '		alpha = smoothstep(clipBlack, clipWhite, alpha);',
  '		pixel = vec4((sourcePixel.rgb - (1.0 - alpha) * screen.rgb * screenWeight) / alpha, alpha);',
  '	}',
  //*/

  '#ifdef MASK',
  '	gl_FragColor = vec4(vec3(pixel.a), 1.0);',
  '#else',
  '	gl_FragColor = pixel;',
  '#endif',
  '}'
].join('\n')

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
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    vec3 tc = vec3(65. / 255., 249. / 255., 0.);

    void main () {
        vec4 c = texture2D(u_texture, v_texCoord);
        float dis = sqrt(pow(tc.r - c.r, 2.) + pow(tc.g - c.g, 2.) + pow(tc.b - c.b, 2.));
        gl_FragColor = c;
    }
`
// if (c.r >= 0.2) {
//   gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
// } else {
//   gl_FragColor = c;
// }
// gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0)
const pointPos = [-1, 1, -1, -1, 1, -1, 1, -1, 1, 1, -1, 1]
const texCoordPos = [0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1]

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

//
// 创建指定类型的着色器，上传 source 源码并编译
//
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

export async function chromakey (
  imgSource: VideoFrame | HTMLImageElement
  // gl: WebGLRenderingContext
): Promise<ImageBitmap> {
  if (gl == null) throw Error('Cant create gl context')

  // const shaderProgram = initShaderProgram(gl, vsSource, fsSource)
  const shaderProgram = initShaderProgram(gl, vertexShader, fragmentShader)
  gl.useProgram(shaderProgram)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointPos), gl.STATIC_DRAW)
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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoordPos), gl.STATIC_DRAW)
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
  const tex = loadTexture(gl, imgSource)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.drawArrays(gl.TRIANGLES, 0, 6)

  // const programInfo = {
  //   program: shaderProgram,
  //   attribLocations: {
  //     vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition')
  //   },
  //   uniformLocations: {
  //     projectionMatrix: gl.getUniformLocation(
  //       shaderProgram,
  //       'uProjectionMatrix'
  //     ),
  //     modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix')
  //   }
  // }

  // const buffers = initBuffers(gl)

  // Draw the scene
  // drawScene(gl, programInfo, buffers)

  // gl.drawImage(imgSource, 0, 0, imgSource.width, imgSource.height)
  return createImageBitmap(cvs)
}
