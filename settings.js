import { state, objects, composeBackOverlay } from "./canvas.js";
import { clearAllLocalStorage } from "./api.js";
import { getText } from "./i18n.js";

let _deps = {
	ui: {},
	renderBookmarks: () => {},
	showToast: () => {},
	getCurrentLang: () => "zh-TW",
};

export function initSettings(deps) {
	_deps = { ..._deps, ...deps };
}

export function bindQrTextInputs() {
	const ui = _deps.ui;
	const setQrText = (val) => {
		// 空字串時保留預設 QR 文字
		if (val && val.trim()) {
			state.qrText = val;
		} else {
			state.qrText = "";
		}
		if (ui.inputQrText) ui.inputQrText.value = state.qrText;
		if (ui.inputQrTextMobile) ui.inputQrTextMobile.value = state.qrText;
		for (let i = 0; i < objects.length; i++) {
			if (objects[i].image) composeBackOverlay(false, i);
		}
	};
	if (ui.inputQrText) ui.inputQrText.addEventListener("input", (e) => setQrText(e.target.value));
	if (ui.inputQrTextMobile) ui.inputQrTextMobile.addEventListener("input", (e) => setQrText(e.target.value));
	// 預設不顯示文字 但 state.qrText 保留原預設值
	if (ui.inputQrText) ui.inputQrText.value = "";
	if (ui.inputQrTextMobile) ui.inputQrTextMobile.value = "";
}

export function bindClearCacheButtons() {
	const handler = () => {
		if (!confirm(getText(_deps.getCurrentLang(), "clearCacheConfirm"))) return;
		clearAllLocalStorage();
		_deps.renderBookmarks();
		_deps.showToast(getText(_deps.getCurrentLang(), "clearCacheDone"));
	};
	const m = document.getElementById("btn-clear-cache-mobile");
	const d = document.getElementById("btn-clear-cache-desktop");
	if (m) m.addEventListener("click", handler);
	if (d) d.addEventListener("click", handler);
}