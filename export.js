import { objects, state, currentObjectIndex, CANVAS_W, CANVAS_H, singleObject, render, scheduleDraw, scheduleDrawBg, composeOverlay, composeBackOverlay, getOverlaySize, resetOverlayPosition } from "./canvas.js";

import { getText, isMobile } from "./i18n.js";
import { pauseAllObjectVideos, resumeAllObjectVideos } from "./objectVideo.js";
import {
    initGLExportRenderer, isGLAvailable, uploadTexture,
    drawObject as glDrawObject, clearGL, getGLCanvas,
} from "./glExportRenderer.js";
import { BASE64_ANIM_LOADING } from "./static.js";

let _ui = null;
let _showToast = () => {};
let _getCurrentLang = () => "en";

export function initExport({ ui, showToast, getCurrentLang } = {}) {
	if (ui) _ui = ui;
	if (typeof showToast === "function") _showToast = showToast;
	if (typeof getCurrentLang === "function") _getCurrentLang = getCurrentLang;

	// 自動綁定匯出按鈕
	if (_ui.btnExport) _ui.btnExport.addEventListener("click", handleExportClick);
	if (_ui.btnExportBar)
		_ui.btnExportBar.addEventListener("click", handleExportClick);
	if (_ui.btnShare) _ui.btnShare.addEventListener("click", shareImage);
	if (_ui.btnShareMobile)
		_ui.btnShareMobile.addEventListener("click", shareImage);
}

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
	return { x: x3, y: y2, z: z3 };
}

function drawTriangleToCtx(ctx, src, p0, p1, p2, u0, v0, u1, v1, u2, v2) {
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

function drawPerspectiveToCtx(
	ctx,
	srcCanvas,
	overlay,
	cx,
	cy,
	w,
	h,
	fov,
	scale = 1,
) {
	const hw = w / 2, hh = h / 2;
	const corners = [
		{ x: -hw, y: -hh }, { x: hw, y: -hh },
		{ x: hw, y: hh }, { x: -hw, y: hh },
	];

	const rx = ((overlay.rotX || 0) * Math.PI) / 180;
	const ry = ((overlay.rotY || 0) * Math.PI) / 180;
	const rz = ((overlay.rotation || 0) * Math.PI) / 180;

	const proj = corners.map((p) => {
		const r = rotate3D(p.x, p.y, 0, rx, ry, rz);
		const persp = fov / (fov + r.z);
		return {
			x: cx + r.x * persp * overlay.scale * scale,
			y: cy + r.y * persp * overlay.scale * scale,
		};
	});

	const sw = srcCanvas.width, sh = srcCanvas.height;
	drawTriangleToCtx(
		ctx, srcCanvas,
		proj[0], proj[1], proj[2],
		0, 0, sw, 0, sw, sh
	);
	drawTriangleToCtx(
		ctx, srcCanvas,
		proj[0], proj[2], proj[3],
		0, 0, sw, sh, 0, sh
	);
}

function drawObjectToCtx(ctx, obj, idx, scale = 1) {
	if (!obj.canvas || !obj.canvas.width) return;

	const isBack =
		Math.abs(obj.overlay.rotX || 0) > 90 ||
		Math.abs(obj.overlay.rotY || 0) > 90;
	const srcCanvas =
		isBack && obj.backCanvas && obj.backCanvas.width
			? obj.backCanvas
			: obj.canvas;

	const w = CANVAS_W * 0.37 * obj.overlay.scale * scale;
	const h = w * (srcCanvas.height / srcCanvas.width);
	const x = obj.overlay.x * scale;
	const y = obj.overlay.y * scale;
	const rotation = obj.overlay.rotation;

	if (obj.overlay.rotX || obj.overlay.rotY) {
		drawPerspectiveToCtx(ctx, srcCanvas, obj.overlay, x, y, w, h, w * 7, scale);
	} else {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate((rotation * Math.PI) / 180);
		ctx.drawImage(srcCanvas, -w / 2, -h / 2, w, h);
		ctx.restore();
	}
}

function backupBackCanvasesForExport() {
	const backups = [];
	for (const obj of objects) {
		if (!obj || !obj.backCanvas || !obj.backCanvas.width) continue;
		const clone = document.createElement("canvas");
		clone.width = obj.backCanvas.width;
		clone.height = obj.backCanvas.height;
		clone.getContext("2d").drawImage(obj.backCanvas, 0, 0);
		backups.push({ obj, original: obj.backCanvas });
		obj.backCanvas = clone;
	}
	return backups;
}

function restoreBackCanvasesAfterExport(backups) {
	if (!Array.isArray(backups)) return;
	for (const { obj, original } of backups) {
		obj.backCanvas = original;
	}
}

function showExportLog(msg, showSpinner = true) {
	const el = document.getElementById("export-log");
	const txt = document.getElementById("export-log-text");
	const sp = document.getElementById("export-log-spinner");
	if (!el || !txt) return;
	txt.textContent = msg;
	if (sp) {
		if (showSpinner && !sp.src) sp.src = BASE64_ANIM_LOADING;
		sp.style.display = showSpinner ? "inline-block" : "none";
	}
	el.classList.add("show");
}

function hideExportLog() {
	const el = document.getElementById("export-log");
	const sp = document.getElementById("export-log-spinner");
	if (exportLogTimer) {
		clearTimeout(exportLogTimer);
		exportLogTimer = null;
	}
	if (!el) return;
	el.classList.remove("show");
	if (sp) sp.style.display = "none";
}

function scheduleHideExportLog(ms) {
	if (exportLogTimer) clearTimeout(exportLogTimer);
	exportLogTimer = setTimeout(hideExportLog, ms);
}

function setBtnEncodingState(isEncoding) {
	const targetBtns = [_ui.btnExport, _ui.btnExportBar];
	targetBtns.forEach((btn) => {
		if (!btn) return;
		const label = btn.querySelector('[data-i18n="export"]');
		if (isEncoding) {
			btn.disabled = true;
			btn.classList.add("encoding");
			if (label) {
				if (!btn.hasAttribute("data-original-label")) {
					btn.setAttribute("data-original-label", label.textContent);
				}
				label.textContent = getText(_getCurrentLang(), "encoding");
			}
		} else {
			btn.disabled = false;
			btn.classList.remove("encoding");
			if (label) {
				const orig = btn.getAttribute("data-original-label");
				label.textContent = orig || getText(_getCurrentLang(), "export");
				btn.removeAttribute("data-original-label");
			}
		}
	});
}

async function generateExportBlob() {
    const targetMode = isMobile
        ? _ui.selectTargetMobile.value || "all"
        : _ui.selectTarget.value || "all";
    const format = isMobile
        ? _ui.selectFormatMobile.value || "png"
        : _ui.selectFormat.value || "png";

    const currentObj = objects[currentObjectIndex];
    const hasObject = currentObj && currentObj.canvas && currentObj.canvas.width > 0;

    if (targetMode === "object") {
        if (!hasObject) {
            alert(getText(_getCurrentLang(), "uploadObjFirst"));
            return null;
        }
    } else {
        const anyVisible = objects.some((o) => o.visible && o.canvas.width > 0);
        if (!state.bgImage && !state.bgVideo && !anyVisible) {
            alert(getText(_getCurrentLang(), "uploadFirst"));
            return null;
        }
    }

    const prevSelected = state.selectedIndex;
    const prevGridMode = state.gridMode;
    const prevGuides = state.alignGuides;
    const prevShowAlign = state.showAlignGuides;
    
    state.selectedIndex = -1;
    state.gridMode = "none";
    state.alignGuides = [];
    state.showAlignGuides = false;
    render();

    const backCanvasBackups = backupBackCanvasesForExport();
    const prefix = (currentObj && currentObj.name) || state.bgName || "overlay";
    const filename = targetMode === "object"
            ? `${prefix}_object.${format}`
            : `${prefix}_proofshot_in_cosmo.${format}`;

    const finalCanvas = document.createElement("canvas");
    
    if (targetMode === "object") {
        const isBack = Math.abs(currentObj.overlay.rotX || 0) > 90 || Math.abs(currentObj.overlay.rotY || 0) > 90;
        const srcCanvas = isBack && currentObj.backCanvas && currentObj.backCanvas.width ? currentObj.backCanvas : currentObj.canvas;
        
        finalCanvas.width = srcCanvas.width;
        finalCanvas.height = srcCanvas.height;
        const ctx = finalCanvas.getContext("2d", { willReadFrequently: true });
        
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        ctx.drawImage(srcCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
    } else {
        finalCanvas.width = CANVAS_W;
        finalCanvas.height = CANVAS_H;
        const ctx = finalCanvas.getContext("2d", { willReadFrequently: true });

        // 只針對最上層 Object 判斷 排除透明像素
        let bgColor = "#b3b3b3";
        try {
            const topObj = objects.find((o) => o.canvas && o.canvas.width > 0);
            if (topObj) {
                const sampleCanvas = document.createElement("canvas");
                sampleCanvas.width = 32;
                sampleCanvas.height = 32;
                const sctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
                sctx.drawImage(topObj.canvas, 0, 0, 32, 32);
                const imgData = sctx.getImageData(0, 0, 32, 32).data;
                
                let darkCount = 0, lightCount = 0, totalSolid = 0;
                for (let i = 0; i < imgData.length; i += 4) {
                    const a = imgData[i + 3];
                    if (a < 200) continue; 
                    totalSolid++;
                    const lum = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
                    if (lum > 200) lightCount++;
                    else if (lum < 50) darkCount++;
                }
                if (totalSolid > 0) {
                    if (lightCount > darkCount) bgColor = "#000000";
                    else if (darkCount > lightCount) bgColor = "#ffffff";
                    else bgColor = "#b3b3b3";
                }
            }
        } catch (e) {
            console.warn("取樣失敗", e);
        }

        // 填底色
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        
        // 畫背景圖
        const bgImg = state.bgImageCropped || state.bgImage;
        if (bgImg) {
            const s = Math.max(CANVAS_W / bgImg.width, CANVAS_H / bgImg.height);
            const sw = CANVAS_W / s;
            const sh = CANVAS_H / s;
            ctx.drawImage(bgImg, (bgImg.width - sw) / 2, (bgImg.height - sh) / 2, sw, sh, 0, 0, CANVAS_W, CANVAS_H);
        }
        
        // 畫物件
        for (let k = objects.length - 1; k >= 0; k--) {
            const obj = objects[k];
            if (!obj || !obj.canvas || obj.canvas.width <= 0) continue;
            drawObjectToCtx(ctx, obj, k, 1);
        }
        
        // 貼上 UI 層
        if (_ui.uiCanvas) {
            ctx.drawImage(_ui.uiCanvas, 0, 0, CANVAS_W, CANVAS_H);
        }
    }

    // 邊緣平滑 對整張圖做輕微模糊並半透明疊加，消除切線感
    const smoothCanvas = document.createElement("canvas");
    smoothCanvas.width = finalCanvas.width;
    smoothCanvas.height = finalCanvas.height;
    const sctx = smoothCanvas.getContext("2d");
    sctx.filter = "blur(1.5px)"; 
    sctx.drawImage(finalCanvas, 0, 0);

    const fctx = finalCanvas.getContext("2d", { willReadFrequently: true });
    fctx.globalAlpha = 0.35;
    fctx.drawImage(smoothCanvas, 0, 0);
    fctx.globalAlpha = 1.0;

    const exportCtx = fctx;
    const toBlob = (mime, quality) => new Promise((r) => finalCanvas.toBlob(r, mime, quality));

    let blob = null;
    let finalFilename = filename;

    setBtnEncodingState(true);

    try {
        if (format === "png") {
            blob = await toBlob("image/png");
        } else if (format === "webp") {
            const webpQ = ((state.exportSettings && state.exportSettings.webpQuality) || 90) / 100;
            blob = await toBlob("image/webp", webpQ);
        } else if (format === "jpg") {
            try {
                const { encode } = await import("https://esm.sh/@jsquash/jpeg@1.5.0");
                const data = exportCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
                const jpgQ = (state.exportSettings && state.exportSettings.jpgQuality) || 85;
                const buf = await encode(data, { quality: jpgQ });
                blob = new Blob([buf], { type: "image/jpeg" });
            } catch (err) {
                console.warn("jpg encode failed", err);
                blob = await toBlob("image/jpeg", 0.85);
            }
        } else if (format === "avif" || format === "jxl") {
            try {
                const data = exportCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
                let encodedBuf;
                if (format === "avif") {
                    const { encode } = await import("https://esm.sh/@jsquash/avif@2.1.1");
                    encodedBuf = await encode(data, { lossless: false, quality: 80 });
                } else {
                    const { encode } = await import("https://esm.sh/@jsquash/jxl@1.3.0");
                    encodedBuf = await encode(data, { lossless: true });
                }
                const mime = format === "avif" ? "image/avif" : "image/jxl";
                blob = new Blob([encodedBuf], { type: mime });
            } catch (err) {
                console.warn(`${format} encode failed, fallback to PNG`, err);
                _showToast(getText(_getCurrentLang(), "encodeFailedFallback", { format: format.toUpperCase() }));
                blob = await toBlob("image/png");
                finalFilename = targetMode === "object" ? `${prefix}_object.png` : `${prefix}_proofshot_in_cosmo.png`;
            }
        }
    } catch (err) {
        console.error("Export error:", err);
        _showToast(getText(_getCurrentLang(), "exportFailed") || "匯出失敗");
        blob = null;
    } finally {
        setBtnEncodingState(false);
        state.selectedIndex = prevSelected;
        state.gridMode = prevGridMode;
        state.alignGuides = prevGuides;
        state.showAlignGuides = prevShowAlign;
        restoreBackCanvasesAfterExport(backCanvasBackups);
        scheduleDraw();
    }

    if (!blob) {
        _showToast(getText(_getCurrentLang(), "exportFailed") || "匯出失敗：無法產生檔案");
        return null;
    }
    const file = new File([blob], finalFilename, { type: blob.type });
    return { blob, file, filename: finalFilename };
}

async function exportImage() {
	const result = await generateExportBlob();
	if (!result) return;
	const url = URL.createObjectURL(result.blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = result.filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 20000);
}

async function shareImage() {
	const result = await generateExportBlob();
	if (!result) return;
	if (
		navigator.share &&
		navigator.canShare &&
		navigator.canShare({ files: [result.file] })
	) {
		try {
			await navigator.share({
				files: [result.file],
				title: result.filename,
				text: "",
			});
			return;
		} catch (err) {
			if (err.name !== "AbortError") console.warn("Share error:", err);
			return;
		}
	}
	_showToast(getText(_getCurrentLang(), "shareFailedFallback"));
	exportImage();
}

async function handleExportClick() {
	state.isExporting = true;
	const format = isMobile
		? _ui.selectFormatMobile.value || "png"
		: _ui.selectFormat.value || "png";

	pauseAllObjectVideos();
	try {
		if (format === "mp4") {
			// 從 DOM 讀取 fps 傳給匯出函式
			const wrapper = document.querySelector(".advanced-settings-wrapper");
			const fpsInput = wrapper?.querySelector(".adv-fps");
			const fps = fpsInput ? parseInt(fpsInput.value, 10) || 30 : 30;
			await exportObjectVideoFull({ fps });
		} else if (format === "gif") {
			const wrapper = document.querySelector(".advanced-settings-wrapper");
			const fpsInput = wrapper?.querySelector(".adv-fps");
			const fps = fpsInput ? parseInt(fpsInput.value, 10) || 30 : 30;
			await exportObjectGifFull({ fps });
		} else {
			await exportImage();
		}
	} finally {
		state.isExporting = false;
		scheduleDraw();
		resumeAllObjectVideos();
	}
}

async function exportObjectGifFull(options = {}) {
	// 先從 settings 讀取 fps 若沒有才用預設 30
	const settingsFromDOM = (() => {
		const wrapper = document.querySelector(".advanced-settings-wrapper");
		if (!wrapper) return null;
		const fpsInput = wrapper.querySelector(".adv-fps");
		return fpsInput ? parseInt(fpsInput.value, 10) : null;
	})();
	const { maxDuration = 60, fps = settingsFromDOM || 30 } = options;
	mp4ExportCancelled = false;

	if (!window.Mediabunny && window.__loadMediabunny) {
		showExportLog(getText(_getCurrentLang(), "exportLogMediabunny"));
		try {
			await window.__loadMediabunny();
		} catch {}
	}
	if (!window.Mediabunny) {
		showExportLog(getText(_getCurrentLang(), "exportLogFailed"), false);
		scheduleHideExportLog(3000);
		_showToast(
			getText(_getCurrentLang(), "exportFailed") || "Mediabunny 載入失敗",
			3000,
		);
		return;
	}

	// 動態載入 gifski-wasm (CDN)
	let gifskiEncode;
	try {
		const mod = await import("https://esm.sh/gifski-wasm@2.2.0");
		gifskiEncode = mod.default || mod;
	} catch (err) {
		console.error("gifski-wasm load failed", err);
		showExportLog(getText(_getCurrentLang(), "exportLogFailed"), false);
		scheduleHideExportLog(3000);
		_showToast("GIF 編碼器載入失敗", 3000);
		return;
	}

	const targetMode = isMobile
		? _ui.selectTargetMobile.value || "all"
		: _ui.selectTarget.value || "all";
        if (targetMode === "object") {
                const _curGuard = objects[currentObjectIndex];
                if (!_curGuard || !_curGuard.canvas || !_curGuard.canvas.width) {
                        alert(getText(_getCurrentLang(), "uploadObjFirst"));
                        setBtnEncodingState(false);
                        return;
                }
        }


	const MB = window.Mediabunny;
	const { Input, ALL_FORMATS, BlobSource, VideoSampleSink } = MB;

	const videoTracks = [];
	const indicesToRender = [];

	showExportLog(getText(_getCurrentLang(), "exportLogPreparing"));

	const probeInput = async (blob, tagIdx) => {
		let input;
		try {
			input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
		} catch (err) {
			return { hasVideo: false };
		}
		let hasVideo = false;
		try {
			const vt = await input.getPrimaryVideoTrack();
			if (vt) {
				let dur = null;
				try {
					dur = await input.computeDuration();
				} catch {}
				if (typeof dur !== "number" || !isFinite(dur) || dur <= 0) {
					dur =
						typeof vt.duration === "number" && isFinite(vt.duration)
							? vt.duration
							: 5;
				}
				const sink = new VideoSampleSink(vt, {
					hardwareAcceleration: "prefer-hardware",
				});
				videoTracks.push({ idx: tagIdx, input, sink, duration: dur });
				hasVideo = true;
			}
		} catch (err) {}
		if (!hasVideo) {
			try {
				input.dispose();
			} catch {}
		}
		return { hasVideo };
	};

	for (let i = 0; i < objects.length; i++) {
		const obj = objects[i];
		if (!obj.mediaBlob || !obj.image || !obj.canvas?.width) continue;
		if (targetMode === "object" && i !== currentObjectIndex) continue;
		showExportLog(getText(_getCurrentLang(), "exportLogDecoding"));
		const r = await probeInput(obj.mediaBlob, i);
		if (r.hasVideo) indicesToRender.push(i);
	}

	if (targetMode === "all" && state.bgVideoBlob) {
		showExportLog(getText(_getCurrentLang(), "exportLogDecoding"));
		const r = await probeInput(state.bgVideoBlob, -1);
		if (r.hasVideo) indicesToRender.push(-1);
	}

	if (!videoTracks.length) {
		showExportLog(getText(_getCurrentLang(), "exportLogNoTrack"), false);
		scheduleHideExportLog(3000);
		return;
	}

	const durations = videoTracks
		.map((t) => t.duration)
		.filter((d) => typeof d === "number" && isFinite(d) && d > 0);
	const longestDur = durations.length ? Math.max(...durations) : 5;
	const duration = Math.min(maxDuration, longestDur);
	if (!isFinite(duration) || duration <= 0) return;

	// 構圖畫布尺寸
	const compCanvas = document.createElement("canvas");
	let cw, ch;
	if (targetMode === "object") {
		const curObj = objects[currentObjectIndex];
		const isBack =
			Math.abs(curObj.overlay.rotX || 0) > 90 ||
			Math.abs(curObj.overlay.rotY || 0) > 90;
		const srcCanvas =
			isBack && curObj.backCanvas?.width ? curObj.backCanvas : curObj.canvas;
		cw = Math.floor(srcCanvas.width / 2) * 2;
		ch = Math.floor(srcCanvas.height / 2) * 2;
	} else {
		cw = Math.floor(CANVAS_W / 2) * 2;
		ch = Math.floor(CANVAS_H / 2) * 2;
	}
	const MAX_W = 3840,
		MAX_H = 2160;
	const scaleDown = Math.min(1, MAX_W / cw, MAX_H / ch);
	if (scaleDown < 1) {
		cw = Math.floor((cw * scaleDown) / 2) * 2;
		ch = Math.floor((ch * scaleDown) / 2) * 2;
	}
	compCanvas.width = cw;
	compCanvas.height = ch;
	const cctx = compCanvas.getContext("2d", { willReadFrequently: true });

	const frameDuration = 1 / fps;
	const totalFrames = Math.ceil(duration * fps);
	const tmpCanvas = document.createElement("canvas");
	const tmpCtx = tmpCanvas.getContext("2d", { willReadFrequently: true });
	const renderScale = compCanvas.width / CANVAS_W;

	const bgVideoEl = state.bgVideo;
	const bgVideoIsReal = !!bgVideoEl && bgVideoEl.readyState >= 2;

	// fps 砍半
	const gifFps = Math.max(1, Math.round(fps / 2));
	const frameStep = Math.max(1, Math.round(fps / gifFps));
	const collectedFrames = [];

	setBtnEncodingState(true);
	setMp4ExportLock(true);

	try {
		for (let i = 0; i < totalFrames; i++) {
			if (mp4ExportCancelled) {
				scheduleHideExportLog(2000);
				return;
			}
			const t = i * frameDuration;



			if (t >= duration) break;
			if (i % 30 === 0) {
				showExportLog(
					getText(_getCurrentLang(), "exportLogRendering", {
						current: i,
						total: totalFrames,
					}),
				);
			}

			// 更新影片軌道圖像
			for (const tr of videoTracks) {
				if (tr.idx < 0) continue;
				const obj = objects[tr.idx];
				const trackDur = tr.duration > 0 ? tr.duration : 5;
				const localT = t % trackDur;
				const sample = await tr.sink.getSample(localT);
				if (!sample) continue;
				const sw = sample.displayWidth;
				const sh = sample.displayHeight;
				if (tmpCanvas.width !== sw || tmpCanvas.height !== sh) {
					tmpCanvas.width = sw;
					tmpCanvas.height = sh;
				} else {
					tmpCtx.clearRect(0, 0, sw, sh);
				}
				sample.draw(tmpCtx, 0, 0);
				sample.close();
				const prev = obj.image;
				obj.image = tmpCanvas;
				composeOverlay(false, tr.idx);
				obj.image = prev;
			}

			// 背景影片 seek
			if (targetMode === "all" && bgVideoIsReal) {
				try {
					if (Math.abs(bgVideoEl.currentTime - t) > 1 / fps) {
						await new Promise((res) => {
							const onSeeked = () => {
								bgVideoEl.removeEventListener("seeked", onSeeked);
								res();
							};
							bgVideoEl.addEventListener("seeked", onSeeked);
							bgVideoEl.currentTime = t;
							setTimeout(() => {
								bgVideoEl.removeEventListener("seeked", onSeeked);
								res();
							}, 500);
						});
					}
				} catch (err) {}
			}

			cctx.clearRect(0, 0, compCanvas.width, compCanvas.height);

			// 繪製背景
			const bgImg = state.bgImageCropped || state.bgImage;
			if (targetMode === "all" && bgVideoIsReal) {
				const vw = bgVideoEl.videoWidth || 1;
				const vh = bgVideoEl.videoHeight || 1;
				const s = Math.max(compCanvas.width / vw, compCanvas.height / vh);
				const sw = compCanvas.width / s;
				const sh = compCanvas.height / s;
				const sx = (vw - sw) / 2;
				const sy = (vh - sh) / 2;
				try {
					cctx.drawImage(
						bgVideoEl,
						sx,
						sy,
						sw,
						sh,
						0,
						0,
						compCanvas.width,
						compCanvas.height,
					);
				} catch {
					cctx.fillStyle = "#1a1a1a";
					cctx.fillRect(0, 0, compCanvas.width, compCanvas.height);
				}
			} else if (bgImg) {
				const bgW = bgImg.width,
					bgH = bgImg.height;
				const s = Math.max(compCanvas.width / bgW, compCanvas.height / bgH);
				const sw = Math.min(Math.floor(compCanvas.width / s / 2) * 2, bgW);
				const sh = Math.min(Math.floor(compCanvas.height / s / 2) * 2, bgH);
				const sx = (bgW - sw) / 2;
				const sy = (bgH - sh) / 2;
				cctx.drawImage(
					bgImg,
					sx,
					sy,
					sw,
					sh,
					0,
					0,
					compCanvas.width,
					compCanvas.height,
				);
			} else {
				const isLight =
					document.documentElement.getAttribute("data-theme") === "light";
				cctx.fillStyle = isLight ? "#f4f5f7" : "#1a1a1a";
				cctx.fillRect(0, 0, compCanvas.width, compCanvas.height);
			}

			// 繪製 Object
			if (targetMode === "object") {
				const obj = objects[currentObjectIndex];
				const isBack =
					Math.abs(obj.overlay.rotX || 0) > 90 ||
					Math.abs(obj.overlay.rotY || 0) > 90;
				const srcCanvas =
					isBack && obj.backCanvas?.width ? obj.backCanvas : obj.canvas;

				cctx.fillStyle = "#000000";
				cctx.fillRect(0, 0, compCanvas.width, compCanvas.height);
				cctx.drawImage(srcCanvas, 0, 0, compCanvas.width, compCanvas.height);
  			} else {
                // 判斷是否需要 WebGL 只要有任一物件有 3D 傾斜
                const any3D = objects.some(o =>
                    o.canvas?.width && (Math.abs(o.overlay.rotX || 0) > 0.01 || Math.abs(o.overlay.rotY || 0) > 0.01)
                );

                if (any3D && isGLAvailable()) {
                    clearGL();
                    for (let k = objects.length - 1; k >= 0; k--) {
                        const obj = objects[k];
                        if (!obj || !obj.canvas || obj.canvas.width <= 0) continue;

                        const isBack = Math.abs(obj.overlay.rotX || 0) > 90 || Math.abs(obj.overlay.rotY || 0) > 90;
                        const srcCanvas = (isBack && obj.backCanvas && obj.backCanvas.width)
                            ? obj.backCanvas
                            : obj.canvas;

                        uploadTexture(srcCanvas);

                        const displayW = CANVAS_W * 0.37 * obj.overlay.scale * renderScale;
                        const displayH = displayW * (srcCanvas.height / srcCanvas.width);
                        const fov = displayW * 7;

                        glDrawObject(
                            obj.overlay,
                            displayW, displayH, fov,
                            compCanvas.width, compCanvas.height
                        );
                    }
                    cctx.drawImage(getGLCanvas(), 0, 0);
                } else {
                    // Canvas 2D 路徑
                    for (let k = objects.length - 1; k >= 0; k--) {
                        const obj = objects[k];
                        if (!obj || !obj.canvas || obj.canvas.width <= 0) continue;
                        drawObjectToCtx(cctx, obj, k, renderScale);
                    }
                }
            }

			// 每隔 frameStep 取一幀
			if (i % frameStep === 0) {
				collectedFrames.push(
					cctx.getImageData(0, 0, compCanvas.width, compCanvas.height),
				);
			}
		}

		if (!collectedFrames.length) {
			showExportLog(getText(_getCurrentLang(), "exportLogFailed"), false);
			scheduleHideExportLog(3000);
			_showToast(
				getText(_getCurrentLang(), "exportFailed") || "No frames for GIF",
				3000,
			);
			return;
		}

		showExportLog("Encoding GIF...");
		const gifBuf = await gifskiEncode({
			frames: collectedFrames,
			fps: gifFps,
			width: compCanvas.width,
			height: compCanvas.height,
			quality: (state.exportSettings && state.exportSettings.gifQuality) || 95,
		});

		const blob = new Blob([gifBuf], { type: "image/gif" });
		if (!blob.size) {
			showExportLog(getText(_getCurrentLang(), "exportLogFailed"), false);
			scheduleHideExportLog(3000);
			_showToast(
				getText(_getCurrentLang(), "exportFailed") || "Export failed",
				3000,
			);
			return;
		}

		const prefix = objects[currentObjectIndex].name || "object";
		const filename =
			targetMode === "object" ? `${prefix}_object.gif` : `${prefix}_full.gif`;

		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 20000);

		showExportLog(getText(_getCurrentLang(), "exportLogDone"), false);
		scheduleHideExportLog(2000);
	} catch (err) {
		console.error("exportObjectGifFull error:", err);
		showExportLog(getText(_getCurrentLang(), "exportLogFailed"), false);
		scheduleHideExportLog(3000);
		_showToast(
			getText(_getCurrentLang(), "exportFailed") || "Export failed",
			3000,
		);
	} finally {
		setBtnEncodingState(false);
		setMp4ExportLock(false);
		for (const tr of videoTracks) {
			try {
				tr.input.dispose();
			} catch {}
		}
		if (bgVideoEl) {
			try {
				bgVideoEl.currentTime = 0;
				bgVideoEl.play();
			} catch {}
		}
	}
}

function setMp4ExportLock(on) {
	mp4Exporting = on;
	// 不論開關都清掉進行中的互動
	state.drag.active = false;
	state.drag.scale = false;
	state.drag.rotate = false;
	state.drag.tilt = false;
	state.pan.active = false;
	state.pinch.active = false;
	state.alignGuides = [];

	if (on) {
		// 建立全螢幕遮罩 攔截所有 pointer / touch / click
		if (!mp4LockOverlay) {
			mp4LockOverlay = document.createElement("div");
			mp4LockOverlay.id = "mp4-export-lock";
			mp4LockOverlay.style.cssText = [
				"position:fixed",
				"inset:0",
				"z-index:99999",
				"background:rgba(0,0,0,0.35)",
				"cursor:wait",
				"display:flex",
				"align-items:center",
				"justify-content:center",
				"color:#fff",
				"font-size:13px",
				"font-weight:600",
				"letter-spacing:0.5px",
				"user-select:none",
				"touch-action:none",
			].join(";");
			mp4LockOverlay.textContent = getText(_getCurrentLang(), "encoding");
			mp4LockOverlay.addEventListener(
				"pointerdown",
				(e) => {
					e.preventDefault();
					e.stopPropagation();
				},
				true,
			);
			mp4LockOverlay.addEventListener(
				"touchstart",
				(e) => {
					e.preventDefault();
					e.stopPropagation();
				},
				{ passive: false, capture: true },
			);
			mp4LockOverlay.addEventListener(
				"click",
				(e) => {
					e.preventDefault();
					e.stopPropagation();
				},
				true,
			);
		}
		document.body.appendChild(mp4LockOverlay);
	} else {
		if (mp4LockOverlay && mp4LockOverlay.parentNode) {
			mp4LockOverlay.parentNode.removeChild(mp4LockOverlay);
		}
		// 清掉殘留的拖曳 / pinch 狀態
		state.drag.active = false;
		state.drag.scale = false;
		state.drag.rotate = false;
		state.drag.tilt = false;
		state.pan.active = false;
		state.pinch.active = false;
		state.alignGuides = [];
		scheduleDraw();
	}
}

async function exportObjectVideoFull(options = {}) {
	const { maxDuration = 60, fps = 30 } = options;

	if (!window.Mediabunny && window.__loadMediabunny) {
		showExportLog(getText(_getCurrentLang(), "exportLogMediabunny"));
		try {
			await window.__loadMediabunny();
		} catch {}
	}
	if (!window.Mediabunny) {
		showExportLog(getText(_getCurrentLang(), "exportLogFailed"), false);
		scheduleHideExportLog(3000);
		_showToast(
			getText(_getCurrentLang(), "exportFailed") || "Mediabunny 載入失敗",
			3000,
		);
		return;
	}
	const targetMode = isMobile
		? _ui.selectTargetMobile.value || "all"
		: _ui.selectTarget.value || "all";
        if (targetMode === "object") {
                const _curGuard = objects[currentObjectIndex];
                if (!_curGuard || !_curGuard.canvas || !_curGuard.canvas.width) {
                        alert(getText(_getCurrentLang(), "uploadObjFirst"));
                        setBtnEncodingState(false);
                        return;
                }
        }


	const MB = window.Mediabunny;
	const {
		Input,
		ALL_FORMATS,
		BlobSource,
		VideoSampleSink,
		Output,
		Mp4OutputFormat,
		BufferTarget,
		CanvasSource,
	} = MB;

	const AudioBufferSource = MB.AudioBufferSource || null;
	const AudioBufferSink = MB.AudioBufferSink || null;
	const AudioSampleSink = MB.AudioSampleSink || null;
	const AudioSampleSource = MB.AudioSampleSource || null;

	const videoTracks = [];
	const audioInputs = [];
	const audioSources = [];
	const indicesToRender = [];

	showExportLog(getText(_getCurrentLang(), "exportLogPreparing"));

	const probeInput = async (blob, tagIdx) => {
		let input;
		try {
			input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
		} catch (err) {
			console.warn("[export] Input create failed", err);
			return { hasVideo: false, hasAudio: false };
		}

		let hasVideo = false,
			hasAudio = false;

		// 影像軌
		try {
			const vt = await input.getPrimaryVideoTrack();
			if (vt) {
				let dur = null;
				try {
					dur = await input.computeDuration();
				} catch {}
				if (typeof dur !== "number" || !isFinite(dur) || dur <= 0) {
					dur =
						typeof vt.duration === "number" && isFinite(vt.duration)
							? vt.duration
							: 5;
				}
				const sink = new VideoSampleSink(vt, {
					hardwareAcceleration: "prefer-hardware",
				});
				videoTracks.push({ idx: tagIdx, input, sink, duration: dur });
				hasVideo = true;
			}
		} catch (err) {}

		// 音訊軌
		try {
			const at = await input.getPrimaryAudioTrack();
			if (at) {
				let dur = null;
				try {
					dur = await input.computeDuration();
				} catch {}
				if (typeof dur !== "number" || !isFinite(dur) || dur <= 0) {
					dur =
						typeof at.duration === "number" && isFinite(at.duration)
							? at.duration
							: 5;
				}
				audioInputs.push({ input, track: at, duration: dur });
				hasAudio = true;

				// 解碼整段音訊成單一 AudioBuffer
				if (AudioBufferSink) {
					try {
						const aSink = new AudioBufferSink(at);
						const collected = [];

						// 優先使用 buffers() 迭代器
						if (typeof aSink.buffers === "function") {
							for await (const wrapped of aSink.buffers(0, dur)) {
								const b = wrapped?.buffer || wrapped;
								if (
									b &&
									typeof b.getChannelData === "function" &&
									b.length > 0
								) {
									collected.push(b);
								}
							}
						} else {
							let lastEnd = 0;
							for (let t = 0; t < dur; t += 0.5) {
								const wrapped = await aSink.getBuffer(t);
								const b = wrapped?.buffer || wrapped;
								if (
									b &&
									typeof b.getChannelData === "function" &&
									b.length > 0
								) {
									const offsetSamples = Math.max(
										0,
										Math.floor(lastEnd * (b.sampleRate || 48000)),
									);
									if (offsetSamples < b.length) {
										const slice = new AudioBuffer({
											length: b.length - offsetSamples,
											numberOfChannels: b.numberOfChannels,
											sampleRate: b.sampleRate,
										});
										for (let c = 0; c < b.numberOfChannels; c++) {
											slice
												.getChannelData(c)
												.set(b.getChannelData(c).subarray(offsetSamples));
										}
										collected.push(slice);
									}
									lastEnd = t + b.duration;
								}
							}
						}

						if (collected.length) {
							// 合併成單一 AudioBuffer
							const totalLen = collected.reduce((s, b) => s + b.length, 0);
							const chCount = collected[0].numberOfChannels || 2;
							const rate = collected[0].sampleRate || 48000;
							const merged = new AudioBuffer({
								length: totalLen,
								numberOfChannels: chCount,
								sampleRate: rate,
							});
							let off = 0;
							for (const b of collected) {
								for (let c = 0; c < chCount; c++) {
									const srcCh = Math.min(c, b.numberOfChannels - 1);
									merged.getChannelData(c).set(b.getChannelData(srcCh), off);
								}
								off += b.length;
							}
							audioSources.push({
								input,
								buffer: merged,
								duration: merged.duration,
							});
						}
					} catch (err) {
						console.warn("[export] AudioBufferSink decode failed", err);
					}
				}
			}
		} catch (err) {}

		if (!hasVideo && !hasAudio) {
			try {
				input.dispose();
			} catch {}
		}
		return { hasVideo, hasAudio };
	};

	// object 來源
	for (let i = 0; i < objects.length; i++) {
		const obj = objects[i];
		if (!obj.mediaBlob || !obj.image || !obj.canvas?.width) continue;
		if (targetMode === "object" && i !== currentObjectIndex) continue;
		showExportLog(getText(_getCurrentLang(), "exportLogDecoding"));
		const r = await probeInput(obj.mediaBlob, i);
		if (r.hasVideo) indicesToRender.push(i);
	}

	// 背景影片
	if (targetMode === "all" && state.bgVideoBlob) {
		showExportLog(getText(_getCurrentLang(), "exportLogDecoding"));
		const r = await probeInput(state.bgVideoBlob, -1);
		if (r.hasVideo) indicesToRender.push(-1);
	}

	if (!videoTracks.length && !audioInputs.length && !audioSources.length) {
		showExportLog(getText(_getCurrentLang(), "exportLogNoTrack"), false);
		scheduleHideExportLog(3000);
		return;
	}

	const durations = [
		...videoTracks.map((t) => t.duration),
		...audioInputs.map((a) => a.duration),
		...audioSources.map((a) => a.duration),
	].filter((d) => typeof d === "number" && isFinite(d) && d > 0);

	const longestDur = durations.length ? Math.max(...durations) : 5;
	const duration = Math.min(maxDuration, longestDur);
	if (!isFinite(duration) || duration <= 0) {
		console.warn("[export] 無效時長");
		return;
	}

	const compCanvas = document.createElement("canvas");
	let cw, ch;
	if (targetMode === "object") {
		const curObj = objects[currentObjectIndex];
		const isBack =
			Math.abs(curObj.overlay.rotX || 0) > 90 ||
			Math.abs(curObj.overlay.rotY || 0) > 90;
		const srcCanvas =
			isBack && curObj.backCanvas?.width ? curObj.backCanvas : curObj.canvas;
		cw = Math.floor(srcCanvas.width / 2) * 2;
		ch = Math.floor(srcCanvas.height / 2) * 2;
	} else {
		cw = Math.floor(CANVAS_W / 2) * 2;
		ch = Math.floor(CANVAS_H / 2) * 2;
	}
	const MAX_W = 3840,
		MAX_H = 2160;
	const scaleDown = Math.min(1, MAX_W / cw, MAX_H / ch);
	if (scaleDown < 1) {
		cw = Math.floor((cw * scaleDown) / 2) * 2;
		ch = Math.floor((ch * scaleDown) / 2) * 2;
	}
	compCanvas.width = cw;
	compCanvas.height = ch;
	const cctx = compCanvas.getContext("2d", { willReadFrequently: true });
	// 初始化 WebGL 離線渲染器與compCanvas同尺寸
    initGLExportRenderer(cw, ch);

	const output = new Output({
		format: new Mp4OutputFormat(),
		target: new BufferTarget(),
	});

	let videoSource = null;
	// 強制從 DOM 讀取最新設定（避免 state 不同步）
	const settings = (() => {
		const wrapper = document.querySelector(".advanced-settings-wrapper");
		if (!wrapper) return state.exportSettings || {};
		const videoBitrateInput = wrapper.querySelector(".adv-video-bitrate");
		const audioBitrateInput = wrapper.querySelector(".adv-audio-bitrate");
		const fpsInput = wrapper.querySelector(".adv-fps");
		const videoCodecSelect = wrapper.querySelector(".adv-video-codec");
		const audioCodecSelect = wrapper.querySelector(".adv-audio-codec");
		const containerSelect = wrapper.querySelector(".adv-container");
		return {
			videoBitrate: videoBitrateInput ? parseInt(videoBitrateInput.value, 10) || 3000000 : (state.exportSettings?.videoBitrate || 3000000),
			audioBitrate: audioBitrateInput ? parseInt(audioBitrateInput.value, 10) || 128000 : (state.exportSettings?.audioBitrate || 128000),
			fps: fpsInput ? parseInt(fpsInput.value, 10) || 30 : (state.exportSettings?.fps || 30),
			videoCodec: videoCodecSelect ? videoCodecSelect.value : (state.exportSettings?.videoCodec || "avc"),
			audioCodec: audioCodecSelect ? audioCodecSelect.value : (state.exportSettings?.audioCodec || "aac"),
			container: containerSelect ? containerSelect.value : (state.exportSettings?.container || "mp4"),
		};
	})();
	if (videoTracks.length) {
		videoSource = new CanvasSource(compCanvas, {
			codec: settings.videoCodec || "avc",
			bitrate: settings.videoBitrate || 3_000_000,
			hardwareAcceleration: "no-preference",
		});
		output.addVideoTrack(videoSource, { frameRate: fps });
	}

	let audioMode = "none";
	let audioSourceObj = null;
	let mixBuf = null;

	if (audioSources.length && AudioBufferSource) {
		showExportLog(getText(_getCurrentLang(), "exportLogAudio"));
		try {
			const mixRate = 48000;
			const mixCh = 2;
			const totalSamples = Math.ceil(duration * mixRate);
			mixBuf = new AudioBuffer({
				length: totalSamples,
				numberOfChannels: mixCh,
				sampleRate: mixRate,
			});
			const mixData = [mixBuf.getChannelData(0), mixBuf.getChannelData(1)];

			for (const src of audioSources) {
				const b = src.buffer;
				if (!b || typeof b.getChannelData !== "function") continue;

				const rate = b.sampleRate || mixRate;
				const ratio = rate / mixRate;

				for (let c = 0; c < mixCh; c++) {
					const srcCh = Math.min(c, (b.numberOfChannels || 1) - 1);
					const srcData = b.getChannelData(srcCh);
					const n = Math.min(totalSamples, Math.floor(srcData.length / ratio));

					for (let i = 0; i < n; i++) {
						mixData[c][i] += srcData[Math.floor(i * ratio)] * 0.5;
					}
				}
			}

			// clamp 到 [-1, 1]
			for (let c = 0; c < mixCh; c++) {
				const d = mixData[c];
				for (let i = 0; i < d.length; i++) {
					if (d[i] > 1) d[i] = 1;
					else if (d[i] < -1) d[i] = -1;
				}
			}

			audioSourceObj = new AudioBufferSource({
				codec: settings.audioCodec || "aac",
				bitrate: settings.audioBitrate || 128_000,
			});
			output.addAudioTrack(audioSourceObj);
			audioMode = "reencode";
		} catch (err) {
			console.warn("[export] AAC 轉碼失敗，僅匯出影像", err);
			audioMode = "none";
			audioSourceObj = null;
			mixBuf = null;
		}
	}

	if (audioMode === "none" && (audioInputs.length || audioSources.length)) {
		console.warn("[export] 偵測到音訊來源，但無法轉碼，僅匯出影像");
	}

	await output.start();

	const frameDuration = 1 / fps;
	const totalFrames = Math.ceil(duration * fps);
	const hasVideoOut = !!videoSource;

	setBtnEncodingState(true);
	setMp4ExportLock(true);

	const backCanvasBackups = backupBackCanvasesForExport();

	const tmpCanvas = document.createElement("canvas");
	const tmpCtx = tmpCanvas.getContext("2d");
	const renderScale = compCanvas.width / CANVAS_W;

	const bgVideoEl = state.bgVideo;
	const bgVideoIsReal = !!bgVideoEl && bgVideoEl.readyState >= 2;

	let exportOk = false;

	try {
		if (audioSourceObj && mixBuf) {
			try {
				await audioSourceObj.add(mixBuf);
			} catch (err) {
				console.warn("[export] audio add 失敗", err);
			}
		}

		for (let i = 0; i < (hasVideoOut ? totalFrames : 0); i++) {
			const t = i * frameDuration;
			if (t >= duration) break;
			if (i % 30 === 0) {
				showExportLog(
					getText(_getCurrentLang(), "exportLogRendering", {
						current: i,
						total: totalFrames,
					}),
				);
			}

			let bgFrameCanvas = null;
			let bgFrameCtx = null;

			for (const tr of videoTracks) {
				if (tr.idx >= 0) {
					// object 影片
					const obj = objects[tr.idx];
					const trackDur = tr.duration > 0 ? tr.duration : 5;
					const localT = t % trackDur;
					const sample = await tr.sink.getSample(localT);
					if (!sample) {
						if (i === 0 || i === 30) {
							console.warn(`[frame ${i}] tr.idx=${tr.idx} sample is NULL`, {
								t,
								localT,
								trackDur,
							});
						}
						continue;
					}
					const sw = sample.displayWidth;
					const sh = sample.displayHeight;
					if (tmpCanvas.width !== sw || tmpCanvas.height !== sh) {
						tmpCanvas.width = sw;
						tmpCanvas.height = sh;
					} else {
						tmpCtx.clearRect(0, 0, sw, sh);
					}
					sample.draw(tmpCtx, 0, 0);
					sample.close();

					if (i === 0 || i === 30) {
						const cx = Math.floor(sw / 2);
						const cy = Math.floor(sh / 2);
						const d = tmpCtx.getImageData(cx, cy, 1, 1).data;
					}

					const prev = obj.image;
					obj.image = tmpCanvas;
					composeOverlay(false, tr.idx);
					obj.image = prev;

					if (i === 0 || i === 30) {
						if (obj.canvas && obj.canvas.width > 0) {
							const octx = obj.canvas.getContext("2d");
							const cx2 = Math.floor(obj.canvas.width / 2);
							const cy2 = Math.floor(obj.canvas.height / 2);
							const d2 = octx.getImageData(cx2, cy2, 1, 1).data;
						} else {
							console.warn(
								`[frame ${i}] tr.idx=${tr.idx} obj.canvas 寬度為 0`,
								obj.canvas?.width,
							);
						}
					}
				} else {
					// 背景影片
					const trackDur = tr.duration > 0 ? tr.duration : 5;
					const localT = t % trackDur;
					const sample = await tr.sink.getSample(localT);
					if (!sample) {
						if (i === 0 || i === 30) {
							console.warn(
								`[frame ${i}] 背景 tr.idx=${tr.idx} sample is NULL`,
								{ t, localT, trackDur },
							);
						}
						continue;
					}
					const sw = sample.displayWidth;
					const sh = sample.displayHeight;
					if (!bgFrameCanvas) {
						bgFrameCanvas = document.createElement("canvas");
						bgFrameCtx = bgFrameCanvas.getContext("2d");
					}
					if (bgFrameCanvas.width !== sw || bgFrameCanvas.height !== sh) {
						bgFrameCanvas.width = sw;
						bgFrameCanvas.height = sh;
					} else {
						bgFrameCtx.clearRect(0, 0, sw, sh);
					}
					sample.draw(bgFrameCtx, 0, 0);
					sample.close();

					if (i === 0 || i === 30) {
						const cx = Math.floor(sw / 2);
						const cy = Math.floor(sh / 2);
						const d = bgFrameCtx.getImageData(cx, cy, 1, 1).data;
					}
				}
			}
			if (targetMode === "all" && bgVideoIsReal) {
				try {
					if (Math.abs(bgVideoEl.currentTime - t) > 1 / fps) {
						await new Promise((res) => {
							const onSeeked = () => {
								bgVideoEl.removeEventListener("seeked", onSeeked);
								res();
							};
							bgVideoEl.addEventListener("seeked", onSeeked);
							bgVideoEl.currentTime = t;
							setTimeout(() => {
								bgVideoEl.removeEventListener("seeked", onSeeked);
								res();
							}, 500);
						});
					}
				} catch (err) {}
			}

			cctx.clearRect(0, 0, compCanvas.width, compCanvas.height);

			// 先畫背景 影片或圖片
			const bgImg = state.bgImageCropped || state.bgImage;
			if (targetMode === "all" && bgFrameCanvas) {
				const vw = bgFrameCanvas.width || 1;
				const vh = bgFrameCanvas.height || 1;
				const s = Math.max(compCanvas.width / vw, compCanvas.height / vh);
				const sw = compCanvas.width / s;
				const sh = compCanvas.height / s;
				const sx = (vw - sw) / 2;
				const sy = (vh - sh) / 2;
				cctx.drawImage(
					bgFrameCanvas,
					sx,
					sy,
					sw,
					sh,
					0,
					0,
					compCanvas.width,
					compCanvas.height,
				);
			} else if (bgImg) {
				const bgW = bgImg.width,
					bgH = bgImg.height;
				const s = Math.max(compCanvas.width / bgW, compCanvas.height / bgH);
				const sw = Math.min(Math.floor(compCanvas.width / s / 2) * 2, bgW);
				const sh = Math.min(Math.floor(compCanvas.height / s / 2) * 2, bgH);
				const sx = (bgW - sw) / 2;
				const sy = (bgH - sh) / 2;
				cctx.drawImage(
					bgImg,
					sx,
					sy,
					sw,
					sh,
					0,
					0,
					compCanvas.width,
					compCanvas.height,
				);
			} else {
				const isLight =
					document.documentElement.getAttribute("data-theme") === "light";
				cctx.fillStyle = isLight ? "#f4f5f7" : "#1a1a1a";
				cctx.fillRect(0, 0, compCanvas.width, compCanvas.height);
			}

			// 後畫 Object 圖片 確保疊加在背景上方
			if (targetMode === "object") {
				const obj = objects[currentObjectIndex];
				const isBack =
					Math.abs(obj.overlay.rotX || 0) > 90 ||
					Math.abs(obj.overlay.rotY || 0) > 90;
				const srcCanvas =
					isBack && obj.backCanvas && obj.backCanvas.width
						? obj.backCanvas
						: obj.canvas;

				cctx.fillStyle = "#000000";
				cctx.fillRect(0, 0, compCanvas.width, compCanvas.height);
				cctx.drawImage(srcCanvas, 0, 0, compCanvas.width, compCanvas.height);
			} else {
                // 判斷是否需要 WebGL 只要有任一物件有 3D 傾斜
                const any3D = objects.some(o =>
                    o.canvas?.width && (Math.abs(o.overlay.rotX || 0) > 0.01 || Math.abs(o.overlay.rotY || 0) > 0.01)
                );

                if (any3D && isGLAvailable()) {
                    for (let k = objects.length - 1; k >= 0; k--) {
                        const obj = objects[k];
                        if (!obj || !obj.canvas || obj.canvas.width <= 0) continue;

                        const isBack = Math.abs(obj.overlay.rotX || 0) > 90 || Math.abs(obj.overlay.rotY || 0) > 90;
                        const srcCanvas = (isBack && obj.backCanvas && obj.backCanvas.width)
                            ? obj.backCanvas
                            : obj.canvas;

                        uploadTexture(srcCanvas);

                        const displayW = CANVAS_W * 0.37 * obj.overlay.scale * renderScale;
                        const displayH = displayW * (srcCanvas.height / srcCanvas.width);
                        const fov = displayW * 7;

                        glDrawObject(
                            obj.overlay,
                            displayW, displayH, fov,
                            compCanvas.width, compCanvas.height
                        );
                    }
                } else {
                    // Canvas 2D 路徑
                    for (let k = objects.length - 1; k >= 0; k--) {
                        const obj = objects[k];
                        if (!obj || !obj.canvas || obj.canvas.width <= 0) continue;
                        drawObjectToCtx(cctx, obj, k, renderScale);
                    }
                }
            }

			if (i === 0) {
				const test = cctx.getImageData(
					0,
					0,
					compCanvas.width,
					compCanvas.height,
				).data;
				// 統計非黑、非透明像素
				let nonBlack = 0,
					nonTransparent = 0;
				for (let p = 0; p < test.length; p += 4) {
					if (test[p + 3] > 0) nonTransparent++;
					if (test[p] > 10 || test[p + 1] > 10 || test[p + 2] > 10) nonBlack++;
				}
			}
			
			if (targetMode === "all") {
				for (let k = objects.length - 1; k >= 0; k--) {
					const obj = objects[k];
					if (!obj || !obj.canvas || obj.canvas.width <= 0) continue;
					// 呼叫 export.js 內建的 drawObjectToCtx 進行 2D 繪製
					// 避免只算到背景而漏掉 Object
					drawObjectToCtx(cctx, obj, k, renderScale);
				}
			}

await videoSource.add(t, frameDuration);
		}

		showExportLog(getText(_getCurrentLang(), "exportLogFinalizing"));
		await output.finalize();
		exportOk = true;
	} catch (err) {
		console.error("exportObjectVideoFull error:", err);
		if (String(err).includes("not supported")) {
			console.warn("[export] 編碼器不支援，建議改用 WebM 格式或降低解析度");
		}
		showExportLog(getText(_getCurrentLang(), "exportLogFailed"), false);
		scheduleHideExportLog(3000);
		_showToast(
			getText(_getCurrentLang(), "exportFailed") || "Export failed",
			3000,
		);
	} finally {
		if (audioSourceObj && typeof audioSourceObj.close === "function") {
			try {
				audioSourceObj.close();
			} catch {}
		}

		restoreBackCanvasesAfterExport(backCanvasBackups);

		setBtnEncodingState(false);
		setMp4ExportLock(false);
		for (const tr of videoTracks) {
			try {
				tr.input.dispose();
			} catch {}
		}
		for (const a of audioInputs) {
			try {
				a.input.dispose();
			} catch {}
		}
		for (const a of audioSources) {
			try {
				a.input.dispose();
			} catch {}
		}
		if (bgVideoEl) {
			try {
				bgVideoEl.currentTime = 0;
				bgVideoEl.play();
			} catch {}
		}
	}

	if (!exportOk) return;

	const blob = new Blob([output.target.buffer], { type: "video/mp4" });
	if (!blob.size) {
		showExportLog(getText(_getCurrentLang(), "exportLogFailed"), false);
		scheduleHideExportLog(3000);
		_showToast(
			getText(_getCurrentLang(), "exportFailed") ||
				"Export failed: Unable to generate video",
			3000,
		);
		return;
	}

	const prefix = objects[currentObjectIndex].name || "object";
	const filename =
		targetMode === "object" ? `${prefix}_object.mp4` : `${prefix}_full.mp4`;

	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 20000);

	showExportLog(getText(_getCurrentLang(), "exportLogDone"), false);
	scheduleHideExportLog(2000);
}

let mp4Exporting = false;

let mp4LockOverlay = null;

let mp4ExportCancelled = false;

let exportLogTimer = null;

export function isMp4Exporting() {
	return mp4Exporting;
}

export {
	exportImage,
	exportObjectGifFull,
	exportObjectVideoFull,
	handleExportClick,
	hideExportLog,
	scheduleHideExportLog,
	shareImage,
	showExportLog,
};

window.exportObjectGifFull = exportObjectGifFull;
window.exportObjectVideoFull = exportObjectVideoFull;