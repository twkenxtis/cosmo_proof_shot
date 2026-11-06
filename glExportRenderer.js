let gl = null;
let canvas = null;
let program = null;
let texCoordBuffer = null;
let posBuffer = null;
let uTexLoc = null;
let aPosLoc = -1;
let aUvwLoc = -1;
let texture = null;
let currentTextureSource = null;
let currentTexW = 0;
let currentTexH = 0;

const POS_DATA = new Float32Array(4 * 2);
const UVW_DATA = new Float32Array(4 * 3);

export function initGLExportRenderer(width, height) {
    if (gl) {
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
        }
        return true;
    }

    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    gl = canvas.getContext('webgl2', {
        preserveDrawingBuffer: true,
        premultipliedAlpha: false,
        antialias: true,
    }) || canvas.getContext('webgl', {
        preserveDrawingBuffer: true,
        premultipliedAlpha: false,
        antialias: true,
    });

    if (!gl) {
        console.warn('[glExportRenderer] WebGL 不可用');
        return false;
    }

    const vsSource = `
        attribute vec2 a_pos;
        attribute vec3 a_uvw;
        varying vec3 v_uvw;
        void main() {
            gl_Position = vec4(a_pos, 0.0, 1.0);
            v_uvw = a_uvw;
        }
    `;
    const fsSource = `
        precision highp float;
        varying vec3 v_uvw;
        uniform sampler2D u_tex;
        void main() {
            vec2 uv = v_uvw.xy / v_uvw.z;
            gl_FragColor = texture2D(u_tex, uv);
        }
    `;

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[glExportRenderer] link failed:', gl.getProgramInfoLog(program));
        return false;
    }
    gl.useProgram(program);

    // 只查一次
    uTexLoc = gl.getUniformLocation(program, 'u_tex');
    aPosLoc = gl.getAttribLocation(program, 'a_pos');
    aUvwLoc = gl.getAttribLocation(program, 'a_uvw');

    posBuffer = gl.createBuffer();
    texCoordBuffer = gl.createBuffer();

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uTexLoc, 0);

    // 固定狀態只設一次
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);

    gl.viewport(0, 0, width, height);
    return true;
}

function compileShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[glExportRenderer] shader compile failed:', gl.getShaderInfoLog(sh));
        return null;
    }
    return sh;
}

export function uploadTexture(source) {
    if (!gl || !texture) return false;
    if (source === currentTextureSource && source.width === currentTexW && source.height === currentTexH) {
        return true;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    currentTextureSource = source;
    currentTexW = source.width;
    currentTexH = source.height;
    return true;
}

export function drawObject(overlay, w, h, fov, cw, ch) {
    if (!gl || !program) return false;

    const hw = w / 2, hh = h / 2;
    const rx = (overlay.rotX || 0) * Math.PI / 180;
    const ry = (overlay.rotY || 0) * Math.PI / 180;
    const rz = (overlay.rotation || 0) * Math.PI / 180;

    // 預先算三角函數 避免在 rotate3D 內重複計算
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

    const rotate3D = (x, y, z) => {
        const x1 = x * cz - y * sz;
        const y1 = x * sz + y * cz;
        const z1 = z;
        const y2 = y1 * cx - z1 * sx;
        const z2 = y1 * sx + z1 * cx;
        const x3 = x1 * cy + z2 * sy;
        const z3 = -x1 * sy + z2 * cy;
        return { x: x3, y: y2, z: z3 };
    };

    const corners = [
        { x: -hw, y: -hh, u: 0, v: 0 },
        { x: hw, y: -hh, u: 1, v: 0 },
        { x: hw, y: hh, u: 1, v: 1 },
        { x: -hw, y: hh, u: 0, v: 1 },
    ];

    // 防止 scale 為 0/負造成退化
    const scale = overlay.scale > 0 ? overlay.scale : 1e-6;

    for (let i = 0; i < 4; i++) {
        const c = corners[i];
        const r = rotate3D(c.x, c.y, 0);
        const wDepth = fov + r.z;
        const safeW = Math.max(wDepth, 0.1);
        const persp = fov / safeW;

        const px = overlay.x + r.x * persp * scale;
        const py = overlay.y + r.y * persp * scale;

        const ndcX = (px / cw) * 2 - 1;
        const ndcY = 1 - (py / ch) * 2;

        POS_DATA[i * 2] = ndcX;
        POS_DATA[i * 2 + 1] = ndcY;
        UVW_DATA[i * 3] = c.u * safeW;
        UVW_DATA[i * 3 + 1] = c.v * safeW;
        UVW_DATA[i * 3 + 2] = safeW;
    }

    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, POS_DATA, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, UVW_DATA, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aUvwLoc);
    gl.vertexAttribPointer(aUvwLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    return true;
}

export function clearGL() {
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

export function getGLCanvas() { return canvas; }
export function isGLAvailable() { return !!gl; }

export function disposeGL() {
    if (!gl) return;
    gl.deleteTexture(texture);
    gl.deleteBuffer(posBuffer);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteProgram(program);
    gl = null; canvas = null; program = null; texture = null;
    currentTextureSource = null;
}