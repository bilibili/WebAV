/*
 *  chromagl.js
 *
 *  ChromaGL - Javascript Library for Video Chroma Key (blue/green-screen effect) using WebGL
 *
 *  Original Author: Brian Chirls http://chirls.com
 *  GitHub: https://github.com/brianchirls/ChromaGL
 *  License: MIT
 *
 *  Copyright (c) 2011 Mozilla Foundation
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 *
 */

(function (window, undefined) {

	var keyCount = 0;
	var vertexShader = '';
	var fragmentShaderAlpha = '';
	var fragmentShaderPaint = '';

	vertexShader = '#ifdef GL_ES\n' +
		'precision highp float;\n' +
		'#endif \n' +
		'\n' +
		'attribute vec3 position;\n' +
		'attribute vec2 texCoord;\n' +
		'\n' +
		'varying vec2 vTexCoord;\n' +
		'varying vec4 vPosition;\n' +
		'varying vec2 vSourceCoord;\n' +
		'varying vec2 vAlphaCoord;\n' +
		'\n' +
		'uniform vec4 sourceArea;\n' +
		'uniform vec4 alphaArea;\n' +
		'\n' +
		'void main(void) {\n' +
		'	gl_Position = vec4(position, 1.0);\n' +
		'	vTexCoord = vec2(texCoord.s, texCoord.t);\n' +
		'	vSourceCoord = vec2(sourceArea.x + texCoord.s * sourceArea.z, sourceArea.y + texCoord.t * sourceArea.w);\n' +
		'	vAlphaCoord = vec2(alphaArea.x + texCoord.s * alphaArea.z, alphaArea.y + texCoord.t * alphaArea.w);\n' +
		'}\n';

	fragmentShaderAlpha = '#ifdef GL_ES\n' +
		'precision highp float;\n' +
		'#endif\n' +
		'\n' +
		'varying vec2 vTexCoord;\n' +
		'varying vec4 vPosition;\n' +
		'varying vec2 vSourceCoord;\n' +
		'varying vec2 vAlphaCoord;\n' +
		'\n' +
		'uniform sampler2D source;\n' +
		'\n' +
		'vec4 sourcePixel;\n' +
		'vec4 alphaPixel;\n' +
		'\n' +
		'const mat3 yuv = mat3(\n' +
		'	54.213, 182.376, 18.411,\n' +
		'	-54.213, -182.376, 236.589,\n' +
		'	200.787, -182.376, -18.411\n' +
		');\n' +
		'\n' +
		'vec4 preAlpha(int sourceChannel, int targetChannel, vec4 pixel) {\n' +
		'	float alpha;\n' +
		'	if (sourceChannel == 0) {\n' +
		'		alpha = alphaPixel.r;\n' +
		'	} else if (sourceChannel == 1) {\n' +
		'		alpha = alphaPixel.g;\n' +
		'	} else if (sourceChannel == 2) {\n' +
		'		alpha = alphaPixel.b;\n' +
		'	} else { \n' +
		'		alpha = 0.0;\n' +
		'	}\n' +
		'	\n' +
		'	vec4 outputPixel = vec4(pixel);\n' +
		'	if (targetChannel == 0) {\n' +
		'		outputPixel.r = min(outputPixel.r, alpha);\n' +
		'	} else if (targetChannel == 1) {\n' +
		'		outputPixel.g = min(outputPixel.g, alpha);\n' +
		'	} else if (targetChannel == 2) {\n' +
		'		outputPixel.b = min(outputPixel.b, alpha);\n' +
		'	}\n' +
		'	return outputPixel; \n' +
		'}\n' +
		'\n' +
		'vec4 distAlpha(int targetChannel, vec3 target, float threshold, float fuzzy, vec4 pixel) {\n' +
		'	float distance2, sum, alpha;\n' +
		'	\n' +
		'	vec3 yuvColorDiff = sourcePixel.rgb * yuv - target;\n' +
		'	\n' +
		'	distance2 = dot(yuvColorDiff, yuvColorDiff);\n' +
		'	\n' +
		'	alpha = smoothstep(threshold, threshold * fuzzy, distance2);\n' +
		'	\n' +
		'	vec4 outputPixel = vec4(pixel);\n' +
		'	if (targetChannel == 0) {\n' +
		'		outputPixel.r *= alpha;\n' +
		'	} else if (targetChannel == 1) {\n' +
		'		outputPixel.g *= alpha;\n' +
		'	} else if (targetChannel == 2) {\n' +
		'		outputPixel.b *= alpha;\n' +
		'	}\n' +
		'	//outputPixel = vec4(abs(x1)/255.0, abs(y1)/255.0, abs(z1)/255.0, 1.0);\n' +
		'	//outputPixel = sourcePixel;\n' +
		'	//outputPixel = vec4(target/255.0, 1.0);\n' +
		'	//outputPixel = vec4(distance2/10000.0, distance2/10000.0, distance2/10000.0, 1.0);\n' +
		'	return outputPixel; \n' +
		'}\n' +
		'\n' +
		'void main(void) {\n' +
		'#ifdef pre\n' +
		'		sourcePixel = texture2D(source, vSourceCoord);\n' +
		'#else\n' +
		'		sourcePixel = texture2D(source, vTexCoord);\n' +
		'#endif\n' +
		'	alphaPixel = texture2D(source, vAlphaCoord);\n' +
		'	vec4 pixel = vec4(1.0);\n' +
		'	%keys%\n' +
		'	pixel.a = min(pixel.r, min(pixel.g, pixel.b));\n' +
		'	gl_FragColor = pixel;\n' +
		'	//gl_FragColor = alphaPixel;\n' +
		'	//gl_FragColor = texture2D(source, vTexCoord);\n' +
		'	//gl_FragColor = vec4(vTexCoord.y, vTexCoord.y, vTexCoord.y, 1.0);\n' +
		'	//gl_FragColor = vec4(vAlphaCoord.y, vAlphaCoord.y, vAlphaCoord.y, 1.0);\n' +
		'	//gl_FragColor = vec4(vSourceCoord.y, vSourceCoord.y, vSourceCoord.y, 1.0);\n' +
		'}\n';

	fragmentShaderPaint = '#ifdef GL_ES\n\n' +
		'precision highp float;\n\n' +
		'#endif\n\n' +
		'\n' +
		'varying vec2 vTexCoord;\n' +
		'varying vec4 vPosition;\n' +
		'varying vec2 vSourceCoord;\n' +
		'varying vec2 vAlphaCoord;\n' +
		'\n' +
		'uniform sampler2D source;\n' +
		'uniform sampler2D alpha;\n' +
		'uniform vec4 alphaChannel;\n' +
		'\n' +
		'void main(void) {\n' +
		'	vec4 pixel;\n' +
		'	vec4 alphaPixel;\n' +
		'#ifdef pre\n' +
		'		pixel = texture2D(source, vSourceCoord);\n' +
		'#else\n' +
		'		pixel = texture2D(source, vTexCoord);\n' +
		'#endif\n' +
		'	alphaPixel = texture2D(alpha, vec2(vTexCoord.x, 1.0 - vTexCoord.y));\n' +
		/*
			set this vector because a dot product should be MUCH faster
			in a shader than a big "if" statement				*/
		'	pixel.a = dot(alphaPixel, alphaChannel);\n' +
		'	gl_FragColor = pixel;\n' +
		'	//gl_FragColor = alphaPixel;\n' +
		'	//gl_FragColor = vec4(alphaPixel.r, vTexCoord.y, vTexCoord.y, 1.0);\n' +
		'	//gl_FragColor = vec4(alphaPixel.r, vAlphaCoord.y, vAlphaCoord.y, 1.0);\n' +
		'}\n';

	function checkType(object, type) {
		return Object.prototype.toString.call(object) === '[object ' + type + ']';
	}

	function fail(msg) {
		if (this.errorCallback) {
			this.errorCallback(msg);
		} else {
			throw msg;
		}
	}

	var nodeData = {
		video: {
			ready: "readyState",
			//			readyTarget: 2,
			load: "canplay",
			width: "videoWidth",
			height: "videoHeight"
		},
		img: {
			ready: "complete",
			load: "load",
			width: "width",
			height: "height"
		},
		canvas: {
			ready: "complete",
			load: "load",
			width: "width",
			height: "height"
		}
	};

	var colors = {
		green: [0, 255, 0],
		blue: [50, 70, 135]
	};

	function buildWebGlBuffers() {
		//todo: change this to line_strip or fan for speed?
		var gl = this._context;
		var vertexPositionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1, -1, 0,
			1, -1, 0,
			1, 1, 0,
			-1, 1, 0
		]), gl.STATIC_DRAW);
		vertexPositionBuffer.itemSize = 3;
		vertexPositionBuffer.numItems = 4;

		var texCoordBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			0, 1,
			1, 1,
			1, 0,
			0, 0
		]), gl.STATIC_DRAW);
		texCoordBuffer.itemSize = 2;
		texCoordBuffer.numItems = 4;

		var vertexIndexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
			0, 2, 1, 0, 3, 2    // Front face
		]), gl.STATIC_DRAW);
		vertexIndexBuffer.itemSize = 1;
		vertexIndexBuffer.numItems = 6;

		this._vertexPositionBuffer = vertexPositionBuffer;
		this._vertexIndexBuffer = vertexIndexBuffer;
		this._texCoordBuffer = texCoordBuffer;
	}

	function setUpShaders() {
		var gl = this._context;

		var i, key, keyFunctions = '';
		var hasPreCalc = false;
		for (i in this._keys) {
			if (this._keys.hasOwnProperty(i)) {
				key = this._keys[i];
				if (key.mode === 'chroma') {
					var r = key.color[0];
					var g = key.color[1];
					var b = key.color[2];

					var fuzzy = key.fuzzy;
					if (Math.floor(fuzzy) === fuzzy) {
						fuzzy += '.0';
					}

					var thresh = key.threshold * key.threshold;
					if (Math.floor(thresh) === thresh) {
						thresh += '.0';
					}

					//convert target color to YUV
					keyFunctions += 'pixel = distAlpha(' + key.channel + ', vec3(' +
						(0.2126 * r + 0.7152 * g + 0.0722 * b) + ',' +
						(-0.2126 * r + -0.7152 * g + 0.9278 * b) + ',' +
						(0.7874 * r + -0.7152 * g + 0.0722 * b) +
						'), ' + thresh + ', ' + fuzzy + ', pixel);\n';
				} else {
					hasPreCalc = true;
					keyFunctions += 'pixel = preAlpha(' + key.source + ',' + key.channel + ', pixel);\n';
				}
			}
		}

		if (!keyFunctions) {
			keyFunctions = 'pixel = sourcePixel;\n';
		}

		var fragmentSrc = fragmentShaderAlpha.replace('%keys%', keyFunctions);
		if (hasPreCalc) {
			fragmentSrc = "#define pre\n" + fragmentSrc;
		}
		this.alphaShader = new ShaderProgram(gl, vertexShader, fragmentSrc);

		var sourceX = this.sourceX;
		var sourceY = this.sourceY;
		var sourceWidth = this.sourceWidth;
		var sourceHeight = this.sourceHeight;

		var alphaX = this.alphaX;
		var alphaY = this.alphaY;
		var alphaWidth = this.alphaWidth;
		var alphaHeight = this.alphaHeight;

		this.alphaShader.set_sourceArea(sourceX, sourceY, sourceWidth, sourceHeight);
		this.alphaShader.set_alphaArea(alphaX, alphaY, alphaWidth, alphaHeight);

		var painterSrc = fragmentShaderPaint;
		if (hasPreCalc) {
			painterSrc = "#define pre\n" + painterSrc;
		}
		this.paintShader = new ShaderProgram(gl, vertexShader, painterSrc);
		this.paintShader.set_sourceArea(sourceX, sourceY, sourceWidth, sourceHeight);
		this.paintShader.set_alphaArea(alphaX, alphaY, alphaWidth, alphaHeight);

	}

	function initializeTextures() {
		var gl = this._context;

		//this assumes media has been loaded
		function loadTexture(media) {
			var texture = gl.createTexture();

			texture.image = media;

			gl.bindTexture(gl.TEXTURE_2D, texture);

			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.bindTexture(gl.TEXTURE_2D, null);

			texture.height = texture.image.height;
			texture.width = texture.image.width;
			return texture;
		}

		this._mediaTexture = loadTexture(this._media);
	}

	function refreshVideoTexture(texture) {
		var gl = this._context;

		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}

	function initializeFrameBuffer(width, height, format) {
		//set up frame buffer
		var gl = this._context;
		var fmt = format || gl.UNSIGNED_BYTE;
		var obj = {};
		var tex;

		var frameBuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

		var texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		try {
			if (fmt === gl.FLOAT) {
				tex = new Float32Array(width * height * 4);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.DEPTH_COMPONENT, gl.FLOAT, tex);
			} else {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, fmt, null);
			}
		} catch (e) {
			// Null rejected
			if (format === gl.UNSIGNED_SHORT_4_4_4_4) {
				tex = new Uint16Array(width * height * 4);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_SHORT_4_4_4_4, tex);
			} else {
				tex = new Uint8Array(width * height * 4);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex);
			}
		}

		var renderBuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		//clean up
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);


		if (!gl.isFramebuffer(frameBuffer)) {
			throw ("Invalid framebuffer");
		}
		var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		switch (status) {
			case gl.FRAMEBUFFER_COMPLETE:
				break;
			case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
				throw ("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
			case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
				throw ("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
			case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
				throw ("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
			case gl.FRAMEBUFFER_UNSUPPORTED:
				throw ("Incomplete framebuffer: FRAMEBUFFER_UNSUPPORTED");
			default:
				throw ("Incomplete framebuffer: " + status);
		}

		obj.frameBuffer = frameBuffer;
		obj.texture = texture;
		obj.width = width;
		obj.height = height;
		return obj;
	}

	function drawScreen(shader, sourceTexture, alphaTexture, channel) {
		var gl = this._context;
		shader.useProgram();

		/* todo: do this all only once at the beginning, since we only have one model */
		gl.enableVertexAttribArray(shader.location_position);
		gl.enableVertexAttribArray(shader.location_texCoord);

		gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer);
		gl.vertexAttribPointer(shader.location_texCoord, this._texCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexPositionBuffer);
		gl.vertexAttribPointer(shader.location_position, this._vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._vertexIndexBuffer);

		//set up textures
		if (sourceTexture) {
			shader.set_source(0);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
		}

		if (alphaTexture) {
			shader.set_alpha(1);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, alphaTexture);
			if (shader.set_alphaChannel) {
				//set this vector because a dot product should be MUCH faster in a shader than a big "if" statement
				//...in theory.
				switch (channel) {
					case 0:
						shader.set_alphaChannel(1, 0, 0, 0);
						break;
					case 1:
						shader.set_alphaChannel(0, 1, 0, 0);
						break;
					case 2:
						shader.set_alphaChannel(0, 0, 1, 0);
						break;
					case 3:
					default:
						shader.set_alphaChannel(0, 0, 0, 1);
						break;
				}
			}
		}

		/* clipping */
		if (this.clipping) {
			gl.enable(gl.SCISSOR_TEST);
			gl.scissor(this.clipX * gl.viewportWidth, ((1 - this.clipY - this.clipHeight) * gl.viewportHeight), this.clipWidth * gl.viewportWidth, this.clipHeight * gl.viewportHeight);
		} else {
			gl.disable(gl.SCISSOR_TEST);
		}

		/* do this every time */
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);

		// draw!
		gl.drawElements(gl.TRIANGLES, this._vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
		var err = gl.getError();
		if (err) {
			console.log('draw error: ' + err);
		}

		//disable this again, in case someone else is using the same context
		if (this.clipping) {
			gl.disable(gl.SCISSOR_TEST);
		}
	}

	function checkReady(callback) {
		if (!this.initialized) {
			return;
		}

		if (!this._data.ready || !this._data.load ||
			this._media[this._data.ready] === this._data.readyTarget ||
			(this._data.readyTarget === undefined && this._media[this._data.ready])) {

			initializeTextures.apply(this);
			setUpShaders.apply(this);
			this.refresh();
			if (callback && checkType(callback, 'Function')) {
				callback();
			}
		} else {
			var obj = this;
			/*
			this._media.addEventListener( this._data.load , function() {
				checkReady.apply(obj, callback);
			}, false);
			*/
			setTimeout(function () {
				checkReady.apply(obj, callback);
			}, 0);
		}

	}

	function setUpWebGl() {
		var gl = this._context;

		gl.viewportWidth = gl.canvas.width;
		gl.viewportHeight = gl.canvas.height;
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

		//set up frame buffer
		this.alphaFrameBuffer = initializeFrameBuffer.call(this, gl.canvas.width, gl.canvas.height);
		this.outputFrameBuffer = initializeFrameBuffer.call(this, gl.canvas.width, gl.canvas.height);

		//set up shader programs
		setUpShaders.apply(this);
	}

	function ChromaGL(source, target, options) {
		var opts = options || {};

		this.errorCallback = opts.errorCallback;

		if (!this.hasWebGL()) {
			//todo: fall back to canvas2d method, if allowed
			fail.apply(this, 'Browser does not support WebGL');
			return;
		}

		if (!this.source(source || false)) {
			return false;
		}

		if (!this.target(target || false)) {
			return false;
		}

		//todo: put this in a method
		var clip = opts.clip || {};
		this.clipX = clip.x || 0;
		this.clipY = clip.y || 0;
		this.clipWidth = clip.width || 1 - this.clipX;
		this.clipHeight = clip.height || 1 - this.clipY;
		this.clipping = (this.clipX || this.clipY || this.clipWidth < 1 || this.clipHeight < 1);

		//todo: scale (x and y) option?

		//todo: put this in a method
		var sourceDimensions = opts.source || {};
		this.sourceX = sourceDimensions.x || 0;
		this.sourceY = sourceDimensions.x || 0;
		this.sourceWidth = sourceDimensions.width || 1 - this.sourceX;
		this.sourceHeight = sourceDimensions.height || (0.5 - this.sourceY);
		var alpha = opts.alpha || {};
		this.alphaX = alpha.x || 0;
		this.alphaY = alpha.y !== undefined ? alpha.y : this.sourceHeight;
		this.alphaWidth = alpha.width !== undefined ? alpha.width : 1 - this.alphaX;
		this.alphaHeight = alpha.height !== undefined ? alpha.height : (1 - this.alphaY);

		buildWebGlBuffers.apply(this);

		this._keys = {};

		this.initialized = true;
		this.dirty = true;
		checkReady.call(this);
	}
	window.ChromaGL = ChromaGL;

	ChromaGL.prototype.hasWebGL = function () {
		return !!window.WebGLRenderingContext;
	};

	ChromaGL.prototype.source = function (source) {
		if (source === undefined) {
			return this._media;
		}

		var element;
		if (checkType(source, 'String')) {
			element = document.getElementById(source) || document.getElementsByTagName(source)[0];
		} else if (source.tagName) {
			element = source;
		}

		if (!element) {
			fail.apply(this, 'Missing source element');
			return false;
		}

		this._data = nodeData[element.tagName.toLowerCase()];
		if (!this._data) {
			fail.apply(this, 'Unsupported source media type');
			return false;
		}

		this._media = element;
		this.dirty = true;

		checkReady.call(this);

		return this;
	};

	ChromaGL.prototype.target = function (target) {
		if (target === undefined) {
			return this._target;
		}

		var context;
		var element;
		var is2D = false;
		if (checkType(target, 'String')) {
			element = document.getElementById(target) || document.getElementsByTagName(target)[0];
		} else if (checkType(target, 'CanvasRenderingContext2D')) {
			//target is a 2D context
			context = target;
			element = target.canvas;
			this._drawMode = '2d';
			is2D = true;
		} else if (checkType(target, 'WebGLRenderingContext')) {
			//target is a WebGL context
			context = target;
			element = target.canvas;
			this._drawMode = 'webgl';
		} else if (target.tagName) {
			element = target;
		}

		if (!element) {
			fail.apply(this, 'Missing source element');
			return false;
		}

		if (element && !checkType(element, 'HTMLCanvasElement')) {
			fail.apply(this, 'Target must be a canvas or context');
			return false;
		}

		if (!context) {
			//set up WebGL context
			try {
				context = element.getContext('experimental-webgl');
				this._context = (context); //WebGLDebugUtils.makeDebugContext
				this._drawMode = 'webgl';
			} catch (e) {
				try {
					//future proof
					context = element.getContext('webgl');
					this._context = context;
					this._drawMode = 'webgl';
				} catch (e2) {
				}
			}
		}
		if (!context || is2D) {
			if (!context) {
				context = element.getContext('2d');
				this._drawMode = '2d';
			}

			//this canvas already has a 2d context, so let's create a new one
			var canvas = document.createElement('canvas');
			canvas.width = element.width;
			canvas.height = element.height;
			try {
				this._context = canvas.getContext('experimental-webgl');
			} catch (e3) {
				try {
					//future proof
					this._context = canvas.getContext('webgl');
				} catch (e4) {
				}
			}
			//todo: fall back to 2d canvas if webgl is unavailable
		}

		this._target = context;
		this.dirty = true;

		setUpWebGl.apply(this);

		return this;
	};

	ChromaGL.prototype.go = function (frameRate, play) {
		frameRate = frameRate || 25;
		this._frameRate = frameRate;

		if (this._interval) {
			clearInterval(this._interval);
		}

		var obj = this;
		this._interval = setInterval(function () {
			obj.refresh(true);
		}, 1000 / frameRate);

		/*
			Weird bug in video driver on MacBook causes errors if you leave the page alone for a while and come back.  This might get around it.

			Create a wrapper around paint function. In case someone else sets the same focus event to the same .paint() method, we don't want to remove their event when we .stop() later
		*/
		this._focusListener = function () {
			obj.paint();
		};
		window.addEventListener('focus', this._focusListener, false);

		if (play && this._media && checkType(this._media.play, 'Function')) {
			this._media.play();
		}

		return this;
	};

	ChromaGL.prototype.stop = function (pause) {
		if (this._interval) {
			clearInterval(this._interval);
		}
		this._interval = false;

		if (pause && this._media && checkType(this._media.pause, 'Function')) {
			this._media.pause();
		}

		if (this._focusListener) {
			window.removeEventListener('focus', this._focusListener, false);
		}
		this._focusListener = null;
	};

	ChromaGL.prototype.refresh = function (clear, noThrottle) {
		if (this._mediaTexture && this._mediaTexture.image && this._media[this._data.ready]) { // && this._mediaTexture.image instanceof HTMLVideoElement) { //todo: use checkType?
			var image = this._mediaTexture.image;
			if (image.lastUpdateFrame !== image.currentTime || image.currentTime === undefined) {  //todo: do this better
				if (image.currentTime === undefined) {
					image.currentTime = 0;
				}
				image.lastUpdateFrame = image.currentTime;
				refreshVideoTexture.call(this, this._mediaTexture);
				this.dirty = true;
			}
		}

		if (this.dirty || noThrottle) {
			if (clear) {
				this._context.clearColor(0.0, 0.0, 0.0, 0.0);
				this._context.clear(this._context.COLOR_BUFFER_BIT);
			}
			this.paint();
		}
	};

	ChromaGL.prototype.paint = function () {
		if (this.alphaShader && this._media[this._data.ready]) {
			var gl = this._context;

			//draw alpha channels to frame buffer
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.alphaFrameBuffer.frameBuffer);
			gl.clear(gl.COLOR_BUFFER_BIT);
			drawScreen.call(this, this.alphaShader, this._mediaTexture, null);
			this.dirty = false;

			//draw to canvas
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			drawScreen.call(this, this.paintShader, this._mediaTexture, this.alphaFrameBuffer.texture);
			this.dirty = false;
		}
	};

	ChromaGL.prototype.setThreshold = function (id, threshold, fuzzy) {
		if (this._keys[id] && this._keys[id].mode === 'chroma') {
			this._keys[id].threshold = isNaN(threshold) ? 94.86832980505137 : parseFloat(threshold);

			this._keys[id].fuzzy = isNaN(fuzzy) ? (isNaN(threshold) ? 1.25 : this._keys[id].fuzzy) : parseFloat(fuzzy);

			setUpShaders.apply(this);
			this.dirty = true;
			//this.paint();
		}
		return this;
	};

	ChromaGL.prototype.addChromaKey = function (keys, channel) {
		var ids = [];
		var id;

		//todo: allow static image/canvas as mask
		//todo: luminance key
		//todo: alternate color spaces

		if (!checkType(keys, 'Array') || (keys.length && !isNaN(keys[0]))) {
			keys = [keys];
		}

		channel = channel || 0;

		var i, key;
		for (i = 0; i < keys.length; i++) {
			key = keys[i];
			id = keyCount;
			keyCount++;

			if (checkType(key, 'Array')) {
				if (key.length !== 3) {
					fail.apply(this, 'Unsupported chroma key type');
					return false;
				}
				var j;
				for (j = 0; j < 3; j++) {
					if (isNaN(key[j])) {
						fail.apply(this, 'Unsupported chroma key type');
						return false;
					}
				}
				key = {
					mode: 'chroma',
					color: key,
					channel: channel
				};
			} else if (checkType(key, 'String')) {
				if (key === 'pre') {
					key = {
						mode: 'pre',
						channel: channel
					};
				} else if (colors[key]) {
					key = {
						mode: 'chroma',
						color: colors[key],
						channel: channel
					};
				} else {
					fail.apply(this, 'Unknown chroma type');
					return false;
				}
			}

			if (!checkType(key, 'Object')) {
				fail.apply(this, 'Unsupported chroma key type');
				return false;
			}

			if (key.channel === undefined) {
				key.channel = channel;
			}
			if (isNaN(key.channel) || key.channel < 0 || key.channel > 2) {
				fail.apply(this, 'Unsupported channel');
			}

			if (key.mode === 'chroma') {
				if (key.color) {
					key.threshold = key.threshold || 94.86832980505137;
					key.fuzzy = key.fuzzy || 1.25;
				} else {
					fail.apply(this, 'Missing chroma color');
					return false;
				}
			} else if (key.mode === 'pre') {
				key.source = key.source || 0;
			} else {
				fail.apply(this, 'Unsupported chroma key type');
				return false;
			}

			var clip = key.clip || {};
			key.clipX = clip.x || 0;
			key.clipY = clip.y || 0;
			key.clipWidth = clip.width || this._media[this._data.width] - this.clipX;
			key.clipHeight = clip.height || this._media[this._data.height] - this.clipY;

			ids.push(id);
			this._keys[id] = key;
		}

		setUpShaders.apply(this);
		this.dirty = true;
		this.refresh();
		return ids;
	};

	ChromaGL.prototype.removeChromaKey = function (id) {
		var ids;
		if (checkType(id, 'Array')) {
			ids = id;
		} else {
			ids = [id];
		}

		var i, theId;
		for (i = 0; i < ids.length; i++) {
			theId = ids[i];
			if (!isNaN(theId) && this._key.hasOwnProperty(theId)) {
				delete this._key[theId];
			}
		}

		setUpShaders.apply(this);
		this.dirty = true;
	};

	function ShaderProgram(gl, vertexShaderSource, fragmentShaderSource) {
		this.gl = gl;

		function compileShader(source, fragment) {
			var shader;
			if (fragment) {
				shader = gl.createShader(gl.FRAGMENT_SHADER);
			} else {
				shader = gl.createShader(gl.VERTEX_SHADER);
			}

			gl.shaderSource(shader, source);
			gl.compileShader(shader);

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				console.log(source);
				throw 'Shader error: ' + gl.getShaderInfoLog(shader);
			}

			return shader;
		}

		var vertexShader = compileShader(vertexShaderSource);
		var fragmentShader = compileShader(fragmentShaderSource, true);

		var err = '';
		var program = gl.createProgram();
		gl.attachShader(program, vertexShader);
		var err2 = gl.getShaderInfoLog(vertexShader);
		if (err2) {
			err += 'Vertex shader error: ' + err2 + "\n";
		}
		gl.attachShader(program, fragmentShader);
		err2 = gl.getShaderInfoLog(fragmentShader);
		if (err2) {
			err += 'Fragment shader error: ' + err2 + "\n";
		}
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			err += gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);
			throw 'Could not initialise shader: ' + err;
		}

		this.program = program;

		gl.useProgram(program);
		var num_uniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
		this.uniforms = [];
		var i, info, name, loc;
		for (i = 0; i < num_uniforms; ++i) {
			info = gl.getActiveUniform(program, i);
			name = info.name;
			loc = gl.getUniformLocation(program, name);
			loc.name = name;
			info.set = this['set_' + name] = makeShaderSetter.call(this, info, loc);
			info.get = this['get_' + name] = makeShaderGetter.call(this, loc);
			info.loc = this['location_' + name] = loc;
			this.uniforms.push(info);
		}

		var num_attribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
		this.attributes = [];
		for (i = 0; i < num_attribs; ++i) {
			info = gl.getActiveAttrib(program, i);
			name = info.name;
			loc = gl.getAttribLocation(program, name);
			this['location_' + name] = loc;
			this.attributes.push(name);
		}
	}

	ShaderProgram.prototype.useProgram = function () {
		this.gl.useProgram(this.program);
	};

	function makeShaderSetter(info, loc) {
		var gl = this.gl;
		switch (info.type) {
			case gl.SAMPLER_2D:
				return function (value) {
					info.glTexture = gl['TEXTURE' + value];
					gl.uniform1i(loc, value);
				};
			case gl.BOOL:
			case gl.INT:
				return function (value) {
					gl.uniform1i(loc, value);
				};
			case gl.FLOAT:
				return function (value) {
					gl.uniform1f(loc, value);
				};
			case gl.FLOAT_VEC2:
				return function (x, y) {
					gl.uniform2f(loc, x, y);
				};
			case gl.FLOAT_VEC3:
				return function (x, y, z) {
					gl.uniform3f(loc, x, y, z);
				};
			case gl.FLOAT_VEC4:
				return function (x, y, z, w) {
					gl.uniform4f(loc, x, y, z, w);
				};
			case gl.FLOAT_MAT3:
				return function (mat3) {
					gl.uniformMatrix3fv(loc, false, mat3);
				};
			case gl.FLOAT_MAT4:
				return function (mat4) {
					gl.uniformMatrix4fv(loc, false, mat4);
				};
			default:
				break;
		}

		return function () {
			throw "ShaderProgram doesn't know how to set type: " + info.type;
		};
	}

	function makeShaderGetter(loc) {
		return function () {
			return this.gl.getUniform(this.program, loc);
		};
	}
}(window));