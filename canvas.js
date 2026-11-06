import { isMobile } from "./i18n.js";

const DESIGN_W = 1083;
const DESIGN_H = 1673;
// 載入 QR Code 中央圖標 (SVG)
const qrIcon = new Image();
qrIcon.src = "./images/cosmo_the_gate_icon.svg";
qrIcon.onload = () => scheduleDraw();
const COVER_RATIO = 0.37;
const ANGLE_FACTOR = -41;
const VERTICAL_OFFSET = 0.18;
const SAMPLE_RATIO_X = 0.9529;
const SAMPLE_RATIO_Y = 0.851;

// 基準尺寸以 DESIGN_W = 1083 為基準
const BASE_HANDLE_RADIUS = isMobile ? 18 : 11;
const BASE_HANDLE_HIT_RADIUS = isMobile ? 30 : 14;
const BASE_ROTATE_LINE_OFFSET = isMobile ? 130 : 55;
const BASE_TILT_OFFSET = isMobile ? 38 : 14;
const BASE_TILT_OFFSET_X = isMobile ? 30 : 12;
const BASE_TILT_HIT_RADIUS = isMobile ? 24 : 22;
const BASE_SNAP_THRESHOLD = 12;

const FOV_FACTOR = 7;

// 動態取得縮放比例（相對於設計基準寬度）
function getScaleFactor() {
    return CANVAS_W / DESIGN_W;
}

// 使用 getter 來動態取得正確的縮放後大小
function getHandleRadius() { return BASE_HANDLE_RADIUS * getScaleFactor(); }
function getHandleHitRadius() { return BASE_HANDLE_HIT_RADIUS * getScaleFactor(); }
function getRotateLineOffset() { return BASE_ROTATE_LINE_OFFSET * getScaleFactor(); }
function getTiltOffset() { return BASE_TILT_OFFSET * getScaleFactor(); }
function getTiltOffsetX() { return BASE_TILT_OFFSET_X * getScaleFactor(); }
function getTiltHitRadius() { return BASE_TILT_HIT_RADIUS * getScaleFactor(); }
function getSnapThreshold() { return BASE_SNAP_THRESHOLD * getScaleFactor(); }

const DEFAULT_ROTATION = ANGLE_FACTOR * COVER_RATIO;

// 垃圾桶基準大小以 DESIGN_W 為基準
const BASE_TRASH_RADIUS = isMobile ? 38 : 30;
const BASE_TRASH_HIT_RADIUS = BASE_TRASH_RADIUS * 2.6;
const BASE_TRASH_DELETE_RADIUS = BASE_TRASH_RADIUS * 1.3;
const TRASH_VISUAL_MAX_SCALE = 1.4;

// 動態匯出的垃圾桶常數數值會隨著背景解析度改變
export let TRASH_RADIUS = BASE_TRASH_RADIUS;
export let TRASH_HIT_RADIUS = BASE_TRASH_HIT_RADIUS;
export let TRASH_DELETE_RADIUS = BASE_TRASH_DELETE_RADIUS;

// 更新垃圾桶大小的函數
function updateTrashSizes() {
    const scaleFactor = CANVAS_W / DESIGN_W;
    TRASH_RADIUS = BASE_TRASH_RADIUS * scaleFactor;
    TRASH_HIT_RADIUS = BASE_TRASH_HIT_RADIUS * scaleFactor;
    TRASH_DELETE_RADIUS = BASE_TRASH_DELETE_RADIUS * scaleFactor;
}

const INITIAL_POS = {
	0: {
		xRatio: 0.17,
		yRatio: 0.64,
		rotation: -DEFAULT_ROTATION,
	},
	1: {
		xRatio: 0.83,
		yRatio: 0.64,
		rotation: DEFAULT_ROTATION,
	},
};



export let CANVAS_W = DESIGN_W;
export let CANVAS_H = DESIGN_H;

export const TRASH_POS = {
	x: 0,
	y: 0,
};
updateTrashSizes();

export function syncTrashPos() {
	TRASH_POS.x = CANVAS_W / 2;
	TRASH_POS.y = isMobile ? 57 : 60;
}

function createObject() {
	const cv = document.createElement("canvas");
	cv.width = 0;
	cv.height = 0;
	return {
		image: null,
		useText: true,
		backImage: null,
		videoBlob: null,
		name: "",
		canvas: cv,
		backCanvas: null,
		visible: false,
		useSleeve: true,
		text: "100Z",
		text2: "000000",
		font: "Inter",
		color: "#ffffff",
		backgroundColor: null,
		overlay: {
			x: CANVAS_W / 2,
			y: CANVAS_H / 2,
			scale: 1,
			rotation: 0,
			rotX: 0,
			rotY: 0,
		},
	};
}

export const MAX_OBJECTS = 128;

// 動態初始位置 前兩個沿用 INITIAL_POS 之後以環形均勻分布
export function getInitialPos(index) {
	if (INITIAL_POS[index]) return INITIAL_POS[index];
	const count = Math.max(2, objects.length || 2);
	const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
	return {
		xRatio: 0.5 + Math.cos(angle) * 0.28,
		yRatio: 0.5 + Math.sin(angle) * 0.22,
		rotation: ((index % 2 === 0) ? -1 : 1) * DEFAULT_ROTATION,
	};
}

export const objects = [createObject()];

export let currentObjectIndex = 0;

export function resetOverlayPosition(index = currentObjectIndex) {
	const obj = objects[index];
	if (!obj.canvas.width) return;

	obj.overlay.scale = 1;
	obj.overlay.rotX = 0;
	obj.overlay.rotY = 0;

	const pos = getInitialPos(index);
	obj.overlay.rotation = pos.rotation;
	obj.overlay.x = CANVAS_W * pos.xRatio;
	obj.overlay.y = CANVAS_H * pos.yRatio;

	// 同步重組背面，避免殘留舊鏡像
	if (obj.image) composeBackOverlay(false, index);

	scheduleDraw();
}

export function setCurrentObjectIndex(idx) {
	const n = objects.length;
	if (!Number.isInteger(idx) || idx < 0 || idx >= n) idx = 0;
	currentObjectIndex = idx;
	state.selectedIndex = currentObjectIndex;
	scheduleDraw();
}

export function getObjectCount() {
	return objects.length;
}

export function addObject() {
	if (objects.length >= MAX_OBJECTS) return { ok: false, reason: "max" };
	const idx = objects.length;
	objects.push(createObject());
	currentObjectIndex = idx;
	state.selectedIndex = idx;
	scheduleDraw();
	return { ok: true, index: idx };
}

export function removeObject(idx = currentObjectIndex) {
	if (objects.length <= 1) return { ok: false, reason: "min" };
	if (!Number.isInteger(idx) || idx < 0 || idx >= objects.length) {
		return { ok: false, reason: "invalid" };
	}
	try {
		if (typeof window !== "undefined" && window.__stopObjectVideo) {
			window.__stopObjectVideo(idx);
		}
	} catch (e) {}
	objects.splice(idx, 1);
	if (currentObjectIndex >= objects.length) {
		currentObjectIndex = objects.length - 1;
	}
	state.selectedIndex = currentObjectIndex;
	scheduleDraw();
	return { ok: true };
}

export const singleObject = new Proxy(
	{},
	{
		get(_, prop) {
			const o = objects[currentObjectIndex];
			if (prop === "overlay") return o.overlay;
			if (prop === "canvas") return o.canvas;
			return o[prop];
		},
		set(_, prop, value) {
			objects[currentObjectIndex][prop] = value;
			return true;
		},
	},
);

export const state = {
	bgVideo: null,
	bgVideoBlob: null,
	bgImage: null,
	sleeveImage: null,
	cropRatio: "none",
	bgImageCropped: null,
	useText: true,
	qrText: "",
	bgName: "",
	isDraggingToTrash: false,
	trashHoverProgress: 0,
	_trashVibrated: false,
	trashPulse: 0,
	selectedIndex: 0,
	drag: {
		active: false,
		scale: false,
		rotate: false,
		tilt: false,
		tiltAxis: null,
		tiltSign: 1,
		startRotX: 0,
		startRotY: 0,
		startX: 0,
		startY: 0,
		startAngle: 0,
		startIsBack: false,
		_lastFlipped: false,
	},
	pan: {
		active: false,
		startX: 0,
		startY: 0,
		scrollLeft: 0,
		scrollTop: 0,
	},
	pinch: {
		active: false,
		startDist: 0,
		startAngle: 0,
		initialScale: 1,
		initialRotation: 0,
		_lastFlipped: false,
	},
	activeTool: null,
	zoomMode: "fit",
	gridMode: "none",
	showAlignGuides: true,
	alignGuides: [],
};

export let bgCtx = null;
export let uiCtx = null;
export let ctx = null;
export let ui = null;


// 用於像素級拾取的隱藏 Canvas
let pickBufferCanvas = null;
let pickBufferCtx = null;

export function initPickBuffer() {
	if (!pickBufferCanvas) {
		pickBufferCanvas = document.createElement("canvas");
		pickBufferCtx = pickBufferCanvas.getContext("2d", { willReadFrequently: true });
	}
	pickBufferCanvas.width = CANVAS_W;
	pickBufferCanvas.height = CANVAS_H;
}

/**
 * 判斷點擊座標 (x, y) 在哪個 Object 上
 * 回傳 Object 的 index，若無則回傳 -1
 */
export function getTopObjectAt(x, y) {
    if (!pickBufferCtx) return -1;
    // 讀取該像素的 RGB 值
    const pixel = pickBufferCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    
    // 如果是黑色或 #C9CBD1 代表背景或特定空白區域 沒點到任何 Object
    if ((r === 0 && g === 0 && b === 0) || (r === 201 && g === 203 && b === 209)) {
        return -1;
    }
    
    // 用 index + 1, 0, 0 來編碼 Object 的 ID
    const id = r - 1;
    if (id >= 0 && id < objects.length) {
        return id;
    }
    return -1;
}

export function initCanvas(uiElements) {
	ui = uiElements;
	bgCtx = ui.bgCanvas.getContext("2d", {
		alpha: false,
	});
	bgCtx.imageSmoothingEnabled = true;
	bgCtx.imageSmoothingQuality = isMobile ? "low" : "high";
	uiCtx = ui.uiCanvas.getContext("2d", {
		alpha: true,
	});
	uiCtx.imageSmoothingEnabled = true;
	ctx = bgCtx; // 相容
}

let drawBgScheduled = false;
export function scheduleDrawBg() {
	if (drawBgScheduled) return;
	drawBgScheduled = true;
	requestAnimationFrame(() => {
		drawBgScheduled = false;
		renderBg();
	});
}

let drawUIScheduled = false;
export function scheduleDrawUI() {
	if (drawUIScheduled) return;
	drawUIScheduled = true;
	requestAnimationFrame(() => {
		drawUIScheduled = false;
		renderUI();
	});
}

export function scheduleDraw() {
	scheduleDrawBg();
	scheduleDrawUI();
}

export function getDisplayWidth(obj) {
	const displayScale = CANVAS_W / DESIGN_W;
	return DESIGN_W * COVER_RATIO * obj.overlay.scale * displayScale;
}

export function getObjectRenderInfo(index = currentObjectIndex) {
	const obj = objects[index];
	if (!obj || !obj.canvas.width) {
		return {
			obj: null,
			srcCanvas: null,
			w: 0,
			h: 0,
			isBack: false,
		};
	}
	const isBack =
		Math.abs(obj.overlay.rotX || 0) >= 90 ||
		Math.abs(obj.overlay.rotY || 0) >= 90;
	const srcCanvas =
		isBack && obj.backCanvas && obj.backCanvas.width
			? obj.backCanvas
			: obj.canvas;

	const w = getDisplayWidth(obj);
	const h = w * (srcCanvas.height / srcCanvas.width);
	return {
		obj,
		srcCanvas,
		w,
		h,
		isBack,
	};
}

export function getOverlaySize(index = currentObjectIndex) {
	const obj = objects[index];
	if (!obj || !obj.canvas.width)
		return {
			w: 0,
			h: 0,
		};
	const isBack =
		Math.abs(obj.overlay.rotX || 0) >= 90 ||
		Math.abs(obj.overlay.rotY || 0) >= 90;
	const srcCanvas =
		isBack && obj.backCanvas && obj.backCanvas.width
			? obj.backCanvas
			: obj.canvas;
	const w = getDisplayWidth(obj);
	const h = w * (srcCanvas.height / srcCanvas.width);
	return {
		w,
		h,
	};
}

export function getRotatedBounds(index = currentObjectIndex) {
	const obj = objects[index];
	const { w, h } = getOverlaySize(index);
	const rad = (obj.overlay.rotation * Math.PI) / 180;
	const rotW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
	const rotH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
	return {
		w: rotW,
		h: rotH,
		cx: obj.overlay.x,
		cy: obj.overlay.y,
		left: obj.overlay.x - rotW / 2,
		right: obj.overlay.x + rotW / 2,
		top: obj.overlay.y - rotH / 2,
		bottom: obj.overlay.y + rotH / 2,
	};
}

export function sampleColorFromImage(img, ratioX, ratioY) {
	try {
		const w = img.naturalWidth || img.width;
		const h = img.naturalHeight || img.height;
		if (!w || !h) return null;
		const x = Math.min(w - 1, Math.max(0, Math.floor(ratioX * w)));
		const y = Math.min(h - 1, Math.max(0, Math.floor(ratioY * h)));
		const c = document.createElement("canvas");
		c.width = 1;
		c.height = 1;
		const cctx = c.getContext("2d", {
			willReadFrequently: true,
		});
		cctx.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
		const [r, g, b, a] = cctx.getImageData(0, 0, 1, 1).data;
		if (a === 0) return null;
		const toHex = (v) => v.toString(16).padStart(2, "0");
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	} catch (err) {
		return null;
	}
}

export function updateTextColorFromObject(index = currentObjectIndex) {
	const obj = objects[index];
	if (!obj.image) return;
	const hex = sampleColorFromImage(obj.image, SAMPLE_RATIO_X, SAMPLE_RATIO_Y);
	if (hex) {
		obj.color = hex;
		if (index === currentObjectIndex) {
			if (ui.inputColor) ui.inputColor.value = hex;
			if (ui.inputColorMobile) ui.inputColorMobile.value = hex;
		}
	}
}

export function applyCanvasSize() {
	if (state.bgImage) {
		const cropped = cropImageToRatio(state.bgImage, state.cropRatio);
		CANVAS_W = cropped.width;
		CANVAS_H = cropped.height;
		state.bgImageCropped = cropped;
	} else if (
		state.bgVideo &&
		state.bgVideo.videoWidth &&
		state.bgVideo.videoHeight
	) {
		const crop = computeVideoCrop(state.bgVideo, state.cropRatio);
		CANVAS_W = crop.sw;
		CANVAS_H = crop.sh;
		state.bgImageCropped = null;
	} else {
		if (isMobile) {
			const refObj = objects.find((o) => o.canvas && o.canvas.width);
			if (refObj) {
				CANVAS_W = refObj.canvas.width;
				CANVAS_H = refObj.canvas.height;
			} else {
				CANVAS_W = DESIGN_W;
				CANVAS_H = DESIGN_H;
			}
		} else {
			CANVAS_W = DESIGN_W;
			CANVAS_H = DESIGN_H;
		}
		state.bgImageCropped = null;
	}

	if (ui.bgCanvas.width !== CANVAS_W) ui.bgCanvas.width = CANVAS_W;
	if (ui.bgCanvas.height !== CANVAS_H) ui.bgCanvas.height = CANVAS_H;
	if (ui.uiCanvas.width !== CANVAS_W) ui.uiCanvas.width = CANVAS_W;
	if (ui.uiCanvas.height !== CANVAS_H) ui.uiCanvas.height = CANVAS_H;

	bgCtx.imageSmoothingEnabled = true;
	bgCtx.imageSmoothingQuality = isMobile ? "low" : "high";

	if (ui.resizeCanvas) ui.resizeCanvas();
	if (typeof invalidateCanvasRect === 'function') invalidateCanvasRect();
	updateTrashSizes();
	scheduleDraw();
}

function drawTextOnCanvas(octx, ox, oy, dw, dh, obj, isBack = false) {
	if (!obj.useText) return;

	const text = obj.text || "";
	const text2 = obj.text2 || "";

	const fontVal = obj.font || "Inter";
	const colorVal = obj.color || "#ffffff";
	const weight = fontVal === "Pretendard" ? "600" : "bold";

	const xShift = isBack ? -dw * 0.096 : 0;

	const fontSize1 = 49;
	let text1Length = 0;

	if (text.length === 4) {
		octx.save();
		octx.font = `${weight} ${fontSize1}px "${fontVal}", sans-serif`;
		octx.fillStyle = colorVal;
		octx.textAlign = "center";
		octx.textBaseline = "middle";

		octx.globalAlpha = 0.84;
		octx.shadowColor = colorVal;
		octx.shadowBlur = 2;
		octx.shadowOffsetX = 0;
		octx.shadowOffsetY = 0;

		text1Length = octx.measureText(text).width;
		const cx = ox + dw - 40 - fontSize1 / 2 + xShift;
		const cy = oy + dh * 0.39 + text1Length / 2;

		octx.translate(cx, cy);
		octx.rotate(Math.PI / 2);
		octx.fillText(text, 0, 0);
		octx.restore();
	}

	const text2FontSize = 47;
	const gap = 17;
	const text2Padded = "#" + (text2.replace(/\D/g, "") || "0").padStart(6, "0");

	octx.save();
	octx.font = `${text2FontSize}px "DotMatrixNormal", monospace`;
	octx.fillStyle = colorVal;
	octx.textAlign = "center";
	octx.textBaseline = "middle";

	octx.globalAlpha = 0.67;
	octx.shadowColor = colorVal;
	octx.shadowBlur = 3;
	octx.shadowOffsetX = 0;
	octx.shadowOffsetY = 0;

	const text2Length = octx.measureText(text2Padded).width;
	const cx2 = ox + dw - 42 - text2FontSize / 2 + xShift;
	const cy2 = oy + dh * 0.39 + text1Length + gap + text2Length / 2;

	octx.translate(cx2, cy2);
	octx.rotate(Math.PI / 2);
	octx.fillText(text2Padded, 0, 0);
	octx.restore();
}

export function composeOverlay(
	resetPosition = false,
	index = currentObjectIndex,
) {
	const obj = objects[index];
	if (!obj.image) {
		obj.canvas.width = 0;
		scheduleDraw();
		return;
	}

	const useSleeve = obj.useSleeve && state.sleeveImage;
	const targetW = useSleeve ? state.sleeveImage.width : DESIGN_W;
	const targetH = useSleeve ? state.sleeveImage.height : DESIGN_H;

	if (obj.canvas.width !== targetW || obj.canvas.height !== targetH) {
		obj.canvas.width = targetW;
		obj.canvas.height = targetH;
		const octx = obj.canvas.getContext("2d");
		octx.imageSmoothingEnabled = true;
		octx.imageSmoothingQuality = "high";
	}

	const octx = obj.canvas.getContext("2d");
	octx.clearRect(0, 0, targetW, targetH);

	if (useSleeve) {
		octx.drawImage(state.sleeveImage, 0, 0, targetW, targetH);
		const ox = (targetW - DESIGN_W) / 2;
		const oy = (targetH - DESIGN_H) / 2 - DESIGN_H * 0.03;
		octx.drawImage(obj.image, ox, oy, DESIGN_W, DESIGN_H);
		drawTextOnCanvas(octx, ox, oy, DESIGN_W, DESIGN_H, obj);
	} else {
		octx.drawImage(obj.image, 0, 0, DESIGN_W, DESIGN_H);
		drawTextOnCanvas(octx, 0, 0, DESIGN_W, DESIGN_H, obj);
	}

	if (resetPosition) {
		resetOverlayPosition(index);
		if (isMobile) applyCanvasSize();
	} else {
		scheduleDraw();
	}
}

export function composeBackOverlay(
	resetPosition = false,
	index = currentObjectIndex,
) {
	const obj = objects[index];
	if (!obj.backImage && !obj.image) {
		if (obj.backCanvas) obj.backCanvas.width = 0;
		return;
	}

	const useSleeve = obj.useSleeve && state.sleeveImage;
	const targetW = useSleeve ? state.sleeveImage.width : DESIGN_W;
	const targetH = useSleeve ? state.sleeveImage.height : DESIGN_H;

	const tmp = document.createElement("canvas");
	tmp.width = targetW;
	tmp.height = targetH;
	const tctx = tmp.getContext("2d");
	tctx.imageSmoothingEnabled = true;
	tctx.imageSmoothingQuality = "high";

	// 沒有 backImage 時用正面 image（讓 -180 有內容可顯示）
	const faceImg = obj.backImage || obj.image;
	// 只有真的有 backImage 時才在背面渲染文字
	const shouldDrawText = !!obj.backImage;

	if (useSleeve) {
		tctx.drawImage(state.sleeveImage, 0, 0, targetW, targetH);
		const ox = (targetW - DESIGN_W) / 2;
		const oy = (targetH - DESIGN_H) / 2 - DESIGN_H * 0.03;
		tctx.drawImage(faceImg, ox, oy, DESIGN_W, DESIGN_H);
		if (shouldDrawText)
			drawTextOnCanvas(tctx, ox, oy, DESIGN_W, DESIGN_H, obj, true);
	} else {
		tctx.drawImage(faceImg, 0, 0, DESIGN_W, DESIGN_H);
		if (shouldDrawText)
			drawTextOnCanvas(tctx, 0, 0, DESIGN_W, DESIGN_H, obj, true);
	}

	if (!obj.backCanvas) obj.backCanvas = document.createElement("canvas");
	if (obj.backCanvas.width !== targetW || obj.backCanvas.height !== targetH) {
		obj.backCanvas.width = targetW;
		obj.backCanvas.height = targetH;
	}
	const bctx = obj.backCanvas.getContext("2d");
	bctx.imageSmoothingEnabled = true;
	bctx.imageSmoothingQuality = "high";
	bctx.clearRect(0, 0, targetW, targetH);
	bctx.save();
	bctx.translate(targetW, 0);
	bctx.scale(-1, 1);
	bctx.drawImage(tmp, 0, 0);
	bctx.restore();

	if (hasValidBackImage(obj)) {
		drawQRCodeOnCanvas(
			bctx,
			targetW,
			targetH,
			state.qrText || obj.name || "",
			!!(obj.useSleeve && state.sleeveImage), true,
		);
	}

	if (resetPosition) {
		resetOverlayPosition(index);
		if (isMobile) applyCanvasSize();
	} else {
		scheduleDraw();
	}
}

export function hasValidBackImage(obj) {
	return !!(
		obj &&
		obj.backImage &&
		(obj.backImage.naturalWidth > 0 || obj.backImage.width > 0)
	);
}

let _qrLibPromise = null;
function loadQRLib() {
	if (_qrLibPromise) return _qrLibPromise;
	_qrLibPromise = import("https://esm.sh/qrcode-generator@1.4.4")
		.then((mod) => {
			const qrcode = mod.default || mod;
			// QR 庫載入後, 重繪所有物件的背面確保 QR 畫上
			for (let i = 0; i < objects.length; i++) {
				if (objects[i].image) {
					composeBackOverlay(false, i);
					composeOverlay(false, i); // 正面也重繪，確保點陣字
				}
			}
			scheduleDraw();
			return qrcode;
		})
		.catch((err) => {
			console.warn("[qr] qrcode-generator load failed", err);
			return null;
		});
	return _qrLibPromise;
}

export function drawQRCodeOnCanvas(
	ctx,
	canvasWidth,
	canvasHeight,
	qrData,
	useSleeve = true,
	mirror = false,
) {
	// 根據是否使用卡套，給予不同的 QR Code 基準框位置
	let box_xmin, box_ymin, box_xmax, box_ymax;
	
	if (useSleeve) {
		// 有卡套時的基準位置（原本的設定）
		box_xmin = 277;
		box_ymin = 945;
		box_xmax = 578;
		box_ymax = 1234;
	} else {
		// 無卡套時的基準位置（對應圖片中左下角的白色區域）
		// 微調：左邊延伸 10
		box_xmin = 268;
		box_ymin = 1028; 
		box_xmax = 578;
		box_ymax = 1328;
	}

	const rel_xmin = box_xmin / DESIGN_W;
	const rel_ymin = box_ymin / DESIGN_H;
	const rel_xmax = box_xmax / DESIGN_W;
	const rel_ymax = box_ymax / DESIGN_H;

	const left = Math.round(rel_xmin * canvasWidth);
	const top = Math.round(rel_ymin * canvasHeight);
	const right = Math.round(rel_xmax * canvasWidth);
	const bottom = Math.round(rel_ymax * canvasHeight);

	const target_width = right - left;
	const target_height = bottom - top;

	const paddingRatio = 0.05;
	const qr_size =
		Math.min(target_width, target_height) * (1 - paddingRatio * 2);

	const offset_x = left + Math.floor((target_width - qr_size) / 2);
	const offset_y = top + Math.floor((target_height - qr_size) / 2);

	ctx.fillStyle = "#ffffff";
	ctx.fillRect(offset_x, offset_y, qr_size, qr_size);

	const data = qrData || "";

	// 如果沒有 QR 文字，就不繪製 QR Code
	if (!data) return;

	loadQRLib().then((qrcode) => {
		if (!qrcode) {
			ctx.fillStyle = "#000000";
			ctx.font = "bold 12px monospace";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("QR", offset_x + qr_size / 2, offset_y + qr_size / 2);
			return;
		}

		const qr = qrcode(0, "H");
		qr.addData(data);
		qr.make();
		const moduleCount = qr.getModuleCount();
		const cellSize = qr_size / moduleCount;

		// 離屏 canvas 白底 + 黑格 + icon
		const off = document.createElement("canvas");
		off.width = Math.ceil(qr_size);
		off.height = Math.ceil(qr_size);
		const octx = off.getContext("2d");

		octx.fillStyle = "#ffffff";
		octx.fillRect(0, 0, off.width, off.height);
		octx.fillStyle = "#000000";
		for (let row = 0; row < moduleCount; row++) {
			for (let col = 0; col < moduleCount; col++) {
				if (qr.isDark(row, col)) {
					octx.fillRect(
						col * cellSize,
						row * cellSize,
						cellSize + 0.5,
						cellSize + 0.5,
					);
				}
			}
		}

		if (qrIcon.complete && qrIcon.naturalWidth > 0) {
			const iconSize = qr_size / 4.8;
			const iconX = (qr_size - iconSize) / 2;
			const iconY = (qr_size - iconSize) / 2;
			octx.fillStyle = "#ffffff";
			octx.fillRect(
				iconX - cellSize,
				iconY - cellSize,
				iconSize + cellSize * 2,
				iconSize + cellSize * 2,
			);
			octx.drawImage(qrIcon, iconX, iconY, iconSize, iconSize);
		}

		const blurPx = Math.max(1, qr_size * 0.0026);
		ctx.save();
		try {
			ctx.filter = `blur(${blurPx}px)`;
		} catch (e) {}
		if (mirror) {
			ctx.translate(offset_x + qr_size, offset_y);
			ctx.scale(-1, 1);
			ctx.drawImage(off, 0, 0, qr_size, qr_size);
		} else {
			ctx.drawImage(off, offset_x, offset_y, qr_size, qr_size);
		}
		ctx.restore();
	});
}export function recomposeCurrent(index = currentObjectIndex) {
	composeOverlay(false, index);
	composeBackOverlay(false, index);
}

export function mirrorOverlayFrom(index, sourceIndex) {
	const src = objects[sourceIndex];
	const dst = objects[index];
	if (!src.canvas.width) return;
	dst.overlay.scale = src.overlay.scale;
	dst.overlay.rotation = -src.overlay.rotation;
	dst.overlay.x = CANVAS_W - src.overlay.x;
	dst.overlay.y = src.overlay.y;
	scheduleDraw();
}

function drawGridUI() {
	const mode = state.gridMode;
	if (!mode || mode === "none") return;

	uiCtx.save();
	const lw = Math.max(1, CANVAS_W / 800);

	const lineV = (x, style, width, dash) => {
		uiCtx.strokeStyle = style;
		uiCtx.lineWidth = width;
		uiCtx.setLineDash(dash || []);
		uiCtx.beginPath();
		uiCtx.moveTo(x, 0);
		uiCtx.lineTo(x, CANVAS_H);
		uiCtx.stroke();
	};
	const lineH = (y, style, width, dash) => {
		uiCtx.strokeStyle = style;
		uiCtx.lineWidth = width;
		uiCtx.setLineDash(dash || []);
		uiCtx.beginPath();
		uiCtx.moveTo(0, y);
		uiCtx.lineTo(CANVAS_W, y);
		uiCtx.stroke();
	};

	const main = "rgba(255,255,255,0.35)";
	const soft = "rgba(255,255,255,0.2)";
	const gold = "rgba(241,196,15,0.55)";

	if (mode === "thirds") {
		for (let i = 1; i <= 2; i++) {
			lineV((CANVAS_W * i) / 3, main, lw);
			lineH((CANVAS_H * i) / 3, main, lw);
		}
	} else if (mode === "multi") {
		for (let i = 1; i <= 2; i++) {
			lineV((CANVAS_W * i) / 3, main, lw);
			lineH((CANVAS_H * i) / 3, main, lw);
		}
		[0.382, 0.618].forEach((r) => {
			lineV(CANVAS_W * r, gold, lw * 1.2, [10, 6]);
			lineH(CANVAS_H * r, gold, lw * 1.2, [10, 6]);
		});
		lineV(CANVAS_W / 2, soft, lw);
		lineH(CANVAS_H / 2, soft, lw);
	} else if (mode === "phi") {
		[0.382, 0.618].forEach((r) => {
			lineV(CANVAS_W * r, main, lw);
			lineH(CANVAS_H * r, main, lw);
		});
	} else if (mode === "center") {
		lineV(CANVAS_W / 2, soft, lw);
		lineH(CANVAS_H / 2, soft, lw);
	}

	uiCtx.setLineDash([]);
	uiCtx.restore();
}

function drawAlignGuidesUI() {
	if (!state.showAlignGuides || !state.alignGuides.length) return;
	uiCtx.save();
	uiCtx.strokeStyle = "rgba(241, 196, 15, 0.95)";
	uiCtx.lineWidth = Math.max(1.5, CANVAS_W / 500);
	uiCtx.setLineDash([8, 6]);
	uiCtx.beginPath();
	for (const g of state.alignGuides) {
		if (g.type === "v") {
			uiCtx.moveTo(g.x, 0);
			uiCtx.lineTo(g.x, CANVAS_H);
		} else {
			uiCtx.moveTo(0, g.y);
			uiCtx.lineTo(CANVAS_W, g.y);
		}
	}
	uiCtx.stroke();
	uiCtx.restore();
}

export function cropImageToRatio(img, ratio) {
	if (!img || ratio === "none") return img;

	const [rw, rh] = ratio.split(":").map(Number);
	const targetRatio = rw / rh;
	const w = img.width || img.naturalWidth;
	const h = img.height || img.naturalHeight;
	const srcRatio = w / h;

	let sw, sh, sx, sy;
	if (srcRatio > targetRatio) {
		sh = h;
		sw = Math.round(h * targetRatio);
		sx = Math.round((w - sw) / 2);
		sy = 0;
	} else {
		sw = w;
		sh = Math.round(w / targetRatio);
		sx = 0;
		sy = Math.round((h - sh) / 2);
	}

	const out = document.createElement("canvas");
	out.width = sw;
	out.height = sh;
	const octx = out.getContext("2d");
	octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
	return out;
}

export function computeVideoCrop(video, cropRatio) {
	const vw = video.videoWidth || 1;
	const vh = video.videoHeight || 1;
	if (!cropRatio || cropRatio === "none") {
		return {
			sx: 0,
			sy: 0,
			sw: vw,
			sh: vh,
		};
	}
	const [rw, rh] = cropRatio.split(":").map(Number);
	const targetRatio = rw / rh;
	const srcRatio = vw / vh;
	let sw, sh, sx, sy;
	if (srcRatio > targetRatio) {
		sh = vh;
		sw = Math.round(vh * targetRatio);
		sx = Math.round((vw - sw) / 2);
		sy = 0;
	} else {
		sw = vw;
		sh = Math.round(vw / targetRatio);
		sx = 0;
		sy = Math.round((vh - sh) / 2);
	}
	return {
		sx,
		sy,
		sw,
		sh,
	};
}

// 3D 透視旋轉
function rotate3D(x, y, z, rx, ry, rz) {
	const cx = Math.cos(rx),
		sx = Math.sin(rx);
	const cy = Math.cos(ry),
		sy = Math.sin(ry);
	const cz = Math.cos(rz),
		sz = Math.sin(rz);
	const x1 = x * cz - y * sz;
	const y1 = x * sz + y * cz;
	const z1 = z;
	const y2 = y1 * cx - z1 * sx;
	const z2 = y1 * sx + z1 * cx;
	const x3 = x1 * cy + z2 * sy;
	const z3 = -x1 * sy + z2 * cy;
	return {
		x: x3,
		y: y2,
		z: z3,
	};
}

function drawTriangle(ctx, src, p0, p1, p2, u0, v0, u1, v1, u2, v2) {
	const denom = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
	if (Math.abs(denom) < 1e-10) return;

	const a = (p0.x * (v1 - v2) + p1.x * (v2 - v0) + p2.x * (v0 - v1)) / denom;
	const b = (p0.y * (v1 - v2) + p1.y * (v2 - v0) + p2.y * (v0 - v1)) / denom;
	const c = (p0.x * (u2 - u1) + p1.x * (u0 - u2) + p2.x * (u1 - u0)) / denom;
	const d = (p0.y * (u2 - u1) + p1.y * (u0 - u2) + p2.y * (u1 - u0)) / denom;
	const e = p0.x - a * u0 - c * v0;
	const f = p0.y - b * u0 - d * v0;

	ctx.save();
	ctx.beginPath();
	ctx.moveTo(p0.x, p0.y);
	ctx.lineTo(p1.x, p1.y);
	ctx.lineTo(p2.x, p2.y);
	ctx.closePath();
	ctx.clip();
	ctx.setTransform(a, b, c, d, e, f);
	ctx.drawImage(src, 0, 0);
	ctx.restore();
}

function drawPerspective(ctx, srcCanvas, overlay, cx, cy, w, h, fov) {
	const hw = w / 2, hh = h / 2;
	const rx = ((overlay.rotX || 0) * Math.PI) / 180;
	const ry = ((overlay.rotY || 0) * Math.PI) / 180;
	const rz = ((overlay.rotation || 0) * Math.PI) / 180;

	const cxr = Math.cos(rx), sxr = Math.sin(rx);
	const cyr = Math.cos(ry), syr = Math.sin(ry);
	const czr = Math.cos(rz), szr = Math.sin(rz);

	const rot = (x, y, z) => {
		const x1 = x * czr - y * szr;
		const y1 = x * szr + y * czr;
		const z1 = z;
		const y2 = y1 * cxr - z1 * sxr;
		const z2 = y1 * sxr + z1 * cxr;
		const x3 = x1 * cyr + z2 * syr;
		const z3 = -x1 * syr + z2 * cyr;
		return { x: x3, y: y2, z: z3 };
	};

	const project = (localX, localY) => {
		const r = rot(localX, localY, 0);
		const wDepth = fov + r.z;
		const safeW = Math.max(wDepth, 0.1);
		const persp = fov / safeW;
		return {
			x: cx + r.x * persp * overlay.scale,
			y: cy + r.y * persp * overlay.scale,
		};
	};

					const sw = srcCanvas.width;
	const sh = srcCanvas.height;

	const N = 4;
	const pts = [];
	const uvs = [];
	for (let j = 0; j <= N; j++) {
		for (let i = 0; i <= N; i++) {
			const lx = -hw + (w * i) / N;
			const ly = -hh + (h * j) / N;
			pts.push(project(lx, ly));
			uvs.push({ u: (sw * i) / N, v: (sh * j) / N });
		}
	}
	const idx = (i, j) => j * (N + 1) + i;

	// 繪製每個格子
	for (let j = 0; j < N; j++) {
		for (let i = 0; i < N; i++) {
			const p00 = pts[idx(i, j)];
			const p10 = pts[idx(i + 1, j)];
			const p11 = pts[idx(i + 1, j + 1)];
			const p01 = pts[idx(i, j + 1)];
			const t00 = uvs[idx(i, j)];
			const t10 = uvs[idx(i + 1, j)];
			const t11 = uvs[idx(i + 1, j + 1)];
			const t01 = uvs[idx(i, j + 1)];

			drawTriangle(ctx, srcCanvas, p00, p10, p11, t00.u, t00.v, t10.u, t10.v, t11.u, t11.v);
			drawTriangle(ctx, srcCanvas, p00, p11, p01, t00.u, t00.v, t11.u, t11.v, t01.u, t01.v);
		}
	}
}

function drawVideoCover(ctx, video, cw, ch) {
	const vw = video.videoWidth || 1;
	const vh = video.videoHeight || 1;
	const scale = Math.max(cw / vw, ch / vh);
	const sw = cw / scale;
	const sh = ch / scale;
	const sx = (vw - sw) / 2;
	const sy = (vh - sh) / 2;
	try {
		ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
	} catch (e) {}
}

function drawSelectionUI(selIdx) {
	if (selIdx >= 0 && objects[selIdx] && objects[selIdx].canvas.width) {
		const obj = objects[selIdx];
		const { w, h } = getOverlaySize(selIdx);
		const { x, y, rotation } = obj.overlay;

		if (obj.overlay.rotX || obj.overlay.rotY) {
			const fov = w * FOV_FACTOR;
			const hw = w / 2,
				hh = h / 2;
			const corners = [
				{
					x: -hw,
					y: -hh,
				},
				{
					x: hw,
					y: -hh,
				},
				{
					x: hw,
					y: hh,
				},
				{
					x: -hw,
					y: hh,
				},
			];
			const rx = (obj.overlay.rotX * Math.PI) / 180;
			const ry = (obj.overlay.rotY * Math.PI) / 180;
			const rz = (obj.overlay.rotation * Math.PI) / 180;
			const proj = corners.map((p) => {
				const r = rotate3D(p.x, p.y, 0, rx, ry, rz);
				const safeW = Math.max(fov + r.z, 0.1);
			const persp = fov / safeW;
				return {
					x: x + r.x * persp * obj.overlay.scale,
					y: y + r.y * persp * obj.overlay.scale,
				};
			});

			uiCtx.beginPath();
			uiCtx.moveTo(proj[0].x, proj[0].y);
			for (let k = 1; k < 4; k++) uiCtx.lineTo(proj[k].x, proj[k].y);
			uiCtx.closePath();
			uiCtx.strokeStyle = "rgba(255,255,255,0.8)";
			uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
			uiCtx.stroke();

			const midTop = {
				x: (proj[0].x + proj[1].x) / 2,
				y: (proj[0].y + proj[1].y) / 2,
			};
			const midBottom = {
				x: (proj[3].x + proj[2].x) / 2,
				y: (proj[3].y + proj[2].y) / 2,
			};
			const midLeft = {
				x: (proj[0].x + proj[3].x) / 2,
				y: (proj[0].y + proj[3].y) / 2,
			};
			const midRight = {
				x: (proj[1].x + proj[2].x) / 2,
				y: (proj[1].y + proj[2].y) / 2,
			};

			[
				[midTop, "tiltTop"],
				[midBottom, "tiltBottom"],
				[midLeft, "tiltLeft"],
				[midRight, "tiltRight"],
			].forEach(([p]) => {
				uiCtx.beginPath();
				uiCtx.arc(p.x, p.y, getHandleRadius(), 0, Math.PI * 2);
				uiCtx.fillStyle = "#ff66cc";
				uiCtx.strokeStyle = "#fff";
				uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
				uiCtx.fill();
				uiCtx.stroke();
			});

			proj.forEach((p) => {
				uiCtx.beginPath();
				uiCtx.arc(p.x, p.y, getHandleRadius(), 0, Math.PI * 2);
				uiCtx.fillStyle = "#2ecc71";
				uiCtx.strokeStyle = "#fff";
				uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
				uiCtx.fill();
				uiCtx.stroke();
			});

			const topDx = proj[1].x - proj[0].x;
			const topDy = proj[1].y - proj[0].y;
			const topLen = Math.hypot(topDx, topDy) || 1;
			const nx = topDy / topLen;
			const ny = -topDx / topLen;
			const rotatePos = {
				x: midTop.x + nx * getRotateLineOffset(),
				y: midTop.y + ny * getRotateLineOffset(),
			};

			uiCtx.beginPath();
			uiCtx.moveTo(midTop.x, midTop.y);
			uiCtx.lineTo(rotatePos.x, rotatePos.y);
			uiCtx.strokeStyle = "#f39c12";
			uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
			uiCtx.stroke();

			uiCtx.beginPath();
			uiCtx.arc(rotatePos.x, rotatePos.y, getHandleRadius(), 0, Math.PI * 2);
			uiCtx.fillStyle = "#f1c40f";
			uiCtx.strokeStyle = "#fff";
			uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
			uiCtx.fill();
			uiCtx.stroke();

			const botDx = proj[2].x - proj[3].x;
			const botDy = proj[2].y - proj[3].y;
			const botLen = Math.hypot(botDx, botDy) || 1;
			const bnx = -botDy / botLen;
			const bny = botDx / botLen;
			const rotatePosBottom = {
				x: midBottom.x + bnx * getRotateLineOffset(),
				y: midBottom.y + bny * getRotateLineOffset(),
			};

			uiCtx.beginPath();
			uiCtx.moveTo(midBottom.x, midBottom.y);
			uiCtx.lineTo(rotatePosBottom.x, rotatePosBottom.y);
			uiCtx.strokeStyle = "#f39c12";
			uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
			uiCtx.stroke();

			uiCtx.beginPath();
			uiCtx.arc(
				rotatePosBottom.x,
				rotatePosBottom.y,
				getHandleRadius(),
				0,
				Math.PI * 2,
			);
			uiCtx.fillStyle = "#f1c40f";
			uiCtx.strokeStyle = "#fff";
			uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
			uiCtx.fill();
			uiCtx.stroke();
		} else {
			uiCtx.save();
			uiCtx.translate(x, y);
			uiCtx.rotate((rotation * Math.PI) / 180);

			uiCtx.strokeStyle = "rgba(255, 255, 255, 0.8)";
			uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
			uiCtx.strokeRect(-w / 2, -h / 2, w, h);

			const handles = getHandles(w, h);

			uiCtx.beginPath();
			uiCtx.moveTo(0, -h / 2);
			uiCtx.lineTo(handles.rotate.x, handles.rotate.y);
			uiCtx.moveTo(0, h / 2);
			uiCtx.lineTo(handles.rotateBottom.x, handles.rotateBottom.y);
			uiCtx.strokeStyle = "#f39c12";
			uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
			uiCtx.stroke();

			for (const [key, pos] of Object.entries(handles)) {
				uiCtx.beginPath();
				uiCtx.arc(pos.x, pos.y, getHandleRadius(), 0, Math.PI * 2);
				if (key.startsWith("tilt")) {
					uiCtx.fillStyle = "#ff66cc";
				} else if (key === "rotate" || key === "rotateBottom") {
					uiCtx.fillStyle = "#f1c40f";
				} else {
					uiCtx.fillStyle = "#2ecc71";
				}
				uiCtx.strokeStyle = "#ffffff";
				uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
				uiCtx.fill();
				uiCtx.stroke();
			}
			uiCtx.restore();
		}
	}
}

export function renderBg() {
	if (!pickBufferCtx || pickBufferCanvas.width !== CANVAS_W) {
		initPickBuffer();
	}
	bgCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

	const bg = state.bgImageCropped || state.bgImage;
	if (state.bgVideo && !bg) {
		if (!state.cropRatio || state.cropRatio === "none") {
			const vw = state.bgVideo.videoWidth;
			const vh = state.bgVideo.videoHeight;
			if (vw && vh && Math.abs(vw / vh - CANVAS_W / CANVAS_H) < 0.001) {
				try {
					bgCtx.drawImage(state.bgVideo, 0, 0, CANVAS_W, CANVAS_H);
				} catch (e) {
					drawVideoCover(bgCtx, state.bgVideo, CANVAS_W, CANVAS_H);
				}
			} else {
				drawVideoCover(bgCtx, state.bgVideo, CANVAS_W, CANVAS_H);
			}
		} else {
			const { sx, sy, sw, sh } = computeVideoCrop(
				state.bgVideo,
				state.cropRatio,
			);
			try {
				bgCtx.drawImage(
					state.bgVideo,
					sx,
					sy,
					sw,
					sh,
					0,
					0,
					CANVAS_W,
					CANVAS_H,
				);
			} catch (e) {
				drawVideoCover(bgCtx, state.bgVideo, CANVAS_W, CANVAS_H);
			}
		}
	} else if (bg) {
		const imgW = bg.width;
		const imgH = bg.height;
		const scale = Math.max(CANVAS_W / imgW, CANVAS_H / imgH);
		const sw = CANVAS_W / scale;
		const sh = CANVAS_H / scale;
		const sx = (imgW - sw) / 2;
		const sy = (imgH - sh) / 2;
		bgCtx.drawImage(bg, sx, sy, sw, sh, 0, 0, CANVAS_W, CANVAS_H);
	} else {
		const cs = getComputedStyle(document.documentElement);
		const canvasBg = cs.getPropertyValue("--canvas-bg").trim() || "#000000";
		bgCtx.fillStyle = canvasBg;
		bgCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
		bgCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
	}

	if (pickBufferCtx) {
		pickBufferCtx.fillStyle = "#000000";
		pickBufferCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
	}

	for (let i = objects.length - 1; i >= 0; i--) {
		const obj = objects[i];
		if (!obj.canvas.width) continue;

		// 同步繪製 ID Buffer
		if (pickBufferCtx) {
			pickBufferCtx.save();
			pickBufferCtx.translate(obj.overlay.x, obj.overlay.y);
			pickBufferCtx.rotate((obj.overlay.rotation * Math.PI) / 180);
			pickBufferCtx.fillStyle = `rgb(${i + 1}, 0, 0)`;
			
			// 先只處理 2D 非透視狀態的精確拾取
			const is3D = Math.abs(obj.overlay.rotX || 0) >= 1 || Math.abs(obj.overlay.rotY || 0) >= 1;
			if (!is3D) {
				const { w, h } = getOverlaySize(i);
				pickBufferCtx.fillRect(-w / 2, -h / 2, w, h);
			}
			pickBufferCtx.restore();
		}

		const isBack =
			Math.abs(obj.overlay.rotX || 0) >= 90 ||
			Math.abs(obj.overlay.rotY || 0) >= 90;
		const hasBack = isBack && obj.backCanvas && obj.backCanvas.width;
		const srcCanvas = hasBack ? obj.backCanvas : obj.canvas;

		const displayScale = CANVAS_W / DESIGN_W;
		const w = DESIGN_W * COVER_RATIO * obj.overlay.scale * displayScale;
		const h = w * (srcCanvas.height / srcCanvas.width);
		const { x, y, rotation } = obj.overlay;

		if (obj.overlay.rotX || obj.overlay.rotY) {
			const fov = w * FOV_FACTOR;
			drawPerspective(bgCtx, srcCanvas, obj.overlay, x, y, w, h, fov);
		} else {
			bgCtx.save();
			bgCtx.translate(x, y);
			bgCtx.rotate((rotation * Math.PI) / 180);
			if (isBack && !hasBack) bgCtx.scale(-1, 1);
			bgCtx.drawImage(srcCanvas, -w / 2, -h / 2, w, h);
			bgCtx.restore();
		}
	}
}

function drawTrashUI() {
	if (!state.drag.active || state.selectedIndex < 0) return;

	syncTrashPos();

	const progress = Math.max(0, Math.min(1, state.trashHoverProgress || 0));
	const canDelete = !!state.isDraggingToTrash;

	const scale = 1 + progress * (TRASH_VISUAL_MAX_SCALE - 1);
	const currentRadius = TRASH_RADIUS * scale;

	uiCtx.save();

	if (canDelete) {
		const pulse = 0.5 + 0.5 * Math.sin(state.trashPulse);
		uiCtx.beginPath();
		uiCtx.arc(
			TRASH_POS.x,
			TRASH_POS.y,
			currentRadius * (1.18 + pulse * 0.12),
			0,
			Math.PI * 2,
		);
		uiCtx.fillStyle = `rgba(231, 76, 60, ${0.16 + pulse * 0.14})`;
		uiCtx.fill();
	}

	uiCtx.beginPath();
	uiCtx.arc(TRASH_POS.x, TRASH_POS.y, currentRadius, 0, Math.PI * 2);

	if (canDelete) {
		uiCtx.fillStyle = "rgba(231, 76, 60, 0.92)";
		uiCtx.strokeStyle = "rgba(255, 255, 255, 0.95)";
		uiCtx.lineWidth = Math.max(2, 3 * getScaleFactor());
	} else if (progress > 0) {
		uiCtx.fillStyle = `rgba(231, 76, 60, ${0.35 + progress * 0.45})`;
		uiCtx.strokeStyle = `rgba(255, 255, 255, ${0.5 + progress * 0.5})`;
		uiCtx.lineWidth = 2;
	} else {
		uiCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
		uiCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
		uiCtx.lineWidth = 2;
	}
	uiCtx.fill();
	uiCtx.stroke();

	uiCtx.translate(TRASH_POS.x, TRASH_POS.y);
	const iconScale = (TRASH_RADIUS / 24) * scale;
	uiCtx.scale(iconScale, iconScale);

	uiCtx.strokeStyle = `rgba(255, 255, 255, ${0.8 + progress * 0.2})`;
	uiCtx.lineWidth = 2;
	uiCtx.lineCap = "round";
	uiCtx.lineJoin = "round";

	uiCtx.beginPath();
	uiCtx.moveTo(-8, -6);
	uiCtx.lineTo(8, -6);
	uiCtx.moveTo(-3, -6);
	uiCtx.lineTo(-3, -8);
	uiCtx.lineTo(3, -8);
	uiCtx.lineTo(3, -6);
	uiCtx.moveTo(-7, -6);
	uiCtx.lineTo(-6, 8);
	uiCtx.lineTo(6, 8);
	uiCtx.lineTo(7, -6);
	uiCtx.moveTo(-2, -2);
	uiCtx.lineTo(-2, 4);
	uiCtx.moveTo(2, -2);
	uiCtx.lineTo(2, 4);
	uiCtx.stroke();

	uiCtx.restore();
}

export function renderUI() {
	uiCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
	drawGridUI();
	drawAlignGuidesUI();
	if (!state.isExporting) drawSelectionUI(state.selectedIndex);
	drawTrashUI();

	if (state.drag.active && state.isDraggingToTrash) {
		state.trashPulse = (state.trashPulse + 0.18) % (Math.PI * 2);
		scheduleDrawUI();
	} else if (state.trashPulse !== 0) {
		state.trashPulse = 0;
	}
}

export function render() {
	renderBg();
	renderUI();
}

export function getHandles(w, h) {
	return {
		tl: {
			x: -w / 2,
			y: -h / 2,
		},
		tr: {
			x: w / 2,
			y: -h / 2,
		},
		bl: {
			x: -w / 2,
			y: h / 2,
		},
		br: {
			x: w / 2,
			y: h / 2,
		},
		rotate: {
			x: 0,
			y: -h / 2 - getRotateLineOffset(),
		},
		rotateBottom: {
			x: 0,
			y: h / 2 + getRotateLineOffset(),
		},
		tiltTop: {
			x: 0,
			y: -h / 2 - getTiltOffset(),
		},
		tiltBottom: {
			x: 0,
			y: h / 2 + getTiltOffset(),
		},
		tiltLeft: {
			x: -w / 2 - getTiltOffsetX(),
			y: 0,
		},
		tiltRight: {
			x: w / 2 + getTiltOffsetX(),
			y: 0,
		},
	};
}

let _cachedCanvasRect = null;
export function invalidateCanvasRect() {
	_cachedCanvasRect = null;
}
export function getPointer(e) {
	if (isMobile || !_cachedCanvasRect) {
		_cachedCanvasRect = ui.canvas.getBoundingClientRect();
	}
	const rect = _cachedCanvasRect;
	const scaleX = CANVAS_W / rect.width;
	const scaleY = CANVAS_H / rect.height;
	const touch = e.touches ? e.touches[0] : e;
	return {
		x: (touch.clientX - rect.left) * scaleX,
		y: (touch.clientY - rect.top) * scaleY,
	};
}

export function hitTestHandle(mx, my) {
	let idx = state.selectedIndex;
	if (idx < 0 || !objects[idx] || !objects[idx].canvas.width) {
		let best = -1;
		let bestDist = Infinity;
		for (let i = 0; i < objects.length; i++) {
			const o = objects[i];
			if (!o.canvas.width) continue;
			const d = Math.hypot(mx - o.overlay.x, my - o.overlay.y);
			if (d < bestDist) {
				bestDist = d;
				best = i;
			}
		}
		if (best < 0) return null;
		idx = best;
	}

	const obj = objects[idx];
	if (!obj.canvas.width) return null;
	const { w, h } = getOverlaySize(idx);
	// 防護 w/h 為 0 代表物件尚未完成初始化 紅點位置無意義
	if (w <= 0 || h <= 0) return null;

	if (obj.overlay.rotX || obj.overlay.rotY) {
		const fov = w * FOV_FACTOR;
		const hw = w / 2,
			hh = h / 2;
		const corners = [
			{
				x: -hw,
				y: -hh,
			},
			{
				x: hw,
				y: -hh,
			},
			{
				x: hw,
				y: hh,
			},
			{
				x: -hw,
				y: hh,
			},
		];
		const rx = (obj.overlay.rotX * Math.PI) / 180;
		const ry = (obj.overlay.rotY * Math.PI) / 180;
		const rz = (obj.overlay.rotation * Math.PI) / 180;
		const proj = corners.map((p) => {
			const r = rotate3D(p.x, p.y, 0, rx, ry, rz);
			const safeW = Math.max(fov + r.z, 0.1);
			const persp = fov / safeW;
			return {
				x: obj.overlay.x + r.x * persp * obj.overlay.scale,
				y: obj.overlay.y + r.y * persp * obj.overlay.scale,
			};
		});

		const midTop = {
			x: (proj[0].x + proj[1].x) / 2,
			y: (proj[0].y + proj[1].y) / 2,
		};
		const midBottom = {
			x: (proj[3].x + proj[2].x) / 2,
			y: (proj[3].y + proj[2].y) / 2,
		};
		const midLeft = {
			x: (proj[0].x + proj[3].x) / 2,
			y: (proj[0].y + proj[3].y) / 2,
		};
		const midRight = {
			x: (proj[1].x + proj[2].x) / 2,
			y: (proj[1].y + proj[2].y) / 2,
		};

		const tiltTargets = [
            [midTop, 'tiltTop'], [midBottom, 'tiltBottom'],
            [midLeft, 'tiltLeft'], [midRight, 'tiltRight']
        ];
        let bestTilt = null;
        let bestTiltDist = Infinity;
        for (const [p, key] of tiltTargets) {
            const d = Math.hypot(mx - p.x, my - p.y);
            if (d < getTiltHitRadius() && d < bestTiltDist) {
                bestTilt = key;
                bestTiltDist = d;
            }
        }

        const cornerKeys = ['tl', 'tr', 'br', 'bl'];
        let bestCorner = null;
        let bestCornerDist = Infinity;
        for (let i = 0; i < 4; i++) {
            const d = Math.hypot(mx - proj[i].x, my - proj[i].y);
            if (d < getHandleHitRadius() && d < bestCornerDist) {
                bestCorner = cornerKeys[i];
                bestCornerDist = d;
            }
        }

        if (bestTilt && bestCorner) {
            return bestTiltDist <= bestCornerDist ? bestTilt : bestCorner;
        }
        if (bestTilt) return bestTilt;
        if (bestCorner) return bestCorner;

		const topDx = proj[1].x - proj[0].x;
		const topDy = proj[1].y - proj[0].y;
		const topLen = Math.hypot(topDx, topDy) || 1;
		const rotatePos = {
			x: midTop.x + (topDy / topLen) * getRotateLineOffset(),
			y: midTop.y + (-topDx / topLen) * getRotateLineOffset(),
		};
		if (Math.hypot(mx - rotatePos.x, my - rotatePos.y) < getHandleHitRadius())
			return "rotate";

		const botDx = proj[2].x - proj[3].x;
		const botDy = proj[2].y - proj[3].y;
		const botLen = Math.hypot(botDx, botDy) || 1;
		const rotatePosBottom = {
			x: midBottom.x + (-botDy / botLen) * getRotateLineOffset(),
			y: midBottom.y + (botDx / botLen) * getRotateLineOffset(),
		};
		if (
			Math.hypot(mx - rotatePosBottom.x, my - rotatePosBottom.y) <
			getHandleHitRadius()
		)
			return "rotateBottom";

		return null;
	}

	const handles = getHandles(w, h);
	const dx = mx - obj.overlay.x;
	const dy = my - obj.overlay.y;
	const angle = (-obj.overlay.rotation * Math.PI) / 180;
	const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
	const ly = dx * Math.sin(angle) + dy * Math.cos(angle);

	for (const key of ["tiltTop", "tiltBottom", "tiltLeft", "tiltRight"]) {
		const pos = handles[key];
		if (Math.hypot(lx - pos.x, ly - pos.y) < getTiltHitRadius()) return key;
	}

	for (const [key, pos] of Object.entries(handles)) {
		if (key.startsWith("tilt")) continue;
		if (Math.hypot(lx - pos.x, ly - pos.y) < getHandleHitRadius()) return key;
	}

	return null;
}

export function getTouchDistanceAndAngle(e) {
	const t1 = e.touches[0];
	const t2 = e.touches[1];
	const dx = t2.clientX - t1.clientX;
	const dy = t2.clientY - t1.clientY;
	return {
		dist: Math.hypot(dx, dy),
		angle: (Math.atan2(dy, dx) * 180) / Math.PI,
	};
}

export function computeSnap(pos, draggedIdx) {
	const result = {
		x: pos.x,
		y: pos.y,
		guides: [],
	};
	if (!state.showAlignGuides) return result;

	const obj = objects[draggedIdx];
	if (!obj || !obj.canvas.width) return result;

	const { w, h } = getOverlaySize(draggedIdx);
	const rad = (obj.overlay.rotation * Math.PI) / 180;
	const rotW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
	const rotH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));

	const xTargets = [
		{
			val: CANVAS_W / 2,
		},
	];
	const yTargets = [
		{
			val: CANVAS_H / 2,
		},
	];
	for (let i = 0; i < objects.length; i++) {
		if (i === draggedIdx || !objects[i].canvas.width) continue;
		const b = getRotatedBounds(i);
		xTargets.push(
			{
				val: b.cx,
			},
			{
				val: b.left,
			},
			{
				val: b.right,
			},
		);
		yTargets.push(
			{
				val: b.cy,
			},
			{
				val: b.top,
			},
			{
				val: b.bottom,
			},
		);
	}

	const draggedXs = [pos.x, pos.x - rotW / 2, pos.x + rotW / 2];
	const draggedYs = [pos.y, pos.y - rotH / 2, pos.y + rotH / 2];

	let bestX = null;
	for (const d of draggedXs) {
		for (const t of xTargets) {
			const diff = Math.abs(d - t.val);
			if (diff < getSnapThreshold() && (!bestX || diff < bestX.diff)) {
				bestX = {
					diff,
					delta: t.val - d,
					line: t.val,
				};
			}
		}
	}
	if (bestX) {
		result.x = pos.x + bestX.delta;
		result.guides.push({
			type: "v",
			x: bestX.line,
		});
	}

	let bestY = null;
	for (const d of draggedYs) {
		for (const t of yTargets) {
			const diff = Math.abs(d - t.val);
			if (diff < getSnapThreshold() && (!bestY || diff < bestY.diff)) {
				bestY = {
					diff,
					delta: t.val - d,
					line: t.val,
				};
			}
		}
	}
	if (bestY) {
		result.y = pos.y + bestY.delta;
		result.guides.push({
			type: "h",
			y: bestY.line,
		});
	}

	return result;
}