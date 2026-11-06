import { state } from "./canvas.js";
import { getText, isMobile } from "./i18n.js";

let _ui = null;
let _loadImage = null;
let _applyCanvasSize = null;
let _syncObjectControls = null;
let _showToast = () => {};
let _getCurrentLang = () => "en";

let _pastePressTimer = null;

export function initClipboardPaste({
	ui,
	loadImage,
	applyCanvasSize,
	syncObjectControls,
	showToast,
	getCurrentLang,
} = {}) {
	if (!ui) {
		console.warn("[clipboardPaste] initClipboardPaste: ui is null, abort");
		return;
	}
	_ui = ui;
	_loadImage = loadImage;
	_applyCanvasSize = applyCanvasSize;
	_syncObjectControls = syncObjectControls;
	if (typeof showToast === "function") _showToast = showToast;
	if (typeof getCurrentLang === "function") _getCurrentLang = getCurrentLang;

	bindPasteGesture();
}

export function bindPasteGesture() {
	if (!isMobile) return;
	if (!_ui || !_ui.uiCanvas) {
		console.warn(
			"[clipboardPaste] bindPasteGesture: ui.uiCanvas missing, skip",
		);
		return;
	}

	const target = _ui.uiCanvas;

	const start = (e) => {
		// 僅在「沒有背景」時允許長按貼上
		if (!(!state.bgImage && !state.bgVideo)) return;

		if (_pastePressTimer) clearTimeout(_pastePressTimer);
		_pastePressTimer = setTimeout(async () => {
			_pastePressTimer = null;
			try {
				if (!navigator.clipboard || !navigator.clipboard.read) {
					_showToast(getText(_getCurrentLang(), "pasteUnsupported"));
					return;
				}
				const items = await navigator.clipboard.read();
				let done = false;

				for (const item of items) {
					for (const type of item.types) {
						if (type.startsWith("image/")) {
							const blob = await item.getType(type);
							const img = await _loadImage(blob, false);
							if (img) {
								state.bgImage = img;
								state.bgImageCropped = null;
								state.bgName = "clipboard";
								state.cropRatio = "none";
								if (_ui.btnClearBg) _ui.btnClearBg.disabled = false;
								if (_ui.btnClearBgMobile) _ui.btnClearBgMobile.disabled = false;
								_applyCanvasSize();
								_syncObjectControls();
								_showToast(getText(_getCurrentLang(), "pasteSuccess"));
							} else {
								_showToast(getText(_getCurrentLang(), "pasteFailed"));
							}
							done = true;
							break;
						}
					}
					if (done) break;
				}
				if (!done) _showToast(getText(_getCurrentLang(), "pasteFailed"));
			} catch (err) {
				console.warn("clipboard read failed", err);
				_showToast(getText(_getCurrentLang(), "pasteFailed"));
			}
		}, 600);
	};

	const cancel = () => {
		if (_pastePressTimer) {
			clearTimeout(_pastePressTimer);
			_pastePressTimer = null;
		}
	};

	target.addEventListener("touchstart", start, { passive: false });
	target.addEventListener("touchend", cancel);
	target.addEventListener("touchcancel", cancel);
	target.addEventListener("touchmove", cancel, { passive: true });
}
