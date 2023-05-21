// https://github.com/ZhuangWeiMian/javascript_note/blob/master/webgl%E5%AD%A6%E4%B9%A0/%E9%80%8F%E6%98%8E%E8%A7%86%E9%A2%91/alpha-video-webgl.js

// https://blog.csdn.net/u013378269/article/details/110044818

class AlphaVideo {
  constructor (option) {
    const defaultOption = {
      src: '',
      autoplay: true,
      loop: true,
      canvas: null,
      // 默认透明视频展示大小
      width: 375,
      height: 300,
      onError: function () {},
      onPlay: function () {}
    }
    this.options = {
      ...defaultOption,
      ...option
    }
    this.radio = window.devicePixelRatio

    this.initVideo()
    this.initWebgl()

    if (this.options.autoplay) {
      this.video.play()
    }
  }

  initVideo () {
    const { onPlay, onError, loop, src } = this.options

    const video = document.createElement('video')
    video.autoplay = false
    video.mute = true
    video.volume = 0
    video.muted = true
    video.loop = loop
    video.setAttribute('x-webkit-airplay', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.setAttribute('playsinline', 'true')
    video.style.display = 'none'
    video.src = src
    video.crossOrigin = 'anonymous'
    video.addEventListener('canplay', () => {
      this.playing = true
      onPlay && onPlay()
    })
    video.addEventListener('error', () => {
      onError && onError()
    })
    video.addEventListener('play', () => {
      window.requestAnimationFrame(() => {
        this.drawFrame()
      })
    })
    document.body.appendChild(video)
    this.video = video
  }

  drawFrame () {
    if (this.playing) {
      this.drawWebglFrame()
    }
    window.requestAnimationFrame(() => {
      this.drawFrame()
    })
  }

  drawWebglFrame () {
    const gl = this.gl
    // 配置纹理图像
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      this.video
    )
    // 绘制
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  play () {
    this.playing = true
    this.video.play()
  }

  pause () {
    this.playing = false
    this.video.pause()
  }

  initWebgl () {
    this.canvas = this.options.canvas
    this.canvas.width = this.options.width * this.radio
    this.canvas.height = this.options.height * this.radio
    this.canvas.addEventListener('click', () => {
      this.play()
    })
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      document.body.appendChild(this.canvas)
    }

    const gl = this.canvas.getContext('webgl')
    gl.viewport(
      0,
      0,
      this.options.width * this.radio,
      this.options.height * this.radio
    )

    const program = this._initShaderProgram(gl)
    gl.linkProgram(program)
    gl.useProgram(program)

    const buffer = this._initBuffer(gl)

    // 绑定缓冲
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.position)
    const aPosition = gl.getAttribLocation(program, 'a_position')
    // 允许属性读取，将缓冲区的值分配给特定的属性
    gl.enableVertexAttribArray(aPosition)

    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.texture)
    const aTexCoord = gl.getAttribLocation(program, 'a_texCoord')
    gl.enableVertexAttribArray(aTexCoord)
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0)

    // 绑定纹理
    const texture = this._initTexture(gl)
    gl.bindTexture(gl.TEXTURE_2D, texture)

    const scaleLocation = gl.getUniformLocation(program, 'u_scale')
    gl.uniform2fv(scaleLocation, [this.radio, this.radio])

    this.gl = gl
  }

  _createShader (gl, type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader))
    }

    return shader
  }

  _initShaderProgram (gl) {
    // 顶点着色器glsl代码
    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      uniform vec2 u_scale;

      void main(void) {
          gl_Position = vec4(a_position, 0.0, 1.0);
          v_texCoord = a_texCoord;
      }
      `
    // 片元着色器 glsl 代码
    const fsSource = `
      precision lowp float;
      varying vec2 v_texCoord;
      uniform sampler2D u_sampler;

      void main(void) {
          gl_FragColor = vec4(texture2D(u_sampler, v_texCoord).rgb, texture2D(u_sampler, v_texCoord+vec2(-0.5, 0)).r);
      }
      `
    const vsShader = this._createShader(gl, gl.VERTEX_SHADER, vsSource)
    const fsShader = this._createShader(gl, gl.FRAGMENT_SHADER, fsSource)
    const program = gl.createProgram()
    gl.attachShader(program, vsShader)
    gl.attachShader(program, fsShader)
    gl.linkProgram(program)

    return program
  }

  _initBuffer (gl) {
    const positionVertice = new Float32Array([
      -1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0
    ])
    const positionBuffer = gl.createBuffer() // 创建buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer) // 把缓冲区对象绑定到目标
    gl.bufferData(gl.ARRAY_BUFFER, positionVertice, gl.STATIC_DRAW) // 向缓冲区对象写入刚定义的顶点数据

    const textureBuffer = gl.createBuffer()
    const textureVertice = new Float32Array([
      0.5, 1.0, 1.0, 1.0, 0.5, 0.0, 1.0, 0.0
    ]) // 这里将纹理左半部分映射到整个画布上
    gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, textureVertice, gl.STATIC_DRAW)

    return {
      position: positionBuffer,
      texture: textureBuffer
    }
  }

  _initTexture (gl) {
    const texture = gl.createTexture()

    gl.bindTexture(gl.TEXTURE_2D, texture)
    // 对纹理图像进行y轴反转，因为WebGL纹理坐标系统的t轴（分为t轴和s轴）的方向和图片的坐标系统Y轴方向相反。因此将Y轴进行反转。
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    // 配置纹理参数
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    return texture
  }
}

;(window as any).AlphaVideo = AlphaVideo
