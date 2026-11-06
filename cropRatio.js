import { state, applyCanvasSize, scheduleDraw } from "./canvas.js";
import { getText } from "./i18n.js";

let _ui = {};
let _getLang = () => "zh-TW";
let _resizeCanvas = () => {};

const CROP_RATIOS = ["none", "1:1", "4:3", "3:2", "9:16"];
const CROP_LABELS = {
	none: () => getText(_getLang(), "cropNone"),
	"1:1": () => getText(_getLang(), "crop1x1"),
	"4:3": () => getText(_getLang(), "crop4x3"),
	"3:2": () => getText(_getLang(), "crop3x2"),
	"9:16": () => getText(_getLang(), "crop9x16"),
};

export function updateCropButtons() {
	const ui = _ui;
	const label = (CROP_LABELS[state.cropRatio] || CROP_LABELS.none)();
	const isActive = state.cropRatio !== "none";
	if (ui.btnCropRatioDesktop) {
		ui.btnCropRatioDesktop.textContent = `⧉ ${getText(_getLang(), "cropTitle")}：${label}`;
		ui.btnCropRatioDesktop.classList.toggle("active", isActive);
	}
	if (ui.btnCropRatioMobile) {
		ui.btnCropRatioMobile.classList.toggle("active", isActive);
		ui.btnCropRatioMobile.title = `${getText(_getLang(), "cropTitle")}：${label}`;
	}
}

function cycleCropRatio() {
	if (!state.bgImage && !state.bgVideo) return;
	const idx = CROP_RATIOS.indexOf(state.cropRatio);
	state.cropRatio = CROP_RATIOS[(idx + 1) % CROP_RATIOS.length];
	applyCanvasSize();
	_resizeCanvas();
	updateCropButtons();
	scheduleDraw();
}

export function initCropRatio({ ui, getCurrentLang, resizeCanvas }) {
	_ui = ui;
	_getLang = getCurrentLang;
	_resizeCanvas = resizeCanvas;
	if (ui.btnCropRatioDesktop) ui.btnCropRatioDesktop.addEventListener("click", cycleCropRatio);
	if (ui.btnCropRatioMobile) ui.btnCropRatioMobile.addEventListener("click", cycleCropRatio);
	updateCropButtons();
}