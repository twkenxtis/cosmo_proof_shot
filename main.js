import {
	addBookmark,
	apolloFetch,
	clearAllLocalStorage,
	fetchArtistCollections,
	fetchUserObjekts,
	loadBookmarks,
	parseSlug,
} from "./api.js";
import { initBookmarks, renderBookmarks } from "./bookmarks.js";
import {
	applyCanvasSize,
	bgCtx,
	CANVAS_H,
	CANVAS_W,
	composeBackOverlay,
	composeOverlay,
	computeSnap,
	currentObjectIndex,
	getOverlaySize,
	getPointer,
	getTouchDistanceAndAngle,
	hasValidBackImage,
	hitTestHandle,
	initCanvas,
	objects,
	recomposeCurrent,
	render,
	resetOverlayPosition,
	scheduleDraw,
	setCurrentObjectIndex,
	getObjectCount,
	addObject,
	removeObject,
	MAX_OBJECTS,
	singleObject,
	state,
	syncTrashPos,
	TRASH_DELETE_RADIUS,
	TRASH_HIT_RADIUS,
	TRASH_POS,
	TRASH_RADIUS,
	scheduleDrawBg,
} from "./canvas.js";

import { layoutGrid, layoutCircle, layoutFan } from "./layoutTools.js";
import { initLayoutUI } from "./layoutUI.js";
import { initObjectSelector, refreshObjectSelectorUI } from "./objectSelector.js";
import { initTextInput, bindTextInputs } from "./textInput.js";
import { setupSyncInputs } from "./uiSync.js";
import { initCropRatio, updateCropButtons } from "./cropRatio.js";
import { bindAssistToggles } from "./assist.js";
import { initSettings, bindQrTextInputs, bindClearCacheButtons } from "./settings.js";
import { updateUploadButtonVisibility } from "./uploadButtonVisibility.js";

import { initClipboardPaste } from "./clipboardPaste.js";
import {
	applyCoordInputs,
	bindCoordInputs,
	initCoords,
	updateCoordDisplay,
} from "./coords.js";
import { handleExportClick, initExport, isMp4Exporting } from "./export.js";
import { applyTranslations, detectLang, getText, isMobile } from "./i18n.js";
import { initImageLoader, loadImage, loadImageCached } from "./imageLoader.js";
import {
	pauseAllObjectVideos,
	resumeAllObjectVideos,
	startObjectVideo,
	stopObjectVideo,
} from "./objectVideo.js";
import {
	bindObjektsPicker,
	initPicker,
	pickerClose,
	pickerOpen,
	pickerReset,
	pickerUpdateConfirmState,
} from "./picker.js";
import {
	BASE64_ANIM_LOADING,
	escapeHtml,
	getMemberColor,
	getSeasonColor,
	MEMBER_COLORS,
	MEMBER_ORDER,
	MEMBER_PREFIX,
	OBJEKTS_DATA_FALLBACK,
	PICKER_PAGE_SIZE,
	SEASON_COLORS,
	SLEEVE_DATA_URL,
} from "./static.js";
import { bindThemeToggle, initTheme } from "./theme.js";
import { initEmptyHint, updateEmptyHint } from "./emptyHint.js";
import { createAdvancedSettings } from "./advancedSettings.js";
const ui = {
	toolbar: document.getElementById("toolbar"),
	btnBgMobile: document.getElementById("btn-bg-mobile"),
	btnObjMobile: document.getElementById("btn-object-mobile"),
	objektsPicker: document.getElementById("objekts-picker"),
	pickerCollection: document.getElementById("picker-collection"),
	pickerMember: document.getElementById("picker-member"),
	pickerCode: document.getElementById("picker-code"),
	pickerCancel: document.getElementById("picker-cancel"),
	pickerConfirm: document.getElementById("picker-confirm"),
	btnResetObjBar: document.getElementById("btn-reset-object-mobile-bar"),
	btnExportBar: document.getElementById("export-btn-bar"),
	btnBgDesktop: document.getElementById("btn-bg-desktop"),
	btnObjDesktop: document.getElementById("btn-object-desktop"),
	bgCanvas: document.getElementById("bg-canvas"),
	uiCanvas: document.getElementById("ui-canvas"),
	canvas: document.getElementById("ui-canvas"), // 相容：事件與 getPointer 都用這個
	workspace: document.getElementById("workspace"),
	wrap: document.getElementById("canvas-wrap"),
	toast: document.getElementById("toast"),
	inputBg: document.getElementById("input-bg"),
	btnClearBg: document.getElementById("btn-clear-bg"),
	btnClearBgMobile: document.getElementById("btn-clear-bg-mobile"),
	btnResetObject: document.getElementById("btn-reset-object"),
	chkSleeve: document.getElementById("chk-sleeve"),
	chkSleeveMobile: document.getElementById("chk-sleeve-mobile"),
	inputText: document.getElementById("input-text"),
	inputText2: document.getElementById("input-text2"),
	inputText2Mobile: document.getElementById("input-text2-mobile"),
	inputTextMobile: document.getElementById("input-text-mobile"),
	inputQrText: document.getElementById("input-qr-text"),
	inputQrTextMobile: document.getElementById("input-qr-text-mobile"),
	selectFont: document.getElementById("select-font"),
	selectFontMobile: document.getElementById("select-font-mobile"),
	inputColor: document.getElementById("input-color"),
	inputColorMobile: document.getElementById("input-color-mobile"),
	selectTarget: document.getElementById("select-target"),
	selectTargetMobile: document.getElementById("select-target-mobile"),
	selectFormat: document.getElementById("select-format"),
	selectFormatMobile: document.getElementById("select-format-mobile"),
	btnExport: document.getElementById("export-btn"),
	btnShare: document.getElementById("share-btn"),
	btnShareMobile: document.getElementById("share-btn-mobile"),
	selectLang: document.getElementById("select-lang"),
	selectLangMobile: document.getElementById("select-lang-mobile"),
	btnResetAll: document.getElementById("reset-all-btn"),
	btnResetAllMobile: document.getElementById("reset-all-btn-mobile"),
	toolZoomIn: document.getElementById("tool-zoom-in"),
	toolZoomOut: document.getElementById("tool-zoom-out"),
	selectZoomRatio: document.getElementById("select-zoom-ratio"),
	inputUrlDesktop: document.getElementById("input-url-desktop"),
	btnFetchUrlDesktop: document.getElementById("btn-fetch-url-desktop"),
	inputUrlMobile: document.getElementById("input-url-mobile"),
	btnFetchUrlMobile: document.getElementById("btn-fetch-url-mobile"),
	desktopSidebar: document.getElementById("desktop-sidebar"),
	btnSidebarToggle: document.getElementById("btn-sidebar-toggle"),
	bookmarkSearch: document.getElementById("bookmark-search"),
	inputCoordX: document.getElementById("input-coord-x"),
	inputCoordY: document.getElementById("input-coord-y"),
	inputCoordZ: document.getElementById("input-coord-z"),
	inputCoordR: document.getElementById("input-coord-r"),
	inputCoordRx: document.getElementById("input-coord-rx"),
	inputCoordRy: document.getElementById("input-coord-ry"),
	chkUseText: document.getElementById("chk-usetext"),
	chkPlayVideo: document.getElementById("chk-play-video"),
	chkPlayVideoMobile: document.getElementById("chk-play-video-mobile"),
	chkUseTextMobile: document.getElementById("chk-usetext-mobile"),
	bookmarkSelectTop: document.getElementById("bookmark-select-top"),
	toolbarCloseMobile: document.getElementById("toolbar-close-mobile"),
	btnCropRatioMobile: document.getElementById("btn-crop-ratio-mobile"),
	btnCropRatioDesktop: document.getElementById("btn-crop-ratio-desktop"),

	objectSelectorDesktop: document.getElementById("object-selector-desktop"),
	objectSelectorMobile: document.getElementById("mobile-object-switch"),
	btnAddObjectDesktop: document.getElementById("btn-add-object-desktop"),
	btnAddObjectMobile: document.getElementById("btn-add-object-mobile"),
	btnRemoveObjectDesktop: document.getElementById("btn-remove-object-desktop"),
	btnRemoveObjectMobile: document.getElementById("btn-remove-object-mobile"),

	selectGrid: document.getElementById("select-grid"),
	selectGridMobile: document.getElementById("select-grid-mobile"),
	chkAlign: document.getElementById("chk-align"),
	chkAlignMobile: document.getElementById("chk-align-mobile"),
  btnLayoutLine: document.getElementById("btn-layout-line"),
  btnLayoutGrid: document.getElementById("btn-layout-grid"),
  btnLayoutCircle: document.getElementById("btn-layout-circle"),
  btnLayoutFan: document.getElementById("btn-layout-fan"),
  btnLayoutLineMobile: document.getElementById("btn-layout-line-mobile"),
  btnLayoutGridMobile: document.getElementById("btn-layout-grid-mobile"),
  btnLayoutCircleMobile: document.getElementById("btn-layout-circle-mobile"),
  btnLayoutFanMobile: document.getElementById("btn-layout-fan-mobile"),
};

function resizeCanvas() {
	const isM = isMobile;
	const rect = ui.workspace.getBoundingClientRect();

	let scale;

	if (isM) {
		const wrapRect = ui.wrap.getBoundingClientRect();

		const targetW = wrapRect.width || rect.width * 0.75;

		scale = targetW / CANVAS_W;
	} else {
		const availableW = Math.max(100, rect.width - 24);
		const availableH = Math.max(100, rect.height - 24);
		const baseScale = Math.min(availableW / CANVAS_W, availableH / CANVAS_H);
		scale =
			state.zoomMode === "fit"
				? baseScale
				: baseScale * parseFloat(state.zoomMode || 1);
	}

	const displayW = Math.floor(CANVAS_W * scale);
	const displayH = Math.floor(CANVAS_H * scale);

	ui.wrap.style.height = `${displayH}px`;

	ui.bgCanvas.style.width = "100%";
	ui.bgCanvas.style.height = "100%";
	ui.uiCanvas.style.width = "100%";
	ui.uiCanvas.style.height = "100%";
}

initCanvas(ui);

initTheme({
	getCurrentLang: () => currentLang,
});
bindThemeToggle();

initBookmarks({
	ui,
	onPick: handleFetchUrl,
});
renderBookmarks();
initCoords(ui);initCoords(ui);
bindCoordInputs();

// 等待 Mediabunny 載入
let mediabunnyReady = false;
window.addEventListener("mediabunny-ready", () => {
	mediabunnyReady = true;
	console.log(
		"Mediabunny 已載入，版本:",
		window.Mediabunny?.version || "unknown",
	);
});

if (window.Mediabunny) {
	mediabunnyReady = true;
}

let currentLang = detectLang();
if (ui.selectLang) ui.selectLang.value = currentLang;
if (ui.selectLangMobile) ui.selectLangMobile.value = currentLang;

let toastTimer = null;

function showToast(msg, duration = 1200) {
	ui.toast.textContent = msg;
	ui.toast.classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => ui.toast.classList.remove("show"), duration);
}

function initFormatOptions() {
	const formats = isMobile
		? [
				{
					val: "png",
					text: "PNG",
				},
				{
					val: "jpg",
					text: "JPG",
				},
				{
					val: "avif",
					text: "AVIF",
				},
				{
					val: "mp4",
					text: "Video 🎥",
				},
			]
		: [
				{
					val: "png",
					text: "PNG",
				},
				{
					val: "webp",
					text: "WebP",
				},
				{
					val: "jpg",
					text: "JPG",
				},
				{
					val: "mp4",
					text: "Video 🎥",
				},
				{
					val: "avif",
					text: "AVIF",
				},
				{
					val: "jxl",
					text: "JPEG XL",
				},
				{
					val: "gif",
					text: "GIF [⚠️Exptl.]",
				},
			];
	[ui.selectFormat, ui.selectFormatMobile].forEach((sel) => {
		if (!sel) return;
		sel.innerHTML = "";
		formats.forEach((f) => {
			const opt = document.createElement("option");
			opt.value = f.val;
			opt.textContent = f.text;
			sel.appendChild(opt);
		});
	});
}
initFormatOptions();

function bindUrlInputSelectAll(input) {
	if (!input) return;
	input.addEventListener("focus", () => {
		requestAnimationFrame(() => input.select());
	});
	input.addEventListener("mouseup", (e) => {
		e.preventDefault();
	});
}

[
	document.getElementById("input-url-desktop"),
	document.getElementById("input-url-top"),
	document.getElementById("input-url-mobile"),
].forEach(bindUrlInputSelectAll);

const MAX_BG_VIDEO_SEC = 600;

async function loadVideoBackground(file) {
	if (!file) return;
	showToast(getText(currentLang, "bgVideoLoading"));

	const url = URL.createObjectURL(file);
	const video = document.createElement("video");
	video.src = url;
	video.muted = true;
	video.loop = true;
	video.playsInline = true;

	// 等 metadata
	await new Promise((res) => {
		video.onloadedmetadata = () => res();
		video.onerror = () => res();
	});

	if (!video.videoWidth || !video.videoHeight) {
		showToast(getText(currentLang, "bgVideoUnsupported"));
		URL.revokeObjectURL(url);
		return;
	}

	if (isFinite(video.duration) && video.duration > MAX_BG_VIDEO_SEC + 0.5) {
		showToast(getText(currentLang, "bgVideoTooLong"));
		URL.revokeObjectURL(url);
		return;
	}

	// 停掉舊的背景影片
	if (state.bgVideo) {
		try {
			state.bgVideo.pause();
		} catch {}
		try {
			state.bgVideo.src = "";
		} catch {}
		state.bgVideo = null;
	}

	// 設定新背景影片
	state.bgVideo = video;
	state.bgVideoBlob = file;
	state.bgImage = null;
	state.bgImageCropped = null;
	state.bgName = (file.name || "video").replace(/\.[^/.]+$/, "");
	state.cropRatio = "none";

	ui.btnClearBg.disabled = false;
	if (ui.btnClearBgMobile) ui.btnClearBgMobile.disabled = false;

	applyCanvasSize();
	syncObjectControls();
	await video.play().catch(() => {});

	// 每幀重繪
	const tick = () => {
		if (state.bgVideo !== video) return;
		if (typeof scheduleDrawBg === 'function') scheduleDrawBg();
		else scheduleDraw();
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

if (ui.toolbarCloseMobile) {
	ui.toolbarCloseMobile.addEventListener("click", () => {
		ui.toolbar.classList.remove("open");
		const backdrop = document.getElementById("drawer-backdrop");
		if (backdrop) backdrop.classList.remove("show");
	});
}

async function handleFetchUrl(urlVal) {
	if (!urlVal) return;
	showToast(getText(currentLang, "fetchingUrl"));
	try {
		const data = await apolloFetch(urlVal);
		const WORKER = "https://little-cake-f3d5.ken8902026.workers.dev";

		let img = null;
		if (data.frontImage) {
			const proxied =
				WORKER + "/image?url=" + encodeURIComponent(data.frontImage);
			img = await loadImageCached(proxied, true);
		}
		if (!img) throw new Error("image load failed");

		const idx = currentObjectIndex;
		const wasEmpty = !objects[idx].image;

		objects[idx].image = img;
		objects[idx].frontImage = img;
		objects[idx].mediaBlob = data.mediaBlob || null;
		if (objects[idx].playVideo === undefined) objects[idx].playVideo = true;
		if (data.mediaBlob && objects[idx].playVideo) {
			objects[idx].videoMode = true;
			startObjectVideo(idx, data.mediaBlob);
		} else {
			objects[idx].videoMode = false;
			stopObjectVideo(idx);
			if (data.mediaBlob) objects[idx]._savedMediaBlob = data.mediaBlob;
		}
		objects[idx].name = data.slug || "apollo";
		// 成員名（小寫，來自 parseSlug）：顯示時再由 MEMBER_ORDER 轉官方大小寫
		const _parsedForMember = parseSlug(data.slug || '');
		objects[idx].member = (_parsedForMember && _parsedForMember.member) || '';
		objects[idx].member2 = (_parsedForMember && _parsedForMember.member2) || '';
		objects[idx].code = (_parsedForMember && _parsedForMember.code) || '';
		objects[idx].artist = data.artist || "";
		objects[idx].collection = data.collection || data.collectionId || "";
		objects[idx].backgroundColor = data.backgroundColor || "";
		objects[idx].visible = true;

		if (data.textColor) objects[idx].color = data.textColor;

		if (data.collectionId && data.slug) {
			const match = data.slug.match(/([0-9]{3}[a-z])/i);
			if (match) {
				const matchedStr = match[1];
				if (
					data.collectionId.toLowerCase().includes(matchedStr.toLowerCase())
				) {
					objects[idx].text = matchedStr.toUpperCase();
				}
			}
		}

		let backImg = null;
		if (
			data.backImage &&
			typeof data.backImage === "string" &&
			data.backImage.startsWith("https://imagedelivery.net")
		) {
			const proxiedBack =
				WORKER + "/image?url=" + encodeURIComponent(data.backImage);
			backImg = await loadImageCached(proxiedBack, true);
		}
		objects[idx].backImage = backImg;

		addBookmark(data.slug || urlVal.trim());
		renderBookmarks();
		syncObjectControls();
		composeOverlay(true, idx);
		composeBackOverlay(false, idx);
		updateCoordDisplay();
		updateUploadButtonVisibility(ui);

		// 自動補一格空 object（若未達上限且當前是最後一格）
		try {
			if (objects.length < MAX_OBJECTS && idx === objects.length - 1) {
				const _res = addObject();
				if (_res && _res.ok !== false) {
					refreshObjectSelectorUI();
				}
			}
		} catch (_e) {
			console.warn("auto addObject failed", _e);
		}
	} catch (err) {
		console.error(err);
		showToast(getText(currentLang, "fetchFailed"));
	}
}

function syncObjectControls() {
	const hasImg = !!singleObject.image;
	if (ui.inputCoordX) {
		ui.inputCoordX.disabled = !hasImg;
		ui.inputCoordY.disabled = !hasImg;
		ui.inputCoordZ.disabled = !hasImg;
		ui.inputCoordR.disabled = !hasImg;
		if (ui.inputCoordRx) ui.inputCoordRx.disabled = !hasImg;
		if (ui.inputCoordRy) ui.inputCoordRy.disabled = !hasImg;
	}
	ui.btnResetObject.disabled = !hasImg;
	if (ui.btnResetObjBar) ui.btnResetObjBar.disabled = !hasImg;

	ui.chkSleeve.checked = singleObject.useSleeve;
	ui.chkSleeveMobile.checked = singleObject.useSleeve;

	ui.inputText.value = singleObject.text;
	ui.inputTextMobile.value = singleObject.text;
	ui.inputText2.value = singleObject.text2;
	ui.inputText2Mobile.value = singleObject.text2;

	ui.selectFont.value = singleObject.font;
	ui.selectFontMobile.value = singleObject.font;

	ui.inputColor.value = singleObject.color;
	ui.inputColorMobile.value = singleObject.color;

	const _curUseText = singleObject.useText !== undefined ? singleObject.useText : true;
	if (ui.chkUseText) ui.chkUseText.checked = _curUseText;
	if (ui.chkUseTextMobile) ui.chkUseTextMobile.checked = _curUseText;

	const _curPlayVideo = singleObject.playVideo !== undefined ? singleObject.playVideo : true;
	if (ui.chkPlayVideo) ui.chkPlayVideo.checked = _curPlayVideo;
	if (ui.chkPlayVideoMobile) ui.chkPlayVideoMobile.checked = _curPlayVideo;
	refreshObjectSelectorUI();
	updateEmptyHint();
}

state.drag.active = false;
state.drag.scale = false;
state.drag.rotate = false;
state.drag.tilt = false;
state.drag.tiltAxis = null;
	state.drag.isTiltMode = false;
	state.drag.scaleLocked = 0;
state.drag.tiltSign = 1;
state.drag.startRotX = 0;
state.drag.startRotY = 0;

function selectObject(idx) {
	state.drag.active = false;
	state.drag.scale = false;
	state.drag.rotate = false;
	state.pinch.active = false;
	setCurrentObjectIndex(idx);
	state.selectedIndex = idx;
	state.alignGuides = [];
	syncObjectControls();
	refreshObjectSelectorUI();
	updateCoordDisplay();
	scheduleDraw();
}


let spacePanning = false;

function isTypingTarget(el) {
	if (!el) return false;
	const tag = el.tagName;
	return (
		tag === "INPUT" ||
		tag === "TEXTAREA" ||
		tag === "SELECT" ||
		el.isContentEditable
	);
}

if (!isMobile) {
	window.addEventListener("keydown", (e) => {
		if (isMp4Exporting()) return;
		if (e.code !== "Space" && e.key !== " ") return;
		if (isTypingTarget(document.activeElement)) return;
		if (e.repeat) return;
		e.preventDefault();
		spacePanning = true;
		ui.workspace.style.cursor = "grab";
	});

	window.addEventListener("keyup", (e) => {
		if (e.code !== "Space" && e.key !== " ") return;
		if (isTypingTarget(document.activeElement)) return;
		spacePanning = false;
		state.pan.active = false;
		ui.workspace.style.cursor = "";
	});

	window.addEventListener("blur", () => {
		spacePanning = false;
		state.pan.active = false;
		ui.workspace.style.cursor = "";
	});
}

if (!isMobile && ui.selectZoomRatio) {
	ui.selectZoomRatio.addEventListener("change", (e) => {
		state.zoomMode = e.target.value;
		resizeCanvas();
	});
}

const btnOpenToolbar = document.getElementById("btn-open-toolbar");
if (btnOpenToolbar) {
	btnOpenToolbar.addEventListener("click", () => {
		const isOpen = ui.toolbar.classList.toggle("open");
		btnOpenToolbar.setAttribute("aria-expanded", isOpen ? "true" : "false");
		const backdrop = document.getElementById("drawer-backdrop");
		if (backdrop) {
			backdrop.classList.toggle("show", isOpen);
		}
		if (isOpen) pickerClose();
	});
}

ui.workspace.addEventListener(
	"pointerdown",
	(e) => {
		if (!isMobile || !ui.toolbar.classList.contains("open")) return;
		if (ui.toolbar.contains(e.target)) return;
		ui.toolbar.classList.remove("open");
		const backdrop = document.getElementById("drawer-backdrop");
		if (backdrop) backdrop.classList.remove("show");
	},
	{
		passive: true,
	},
);

const drawerBackdrop = document.getElementById("drawer-backdrop");
document.addEventListener(
	"pointerdown",
	(e) => {
		if (!isMobile) return;

		const pickerOpenNow =
			ui.objektsPicker && ui.objektsPicker.classList.contains("open");
		const toolbarOpenNow = ui.toolbar && ui.toolbar.classList.contains("open");
		if (!pickerOpenNow && !toolbarOpenNow) return;

		if (
			pickerOpenNow &&
			(ui.objektsPicker === e.target || ui.objektsPicker.contains(e.target))
		)
			return;
		if (
			toolbarOpenNow &&
			(ui.toolbar === e.target || ui.toolbar.contains(e.target))
		)
			return;

		if (
			e.target.closest("#btn-object-mobile") ||
			e.target.closest("#btn-open-toolbar")
		)
			return;

		if (pickerOpenNow) pickerClose();
		if (toolbarOpenNow) {
			ui.toolbar.classList.remove("open");
			const bd = document.getElementById("drawer-backdrop");
			if (bd) bd.classList.remove("show");
		}
	},
	true,
);
if (drawerBackdrop) {
	drawerBackdrop.addEventListener("click", () => {
		if (ui.toolbar) ui.toolbar.classList.remove("open");
		if (ui.objektsPicker && ui.objektsPicker.classList.contains("open")) {
			pickerClose();
		}

		drawerBackdrop.classList.remove("show");
	});
}

if (ui.bookmarkSearch) {
	ui.bookmarkSearch.addEventListener("input", () => renderBookmarks());
}

ui.workspace.addEventListener("dragover", (e) => {
	e.preventDefault();
	ui.workspace.classList.add("drag-over");
});
ui.workspace.addEventListener("dragleave", (e) => {
	e.preventDefault();
	ui.workspace.classList.remove("drag-over");
});
ui.workspace.addEventListener("drop", async (e) => {
	e.preventDefault();
	ui.workspace.classList.remove("drag-over");
	const file = e.dataTransfer.files[0];
	if (!file) return;

	const isVideo =
		file.type.startsWith("video/") ||
		/\.(mp4|mov|mkv|ts|webm|m4v)$/i.test(file.name);

	if (isVideo) {
		await loadVideoBackground(file);
		return;
	}

	if (file.type.startsWith("image/")) {
		if (state.bgVideo) {
			try {
				state.bgVideo.pause();
			} catch {}
			try {
				state.bgVideo.src = "";
			} catch {}
			state.bgVideo = null;
		}
		const img = await loadImage(file, false);
		if (!img) return;
		state.bgImage = img;
		state.bgName = file.name.replace(/\.[^/.]+$/, "");
		ui.btnClearBg.disabled = false;
		if (ui.btnClearBgMobile) ui.btnClearBgMobile.disabled = false;
		applyCanvasSize();
		syncObjectControls();
		updateUploadButtonVisibility(ui);
	}
});

if (ui.btnSidebarToggle && ui.desktopSidebar) {
	ui.btnSidebarToggle.addEventListener("click", () => {
		const isCollapsed = ui.desktopSidebar.classList.toggle("collapsed");
		ui.btnSidebarToggle.innerHTML = isCollapsed
			? '<i class="ti ti-chevron-right"></i>'
			: '<i class="ti ti-chevron-left"></i>';
		if (isCollapsed) pickerClose();
	});
}

const triggerBgUpload = () => ui.inputBg.click();
if (isMobile) {
	ui.btnBgMobile.addEventListener("click", triggerBgUpload);
} else {
	ui.btnBgDesktop.addEventListener("click", triggerBgUpload);
}

ui.inputBg.setAttribute(
	"accept",
	"image/*,video/mp4,video/quicktime,video/x-matroska,video/mp2t,video/webm,video/x-m4v,.mkv,.ts,.mov,.m4v",
);
ui.inputBg.addEventListener("change", async (e) => {
	const file = e.target.files[0];
	if (!file) {
		e.target.value = "";
		return;
	}

	const isVideo =
		file.type.startsWith("video/") ||
		/\.(mp4|mov|mkv|ts|webm|m4v)$/i.test(file.name);

	if (isVideo) {
		await loadVideoBackground(file);
	} else {
		// 切回圖片時, 先停掉背景影片
		if (state.bgVideo) {
			try {
				state.bgVideo.pause();
			} catch {}
			try {
				state.bgVideo.src = "";
			} catch {}
			state.bgVideo = null;
			state.bgVideoBlob = null;
		}

		const img = await loadImage(file, false);
		if (!img) {
			e.target.value = "";
			return;
		}

		state.bgImage = img;
		state.bgName = file.name.replace(/\.[^/.]+$/, "");
		ui.btnClearBg.disabled = false;
		if (ui.btnClearBgMobile) ui.btnClearBgMobile.disabled = false;
		state.cropRatio = "none";
		applyCanvasSize();
		syncObjectControls();
		updateUploadButtonVisibility(ui);
	}
	e.target.value = "";
});

const clearBgHandler = () => {
	if (state.bgVideo) {
		try {
			state.bgVideo.pause();
		} catch {}
		try {
			state.bgVideo.src = "";
		} catch {}
		state.bgVideo = null;
	}
	state.bgVideoBlob = null;

	state.bgImage = null;
	state.bgImageCropped = null;
	state.bgName = "";
	state.cropRatio = "none";
	ui.btnClearBg.disabled = true;
	if (ui.btnClearBgMobile) ui.btnClearBgMobile.disabled = true;
	applyCanvasSize();
	syncObjectControls();
	updateCropButtons();
};
ui.btnClearBg.addEventListener("click", clearBgHandler);
if (ui.btnClearBgMobile)
	ui.btnClearBgMobile.addEventListener("click", clearBgHandler);

ui.btnFetchUrlDesktop.addEventListener("click", () =>
	handleFetchUrl(ui.inputUrlDesktop.value),
);
ui.btnFetchUrlMobile.addEventListener("click", () =>
	handleFetchUrl(ui.inputUrlMobile.value),
);
// 綁定頂部 AppBar 的新網址輸入框
const inputUrlTop = document.getElementById("input-url-top");
const btnFetchUrlTop = document.getElementById("btn-fetch-url-top");
if (btnFetchUrlTop && inputUrlTop) {
	btnFetchUrlTop.addEventListener("click", () => {
		handleFetchUrl(inputUrlTop.value);
	});
	inputUrlTop.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			handleFetchUrl(inputUrlTop.value);
			inputUrlTop.blur();
		}
	});
}

const btnReset3d = document.getElementById("btn-reset-3d");
if (btnReset3d) {
	btnReset3d.addEventListener("click", () => {
		singleObject.overlay.rotX = 0;
		singleObject.overlay.rotY = 0;
		scheduleDraw();
		updateCoordDisplay();
	});
}

const resetObjectHandler = () => {
	resetOverlayPosition(currentObjectIndex);
	updateCoordDisplay();
	scheduleDraw();
};

ui.btnResetObject.addEventListener("click", resetObjectHandler);
if (ui.btnResetObjBar)
	ui.btnResetObjBar.addEventListener("click", resetObjectHandler);

const sleeveChangeHandler = (checked) => {
	ui.chkSleeve.checked = checked;
	ui.chkSleeveMobile.checked = checked;
	singleObject.useSleeve = checked;
	recomposeCurrent();
};
const useTextChangeHandler = (checked) => {
	const obj = objects[currentObjectIndex];
	if (obj) obj.useText = checked;
	if (ui.chkUseText) ui.chkUseText.checked = checked;
	if (ui.chkUseTextMobile) ui.chkUseTextMobile.checked = checked;
	recomposeCurrent();
};
if (ui.chkUseText)
	ui.chkUseText.addEventListener("change", (e) =>
		useTextChangeHandler(e.target.checked),
	);
if (ui.chkUseTextMobile)
	ui.chkUseTextMobile.addEventListener("change", (e) =>
		useTextChangeHandler(e.target.checked),
	);

const playVideoChangeHandler = (checked) => {
	const obj = objects[currentObjectIndex];
	if (!obj) return;

	obj.playVideo = !!checked;

	if (!checked) {
		// 切到圖片 mode
		stopObjectVideo(currentObjectIndex);
		obj.videoMode = false;

		// 暫存影片 blob（只暫存一次，避免覆蓋）
		if (obj.mediaBlob && !obj._savedMediaBlob) {
			obj._savedMediaBlob = obj.mediaBlob;
		}
		obj.mediaBlob = null;

		// 還原正面圖（若有存 frontImage）
		if (obj.frontImage) obj.image = obj.frontImage;

		composeOverlay(false, currentObjectIndex);
		composeBackOverlay(false, currentObjectIndex);
	} else {
		// 切到影片 mode
		if (obj._savedMediaBlob) {
			obj.mediaBlob = obj._savedMediaBlob;
			obj._savedMediaBlob = null;
		}
		if (obj.mediaBlob) {
			obj.videoMode = true;
			startObjectVideo(currentObjectIndex, obj.mediaBlob);
		} else {
			obj.videoMode = false;
		}
	}

	scheduleDraw();
	updateCoordDisplay();
};
if (ui.chkPlayVideo)
	ui.chkPlayVideo.addEventListener("change", (e) =>
		playVideoChangeHandler(e.target.checked),
	);
if (ui.chkPlayVideoMobile)
	ui.chkPlayVideoMobile.addEventListener("change", (e) =>
		playVideoChangeHandler(e.target.checked),
	);
ui.chkSleeve.addEventListener("change", (e) =>
	sleeveChangeHandler(e.target.checked),
);
ui.chkSleeveMobile.addEventListener("change", (e) =>
	sleeveChangeHandler(e.target.checked),
);

let textDebounce = null;

const resetAllHandler = () => {
	if (state.bgVideo) {
		try {
			state.bgVideo.pause();
		} catch {}
		try {
			state.bgVideo.src = "";
		} catch {}
		state.bgVideo = null;
	}
	state.bgVideoBlob = null;

	state.bgImage = null;
	state.bgName = "";
	state.zoomMode = "fit";
	if (ui.selectZoomRatio) ui.selectZoomRatio.value = "fit";

	for (let i = 0; i < objects.length; i++) {
		stopObjectVideo(i);
		const o = objects[i];
		o.useText = true;
		o.playVideo = true;
		o.videoMode = false;
		o._savedMediaBlob = null;
		o.image = null;
		o.backImage = null;
		o.mediaBlob = null;
		o.canvas.width = 0;
		if (o.backCanvas) o.backCanvas.width = 0;
		o.name = "";
		o.member = "";
		o.member2 = "";
		o.code = "";
		o.artist = "";
		o.collection = "";
		o.backgroundColor = "";
		o.useSleeve = true;
		o.text = "000A";
		o.text2 = "000000";
		o.font = "Inter";
		o.color = "#ffffff";
		o.overlay.x = CANVAS_W / 2;
		o.overlay.y = CANVAS_H / 2;
		o.overlay.scale = 1;
		o.overlay.rotation = 0;
		o.visible = false;
		o.overlay.rotX = 0;
		o.overlay.rotY = 0;
	}
	state.useText = true;
	if (ui.chkUseText) ui.chkUseText.checked = true;
	if (ui.chkUseTextMobile) ui.chkUseTextMobile.checked = true;

	// 重置時把 object 數量縮回 1 個
	while (objects.length > 1) {
		const last = objects.length - 1;
		stopObjectVideo(last);
		objects.pop();
	}
	setCurrentObjectIndex(0);
	state.selectedIndex = 0;
	state.alignGuides = [];

	ui.inputBg.value = "";
	if (ui.inputUrlDesktop) ui.inputUrlDesktop.value = "";
	if (ui.inputUrlMobile) ui.inputUrlMobile.value = "";
	ui.btnClearBg.disabled = true;
	if (ui.btnClearBgMobile) ui.btnClearBgMobile.disabled = true;
	ui.btnResetObject.disabled = true;
	if (ui.btnResetObjBar) ui.btnResetObjBar.disabled = true;
	syncObjectControls();
	refreshObjectSelectorUI();
	applyCanvasSize();
	updateCoordDisplay();
};
ui.btnResetAll.addEventListener("click", resetAllHandler);
if (ui.btnResetAllMobile)
	ui.btnResetAllMobile.addEventListener("click", resetAllHandler);

window.addEventListener("keydown", (e) => {
	if (isMp4Exporting()) return;
	if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName))
		return;
	if (e.key === "Delete" && state.selectedIndex >= 0) {
		state.isDeletingObject = true;
		const idx = currentObjectIndex;
		objects[idx].image = null;
		objects[idx].mediaBlob = null;
		objects[idx].canvas.width = 0;
		objects[idx].visible = false;
		objects[idx].name = "";
		objects[idx].playVideo = true;
		objects[idx].videoMode = false;
		objects[idx]._savedMediaBlob = null;
		objects[idx].member = "";
		objects[idx].member2 = "";
		objects[idx].code = "";
		objects[idx].artist = "";
		objects[idx].collection = "";
		objects[idx].backgroundColor = "";
		stopObjectVideo(idx);
		syncObjectControls();
		scheduleDraw();
		updateCoordDisplay();
		// 額外清「自動補的那格空格」（最後一格，非當前格，且為空）
		if (state.isDeletingObject && objects.length > 1) {
			let _autoIdx = objects.length - 1;
			if (_autoIdx === currentObjectIndex && objects.length > 2) {
				_autoIdx = objects.length - 2;
			}
			if (_autoIdx !== currentObjectIndex) {
				const _autoObj = objects[_autoIdx];
				const _autoEmpty = _autoObj && !_autoObj.image && !_autoObj.mediaBlob &&
					(!_autoObj.canvas || _autoObj.canvas.width === 0);
				if (_autoEmpty) {
					removeObject(_autoIdx);
					setCurrentObjectIndex(Math.min(currentObjectIndex, objects.length - 1));
					refreshObjectSelectorUI();
					syncObjectControls();
					updateCoordDisplay();
					scheduleDraw();
				}
			}
		}
			state.isDeletingObject = false;
	}
});

function onPointerDown(e) {
	if (isMp4Exporting()) {
		e.preventDefault();
		return;
	}
	// 若點擊的是 Object 按鈕選單中的，直接 return，不呼叫 preventDefault
	// 讓瀏覽器原生的 HTML5 drag & drop 機制接管
	if (e.target && e.target.closest && e.target.closest(".obj-sel-btn")) {
		return;
	}
	if (e.target && e.target.closest && e.target.closest(".object-selector-desktop")) {
		return;
	}

	// 若點擊的是 Object 按鈕選單中的，不要進入畫布拖曳邏輯

	state.drag.active = false;
	state.drag.scale = false;
	state.drag.rotate = false;
	state.drag.tilt = false;
	state.drag.tiltAxis = null;
	state.drag.startRotX = 0;
	state.drag.startRotY = 0;
	state.drag.startIsBack = false;
	state.drag.startScale = singleObject.overlay.scale;
	state.drag.isTiltMode = false;
	state.drag.scaleLocked = 0;
	state.drag.startDist = 0;
	state.drag.startDist = 0;

	if (!isMobile && spacePanning) {
		e.preventDefault();
		state.pan.active = true;
		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const clientY = e.touches ? e.touches[0].clientY : e.clientY;
		state.pan.startX = clientX;
		state.pan.startY = clientY;
		state.pan.scrollLeft = ui.workspace.scrollLeft;
		state.pan.scrollTop = ui.workspace.scrollTop;
		ui.workspace.style.cursor = "grabbing";
		return;
	}

	if (e.detail === 2 && state.selectedIndex >= 0) {
		singleObject.overlay.rotX = 0;
		singleObject.overlay.rotY = 0;
		scheduleDraw();
		updateCoordDisplay();
		return;
	}
	if (state.activeTool === "zoom-in" || state.activeTool === "zoom-out") {
		e.preventDefault();
		const currentRatio =
			state.zoomMode === "fit" ? 1.0 : parseFloat(state.zoomMode);
		const steps = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
		if (state.activeTool === "zoom-in") {
			let next = steps.find((s) => s > currentRatio);
			if (!next) next = steps[steps.length - 1];
			state.zoomMode = next.toString();
		} else {
			let next = [...steps].reverse().find((s) => s < currentRatio);
			if (!next) next = steps[0];
			state.zoomMode = next.toString();
		}
		if (ui.selectZoomRatio) ui.selectZoomRatio.value = state.zoomMode;
		resizeCanvas();
		return;
	}

	if (state.activeTool === "pan") {
		if (isMobile) return;
		e.preventDefault();
		state.pan.active = true;
		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const clientY = e.touches ? e.touches[0].clientY : e.clientY;
		state.pan.startX = clientX;
		state.pan.startY = clientY;
		state.pan.scrollLeft = ui.workspace.scrollLeft;
		state.pan.scrollTop = ui.workspace.scrollTop;
		return;
	}

	if (e.touches && e.touches.length === 2 && state.selectedIndex >= 0) {
		e.preventDefault();
		ui.canvas.style.touchAction = "none";
		state.pinch.active = true;
		state.drag.active = false;
		state.pan.active = false;

		const { dist, angle } = getTouchDistanceAndAngle(e);
		state.pinch.startDist = dist;
		state.pinch.startAngle = angle;
		state.pinch.initialScale = singleObject.overlay.scale;
		state.pinch.initialRotation = singleObject.overlay.rotation;
		if (bgCtx) bgCtx.imageSmoothingQuality = "low";
		scheduleDraw();
		return;
	}

	const pos = getPointer(e);

	const handle = hitTestHandle(pos.x, pos.y);
	if (handle) {
		if (state.selectedIndex < 0) {
			let best = -1;
			let bestDist = Infinity;
			for (let i = 0; i < objects.length; i++) {
				const o = objects[i];
				if (!o.canvas.width) continue;
				const d = Math.hypot(pos.x - o.overlay.x, pos.y - o.overlay.y);
				if (d < bestDist) {
					bestDist = d;
					best = i;
				}
			}
			if (best >= 0) selectObject(best);
		}

		e.preventDefault();
		ui.canvas.style.touchAction = "none";

		if (handle === "rotate" || handle === "rotateBottom") {
			state.drag.rotate = true;
			state.drag.startAngle = Math.atan2(
				pos.y - singleObject.overlay.y,
				pos.x - singleObject.overlay.x,
			);
		} else if (
			handle === "tiltTop" ||
			handle === "tiltBottom" ||
			handle === "tiltLeft" ||
			handle === "tiltRight"
		) {
			state.drag.tilt = true;
			state.drag.tiltAxis =
		state.drag.isTiltMode = true;
		state.drag.scaleLocked = singleObject.overlay.scale;
				handle === "tiltTop" || handle === "tiltBottom" ? "x" : "y";
			state.drag.startX = pos.x;
			state.drag.startY = pos.y;
			state.drag.startRotX = singleObject.overlay.rotX || 0;
			state.drag.startRotY = singleObject.overlay.rotY || 0;
			state.drag.startIsBack =
				Math.abs(singleObject.overlay.rotX || 0) >= 90 ||
				Math.abs(singleObject.overlay.rotY || 0) >= 90;
		} else {
			// 角點縮放
			const dx0 = pos.x - singleObject.overlay.x;
			const dy0 = pos.y - singleObject.overlay.y;
			const dist0 = Math.hypot(dx0, dy0);
			// 防護按下點太接近物件中心，不進入縮放模式避免 factor 爆大
			const startScale = state.drag.startScale || 1;
        const scaleDrift = Math.abs(singleObject.overlay.scale - startScale);
        if (dist0 > 10 && scaleDrift < 0.5) {
				state.drag.scale = true;
				state.drag.startX = pos.x;
				state.drag.startY = pos.y;
				state.drag.startScale = singleObject.overlay.scale;
	state.drag.startDist = 0;
	state.drag.startDist = 0;
				state.drag.startDist = Math.hypot(pos.x - singleObject.overlay.x, pos.y - singleObject.overlay.y);
			}
		}
		if (bgCtx) bgCtx.imageSmoothingQuality = "low";
		scheduleDraw();
		return;
	}

	let hitIdx = -1;
	
	// 優先權 1 如果當前有選中的 Object，先檢查點擊點是否落在它身上
	// 這確保了在選單中選中的 Object 即使被遮擋，也能被優先拖曳
	// 選單選中的 Object 優先不管圖層
	if (state.selectedIndex >= 0) {
		const i = state.selectedIndex;
		const obj = objects[i];
		if (obj && obj.canvas.width && obj.image) {
			const dx = pos.x - obj.overlay.x;
			const dy = pos.y - obj.overlay.y;
			const angle = (-obj.overlay.rotation * Math.PI) / 180;
			const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
			const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
			const { w, h } = getOverlaySize(i);
			if (Math.abs(lx) < w / 2 && Math.abs(ly) < h / 2) {
				hitIdx = i;
			}
		}
	}

	// 優先權 2 如果優先權 1 沒點到，再根據圖層順序像素拾取從上到下找
	if (hitIdx === -1) {
		// 從最上層index 0往下找，確保點擊時優先選中視覺上最上面的 Object
		for (let i = 0; i < objects.length; i++) {
			const obj = objects[i];
			if (!obj.canvas.width || !obj.image) continue;
			const dx = pos.x - obj.overlay.x;
			const dy = pos.y - obj.overlay.y;
			const angle = (-obj.overlay.rotation * Math.PI) / 180;
			const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
			const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
			const { w, h } = getOverlaySize(i);
			if (Math.abs(lx) < w / 2 && Math.abs(ly) < h / 2) {
				hitIdx = i;
				break;
			}
		}
	}

	if (hitIdx >= 0) {
		e.preventDefault();
		ui.canvas.style.touchAction = "none";

		if (hitIdx !== currentObjectIndex) selectObject(hitIdx);
		state.selectedIndex = hitIdx;
		state.drag.active = true;
		state.drag.startX = pos.x - objects[hitIdx].overlay.x;
		state.drag.startY = pos.y - objects[hitIdx].overlay.y;
		if (bgCtx) bgCtx.imageSmoothingQuality = "low";
	} else {
		state.selectedIndex = -1;
		state.alignGuides = [];

		ui.canvas.style.touchAction = "pan-y";

		const isCtrlPressed = e.ctrlKey || e.metaKey;
		if (isCtrlPressed) {
			e.preventDefault();
			state.pan.active = true;
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;
			state.pan.startX = clientX;
			state.pan.startY = clientY;
			state.pan.scrollLeft = ui.workspace.scrollLeft;
			state.pan.scrollTop = ui.workspace.scrollTop;
		}
	}
	scheduleDraw();
}

const MAX_TILT_DEG = 180;
function clampTilt(v) {
	let n = ((((v + 180) % 360) + 360) % 360) - 180;
	return n;
}

function onPointerMove(e) {
	if (
		!state.drag.active &&
		!state.drag.scale &&
		!state.drag.rotate &&
		!state.drag.tilt &&
		!state.pan.active &&
		!state.pinch.active
	) {
		return;
	}

	if (isMp4Exporting()) {
		e.preventDefault();
		return;
	}

	if (
		state.pinch.active &&
		e.touches &&
		e.touches.length === 2 &&
		state.selectedIndex >= 0
	) {
		e.preventDefault();
		const { dist, angle } = getTouchDistanceAndAngle(e);
		const scaleFactor = dist / state.pinch.startDist;
		singleObject.overlay.scale = Math.max(
			0.1,
			Math.min(8, state.pinch.initialScale * scaleFactor),
		);

		const angleDiff = angle - state.pinch.startAngle;
		singleObject.overlay.rotation = state.pinch.initialRotation + angleDiff;
		scheduleDraw();
		updateCoordDisplay();
		return;
	}

	if (state.pan.active) {
		e.preventDefault();
		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const clientY = e.touches ? e.touches[0].clientY : e.clientY;
		ui.workspace.scrollLeft =
			state.pan.scrollLeft - (clientX - state.pan.startX);
		ui.workspace.scrollTop = state.pan.scrollTop - (clientY - state.pan.startY);
		return;
	}

	if (state.activeTool) return;

	if (state.drag.isTiltMode && state.drag.scaleLocked) {
		singleObject.overlay.scale = state.drag.scaleLocked;
	}
	const pos = getPointer(e);

	if (
		!state.drag.active &&
		!state.drag.scale &&
		!state.drag.rotate &&
		!state.drag.tilt
	) {
		const handle = hitTestHandle(pos.x, pos.y);
		if (handle === "rotate" || handle === "rotateBottom") {
			ui.canvas.style.cursor = "grab";
		} else if (
			handle === "tiltTop" ||
			handle === "tiltBottom" ||
			handle === "tiltLeft" ||
			handle === "tiltRight"
		) {
			ui.canvas.style.cursor = "move";
		} else if (handle) {
			ui.canvas.style.cursor = "nwse-resize";
		} else {
			ui.canvas.style.cursor = "default";
		}
		return;
	}

	if (state.selectedIndex < 0) return;

	if (state.drag.active) {
		syncTrashPos();

        // [整體連動] 若開啟，同步計算其他物件的相對位移
        if (state.globalLinkMode) {
            const targetX = rawX + singleObject.overlay.x;
            const targetY = pos.y - state.drag.startY + singleObject.overlay.y;
            const dx = targetX - singleObject.overlay.x;
            const dy = targetY - singleObject.overlay.y;
            
            objects.forEach(obj => {
                if (obj === singleObject) return;
                obj.overlay.x += dx;
                obj.overlay.y += dy;
            });
        }
        
		const rawX = pos.x - state.drag.startX;
		const rawY = pos.y - state.drag.startY;
		const snap = computeSnap(
			{
				x: rawX,
				y: rawY,
			},
			state.selectedIndex,
		);
		singleObject.overlay.x = snap.x;
		singleObject.overlay.y = snap.y;
		state.alignGuides = snap.guides;

		const dist = Math.hypot(snap.x - TRASH_POS.x, snap.y - TRASH_POS.y);
		const maxDist = TRASH_HIT_RADIUS;
		const minDist = TRASH_RADIUS * 1.1;

		let targetProgress = 0;
		if (dist < maxDist) {
			const raw = (maxDist - dist) / (maxDist - minDist);
			const clamped = Math.max(0, Math.min(1, raw));
			targetProgress = Math.sqrt(clamped);
		}

		state.trashHoverProgress = targetProgress;

		const canDelete = dist <= TRASH_DELETE_RADIUS || targetProgress >= 0.7;
		state.isDraggingToTrash = canDelete;

		if (canDelete && !state._trashVibrated) {
			state._trashVibrated = true;
			try {
				navigator.vibrate?.(15);
			} catch {}
		} else if (!canDelete) {
			state._trashVibrated = false;
		}
		scheduleDraw();
		updateCoordDisplay();
	} else if (state.drag.scale) {
		if (state.drag.isTiltMode) return;
		e.preventDefault();
		const dist1 = Math.hypot(
			pos.x - singleObject.overlay.x,
			pos.y - singleObject.overlay.y,
		);
		const dist0 = state.drag.startDist;
		if (!dist0 || dist0 < 20) return;
		if (dist0 > 20) {
			const ratio = dist1 / dist0;
			const baseScale = state.drag.startScale || singleObject.overlay.scale;
			const targetScale = baseScale * ratio;
			singleObject.overlay.scale = Math.max(0.1, Math.min(8, targetScale));
		}
		// 不再更新 startX/startY（避免 dist0 漂移导致抽搐）
		scheduleDraw();
		updateCoordDisplay();
	} else if (state.drag.rotate) {
		e.preventDefault();
		const angle = Math.atan2(
			pos.y - singleObject.overlay.y,
			pos.x - singleObject.overlay.x,
		);
		let deltaDeg = ((angle - state.drag.startAngle) * 180) / Math.PI;
		deltaDeg = ((((deltaDeg + 180) % 360) + 360) % 360) - 180;

		singleObject.overlay.rotation += deltaDeg * 0.75;
		state.drag.startAngle = angle;
		scheduleDraw();
		updateCoordDisplay();
	} else if (state.drag.tilt) {
		e.preventDefault();
		const rect = ui.canvas.getBoundingClientRect();
		const displayScale = rect.width / CANVAS_W || 1;
		const DEG_PER_SCREEN_PX = isMobile ? 0.9 : 0.55;

		let dxScreen = (pos.x - state.drag.startX) * displayScale;
		let dyScreen = (pos.y - state.drag.startY) * displayScale;

		const MAX_PX = isMobile ? 600 : 400;
		dxScreen = Math.max(-MAX_PX, Math.min(MAX_PX, dxScreen));
		dyScreen = Math.max(-MAX_PX, Math.min(MAX_PX, dyScreen));

		if (state.drag.tiltAxis === "x") {
                // 上下紅點：rotX 原速，rotY (左右) 速度減半
                let newRotX = state.drag.startRotX - dyScreen * DEG_PER_SCREEN_PX * (state.drag.tiltSpeedScale || 1);
                let newRotY = state.drag.startRotY + dxScreen * DEG_PER_SCREEN_PX * (state.drag.tiltSpeedScale || 1) * 0.5;
                
                newRotX = ((((newRotX + 180) % 360) + 360) % 360) - 180;
                newRotY = ((((newRotY + 180) % 360) + 360) % 360) - 180;
                
                singleObject.overlay.rotX = clampTilt(newRotX);
                singleObject.overlay.rotY = clampTilt(newRotY);
        } else if (state.drag.tiltAxis === "y") {
                // 左右紅點：rotY 原速，rotX (上下) 速度減半
                let newRotY = state.drag.startRotY + (state.drag.startIsBack ? -dxScreen : dxScreen) * DEG_PER_SCREEN_PX * (state.drag.tiltSpeedScale || 1);
                let newRotX = state.drag.startRotX - dyScreen * DEG_PER_SCREEN_PX * (state.drag.tiltSpeedScale || 1) * 0.5;
                
                newRotY = ((((newRotY + 180) % 360) + 360) % 360) - 180;
                newRotX = ((((newRotX + 180) % 360) + 360) % 360) - 180;
                
                singleObject.overlay.rotY = clampTilt(newRotY);
                singleObject.overlay.rotX = clampTilt(newRotX);
        } else {
                // 雙軸同時拖曳：兩者都原速
                let newRotY = state.drag.startRotY + dxScreen * DEG_PER_SCREEN_PX * (state.drag.tiltSpeedScale || 1);
                let newRotX = state.drag.startRotX - dyScreen * DEG_PER_SCREEN_PX * (state.drag.tiltSpeedScale || 1);
                
                newRotX = ((((newRotX + 180) % 360) + 360) % 360) - 180;
                newRotY = ((((newRotY + 180) % 360) + 360) % 360) - 180;
                
                singleObject.overlay.rotX = clampTilt(newRotX);
                singleObject.overlay.rotY = clampTilt(newRotY);
        }} else {
			let newRotY = state.drag.startRotY + dxScreen * DEG_PER_SCREEN_PX;
			let newRotX = state.drag.startRotX - dyScreen * DEG_PER_SCREEN_PX;
			newRotX = ((((newRotX + 180) % 360) + 360) % 360) - 180;
			newRotY = ((((newRotY + 180) % 360) + 360) % 360) - 180;
			singleObject.overlay.rotX = clampTilt(newRotX);
			singleObject.overlay.rotY = clampTilt(newRotY);
		}
		scheduleDraw();
		updateCoordDisplay();
	}

function onPointerUp(e) {
	if (isMp4Exporting()) return;
	if (e.touches && e.touches.length > 0) return;

	syncTrashPos();

	const curObj = objects[currentObjectIndex];
	const distToTrash = Math.hypot(
		curObj.overlay.x - TRASH_POS.x,
		curObj.overlay.y - TRASH_POS.y,
	);
	const shouldDelete =
		state.drag.active &&
		(state.isDraggingToTrash ||
			state.trashHoverProgress >= 0.7 ||
			distToTrash <= TRASH_DELETE_RADIUS);

	if (shouldDelete) {
		state.isDeletingObject = true;
		const idx = currentObjectIndex;
		objects[idx].image = null;
		objects[idx].mediaBlob = null;
		objects[idx].canvas.width = 0;
		objects[idx].visible = false;
		objects[idx].name = "";
		objects[idx].playVideo = true;
		objects[idx].videoMode = false;
		objects[idx]._savedMediaBlob = null;
		objects[idx].member = "";
		objects[idx].member2 = "";
		objects[idx].code = "";
		objects[idx].artist = "";
		objects[idx].collection = "";
		objects[idx].backgroundColor = "";

		syncObjectControls();
		refreshObjectSelectorUI();
		updateCoordDisplay();
		showToast(getText(currentLang, "deletedObject"));
		// 額外清「自動補的那格空格」（最後一格，非當前格，且為空）
		if (objects.length > 1) {
			let _autoIdx = objects.length - 1;
			if (_autoIdx === currentObjectIndex && objects.length > 2) {
				_autoIdx = objects.length - 2;
			}
			if (_autoIdx !== currentObjectIndex) {
				const _autoObj = objects[_autoIdx];
				const _autoEmpty = _autoObj && !_autoObj.image && !_autoObj.mediaBlob &&
					(!_autoObj.canvas || _autoObj.canvas.width === 0);
				if (_autoEmpty) {
					removeObject(_autoIdx);
					setCurrentObjectIndex(Math.min(currentObjectIndex, objects.length - 1));
					refreshObjectSelectorUI();
					syncObjectControls();
					updateCoordDisplay();
					scheduleDraw();
				}
			}
		}
			state.isDeletingObject = false;
	}

	state.drag.active = false;
	state.drag.scale = false;
	state.drag.rotate = false;
	state.pan.active = false;
	state.pinch.active = false;
	state.drag.tilt = false;
	state.drag.tiltAxis = null;
	state.isDraggingToTrash = false;
	state._trashVibrated = false;
	state.trashHoverProgress = 0;
	state.drag.active = false;
	state.drag.scale = false;
	state.drag.rotate = false;
	state.pan.active = false;
	state.pinch.active = false;
	state.drag.tilt = false;
	state.drag.tiltAxis = null;
	// 空白鍵仍按著 恢復 grab；否則清空
	if (!isMobile) {
		ui.workspace.style.cursor = spacePanning ? "grab" : "";
	}
	if (bgCtx) bgCtx.imageSmoothingQuality = isMobile ? "low" : "high";
	scheduleDraw();
	if (state.alignGuides.length) {
		state.alignGuides = [];
		scheduleDraw();
	}
}

ui.workspace.addEventListener("mousedown", onPointerDown);

// 滑鼠滾輪 以滑鼠為中心縮放當前滑鼠下的 object
ui.workspace.addEventListener(
	"wheel",
	(e) => {
		if (isMp4Exporting()) return;
		if (isMobile) return;
		if (state.selectedIndex < 0) return;

		const obj = objects[currentObjectIndex];
		if (!obj || !obj.canvas.width) return;

		const pos = getPointer(e);

		const { w, h } = getOverlaySize(currentObjectIndex);
		if (w <= 0 || h <= 0) return;
		const dx = pos.x - obj.overlay.x;
		const dy = pos.y - obj.overlay.y;
		const angle = (-obj.overlay.rotation * Math.PI) / 180;
		const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
		const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
		if (Math.abs(lx) > w / 2 || Math.abs(ly) > h / 2) return;

		e.preventDefault();

		const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
		const oldScale = obj.overlay.scale;
		const newScale = Math.max(0.1, Math.min(8, oldScale * factor));
		const ratio = newScale / oldScale;

		obj.overlay.x = pos.x - (pos.x - obj.overlay.x) * ratio;
		obj.overlay.y = pos.y - (pos.y - obj.overlay.y) * ratio;
		obj.overlay.scale = newScale;

		scheduleDraw();
		updateCoordDisplay();
	},
	{ passive: false },
);

window.addEventListener("mousemove", onPointerMove);
window.addEventListener("mouseup", onPointerUp);
ui.workspace.addEventListener("touchstart", onPointerDown, {
	passive: false,
});
window.addEventListener("touchmove", onPointerMove, {
	passive: false,
});
window.addEventListener("touchend", onPointerUp);
window.addEventListener("touchcancel", onPointerUp);
if (isMobile) {
	ui.workspace.style.overflow = "auto";
	ui.workspace.style.touchAction = "pan-y";

	ui.canvas.style.touchAction = "none";

	let rafId = null;
	const onResize = () => {
		if (rafId !== null) return;
		rafId = requestAnimationFrame(() => {
			rafId = null;
			resizeCanvas();
		});
	};
	window.addEventListener("resize", onResize);
	window.addEventListener("orientationchange", onResize);
	if (window.visualViewport) {
		window.visualViewport.addEventListener("resize", onResize);
	}
}



resizeCanvas();
applyTranslations(ui, currentLang);
renderBookmarks();
refreshObjectSelectorUI();
initImageLoader({
	showToast,
	getCurrentLang: () => currentLang,
});
initPicker({
	ui,
	onApplySlug: handleFetchUrl,
	getCurrentLang: () => currentLang,
});
initClipboardPaste({
	ui,
	loadImage,
	applyCanvasSize,
	syncObjectControls,
	showToast,
	getCurrentLang: () => currentLang,
});
initExport({
	ui,
	showToast,
	getCurrentLang: () => currentLang,
});
// Ctrl+V 貼上圖片到背景
document.addEventListener("paste", (e) => {
	const ae = document.activeElement;
	if (
		ae &&
		(ae.tagName === "INPUT" ||
			ae.tagName === "TEXTAREA" ||
			ae.isContentEditable)
	) {
		return;
	}

	const items = e.clipboardData && e.clipboardData.items;
	if (!items) return;

	let imageFile = null;
	for (const it of items) {
		if (it.type && it.type.startsWith("image/")) {
			imageFile = it.getAsFile();
			break;
		}
	}
	if (!imageFile) return;

	e.preventDefault();

	if (state.bgVideo) {
		try {
			state.bgVideo.pause();
		} catch {}
		try {
			state.bgVideo.src = "";
		} catch {}
		state.bgVideo = null;
		state.bgVideoBlob = null;
	}

	loadImage(imageFile, false).then((img) => {
		if (!img) return;
		state.bgImage = img;
		state.bgName = imageFile.name || "pasted";
		if (ui.btnClearBg) ui.btnClearBg.disabled = false;
		if (ui.btnClearBgMobile) ui.btnClearBgMobile.disabled = false;
		state.cropRatio = "none";
		applyCanvasSize();
		syncObjectControls();
		updateUploadButtonVisibility(ui);
		updateCropButtons();
		updateUploadButtonVisibility(ui);
	});
});


// 圖層方向 objects[0] 為最上層
function bringCurrentObjectToFront() {
	const idx = currentObjectIndex;
	const obj = objects[idx];
	if (!obj || !obj.image || !obj.canvas || obj.canvas.width <= 0) {
		return;
	}
	if (idx === 0) return;
	objects.splice(idx, 1);
	objects.unshift(obj);
	setCurrentObjectIndex(0);
	// 不動手機 object 按鈕 DOM 順序 只重繪畫布
	scheduleDraw();
	updateCoordDisplay();
}

const btnBringFrontMobile = document.getElementById("btn-bring-front-mobile");
if (btnBringFrontMobile) {
	btnBringFrontMobile.addEventListener("click", () => {
		bringCurrentObjectToFront();
	});
}

const btnBringFrontDesktop = document.getElementById("btn-bring-front-desktop");
if (btnBringFrontDesktop) {
	btnBringFrontDesktop.addEventListener("click", () => {
		bringCurrentObjectToFront();
	});
}

initObjectSelector({
	onSelect: (i) => selectObject(i),
	onMutation: () => {
		syncObjectControls();
		refreshObjectSelectorUI();
		updateCoordDisplay();
		scheduleDraw();
	},
});
initTextInput(ui);
initSettings({
	ui,
	renderBookmarks,
	showToast,
	getCurrentLang: () => currentLang,
});
initCropRatio({ ui, getCurrentLang: () => currentLang, resizeCanvas });
bindTextInputs(ui);
bindAssistToggles(ui);
bindQrTextInputs();
bindClearCacheButtons();
setupSyncInputs(ui.selectFont, ui.selectFontMobile, () => (singleObject.font = ui.selectFont.value));
setupSyncInputs(ui.inputColor, ui.inputColorMobile, () => (singleObject.color = ui.inputColor.value));
setupSyncInputs(ui.selectTarget, ui.selectTargetMobile);
setupSyncInputs(ui.selectFormat, ui.selectFormatMobile);
setupSyncInputs(ui.selectLang, ui.selectLangMobile, (e) => {
	currentLang = e.target.value;
	applyTranslations(ui, currentLang);
	renderBookmarks();
	refreshObjectSelectorUI();
	if (ui.objektsPicker && ui.objektsPicker.classList.contains("open")) pickerReset({ onlyCode: true });
});

initEmptyHint();
createAdvancedSettings(ui, () => currentLang);
setTimeout(() => updateUploadButtonVisibility(ui), 0);

const sleeve = new Image();
sleeve.crossOrigin = "Anonymous";
sleeve.src = SLEEVE_DATA_URL; // 由 static.js 提供
sleeve.onerror = () => console.warn("sleeve load failed");
sleeve.onload = () => {
	state.sleeveImage = sleeve;
	composeOverlay(true, 0);
};

(async () => {
	try {
		for (const f of ["Inter", "Montserrat", "Pretendard"]) {
			const weight = f === "Pretendard" ? "600" : "bold";
			await document.fonts.load(`${weight} 52px "${f}"`);
		}
	} catch (e) {
		console.warn("CDN font load failed", e);
	}
	try {
		await document.fonts.load('42px "DotMatrixNormal"');
		if (!document.fonts.check('42px "DotMatrixNormal"')) {
			console.warn("DotMatrixNormal failed to load, check font path!");
		}
	} catch (e) {
		console.warn("DotMatrixNormal load failed", e);
	}
	// 字體載入後 重畫所有 object 的正面 + 背面 修正 text_num 點陣字
	for (let i = 0; i < objects.length; i++) {
		if (objects[i].image) {
			composeOverlay(false, i);
			composeBackOverlay(false, i);
		}
	}
	scheduleDraw();
})();

scheduleDraw();

if (isMobile) {
	let touchStartY = 0;
	let touchCurrentY = 0;
	let isPullingDown = false;

	ui.toolbar.addEventListener(
		"touchstart",
		(e) => {
			if (!ui.toolbar.classList.contains("open")) return;

			if (ui.toolbar.scrollTop <= 0) {
				touchStartY = e.touches[0].clientY;
				touchCurrentY = touchStartY;
				isPullingDown = true;
			} else {
				isPullingDown = false;
			}
		},
		{
			passive: true,
		},
	);

	ui.toolbar.addEventListener(
		"touchmove",
		(e) => {
			if (!isPullingDown) return;

			touchCurrentY = e.touches[0].clientY;
			const deltaY = touchCurrentY - touchStartY;

			if (deltaY > 0) {
				if (e.cancelable) e.preventDefault();
				ui.toolbar.style.transition = "none";
				ui.toolbar.style.transform = `translateY(${deltaY}px)`;
			}
		},
		{
			passive: false,
		},
	);

	// Object 選單下滑關閉
	let pickerStartY = 0;
	let pickerCurrentY = 0;
	let pickerPulling = false;

	ui.objektsPicker.addEventListener(
		"touchstart",
		(e) => {
			if (!ui.objektsPicker.classList.contains("open")) return;

			if (
				e.target.closest("button") ||
				e.target.closest("input") ||
				e.target.closest("select")
			) {
				pickerPulling = false;
				return;
			}

			const rect = ui.objektsPicker.getBoundingClientRect();
			const startY = e.touches[0].clientY;

			if (startY - rect.top <= 70) {
				pickerStartY = startY;
				pickerCurrentY = startY;
				pickerPulling = true;
			} else {
				pickerPulling = false;
			}
		},
		{
			passive: true,
		},
	);

	ui.objektsPicker.addEventListener(
		"touchmove",
		(e) => {
			if (!pickerPulling) return;
			pickerCurrentY = e.touches[0].clientY;
			const deltaY = pickerCurrentY - pickerStartY;
			if (deltaY > 0) {
				if (e.cancelable) e.preventDefault();
				ui.objektsPicker.style.transition = "none";
				ui.objektsPicker.style.transform = `translateY(${deltaY}px)`;
			}
		},
		{
			passive: false,
		},
	);

	ui.objektsPicker.addEventListener("touchend", () => {
		if (!pickerPulling) return;
		pickerPulling = false;
		const deltaY = pickerCurrentY - pickerStartY;
		ui.objektsPicker.style.transition = "";
		ui.objektsPicker.style.transform = "";
		if (deltaY > 110) {
			pickerClose();
		}
	});

	ui.toolbar.addEventListener("touchend", () => {
		if (!isPullingDown) return;
		isPullingDown = false;

		const deltaY = touchCurrentY - touchStartY;

		ui.toolbar.style.transition = "transform 0.25s ease, opacity 0.2s ease";
		ui.toolbar.style.transform = "";

		pickerClose();
	});
}

window.__debug = {
	objects,
	state,
	CANVAS_W,
	CANVAS_H,
};

if (isMobile) {
    const toolbar = document.getElementById('toolbar');
    if (toolbar) {
        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        const handle = toolbar.querySelector('.toolbar-swipe-handle') || toolbar;

        handle.addEventListener('touchstart', (e) => {
            if (!toolbar.classList.contains('open')) return;
            const rect = toolbar.getBoundingClientRect();
            const y = e.touches[0].clientY;
            // 只有在頂部或滾動到最頂端才允許下拉
            if (y - rect.top <= 75 || toolbar.scrollTop <= 0) {
                startY = y;
                currentY = y;
                isPulling = true;
            }
        }, { passive: true });

        handle.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            currentY = e.touches[0].clientY;
            const delta = currentY - startY;
            if (delta > 0) {
                if (e.cancelable) e.preventDefault();
                toolbar.style.transition = 'none';
                toolbar.style.transform = 'translateY(' + delta + 'px)';
            }
        }, { passive: false });

        handle.addEventListener('touchend', () => {
            if (!isPulling) return;
            isPulling = false;
            const delta = currentY - startY;
            toolbar.style.transition = 'transform 0.25s ease, opacity 0.2s ease';
            toolbar.style.transform = '';
            if (delta > 100) {
                toolbar.classList.remove('open');
                const bd = document.getElementById('drawer-backdrop');
                if (bd) bd.classList.remove('show');
            }
        });
    }
}

// 手機/電腦 topbar 書籤下拉選單
const bookmarkSelectTop = document.getElementById("bookmark-select-top");
if (bookmarkSelectTop) {
    bookmarkSelectTop.addEventListener("change", (e) => {
        const slug = e.target.value;
        if (!slug) return;
        handleFetchUrl(slug);
        e.target.value = "";
    });
}





// 初始化排版工具互動
setTimeout(() => { initLayoutUI(ui); }, 100);
