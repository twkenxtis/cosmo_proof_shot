import { objects, currentObjectIndex, singleObject, recomposeCurrent } from "./canvas.js";

let _ui = {};
let _textDebounce = null;

function formatTextInput(val) {
	const clean = val.toUpperCase().replace(/[^0-9AZ]/g, "");
	const digits = clean.replace(/[^0-9]/g, "").slice(0, 3);
	const letters = clean.replace(/[^AZ]/g, "").slice(0, 1);
	return digits + letters;
}
function formatText2Input(val) { return val.replace(/\D/g, "").slice(0, 6); }

function onTextChange() {
	clearTimeout(_textDebounce);
	_textDebounce = setTimeout(() => recomposeCurrent(), 120);
}

export function initTextInput(ui) {
	_ui = ui;
}

export function bindTextInputs(ui) {
	// 文字/數字框 focus 自動全選
	[ui.inputText, ui.inputTextMobile, ui.inputText2, ui.inputText2Mobile].forEach((el) => {
		if (!el) return;
		el.addEventListener("focus", () => {
			requestAnimationFrame(() => el.select());
		});
	});
	ui.inputText.addEventListener("input", (e) => {
		const v = formatTextInput(e.target.value);
		e.target.value = v;
		ui.inputTextMobile.value = v;
		singleObject.text = v;
	});
	ui.inputTextMobile.addEventListener("input", (e) => {
		const v = formatTextInput(e.target.value);
		e.target.value = v;
		ui.inputText.value = v;
		singleObject.text = v;
	});
	ui.inputText2.addEventListener("input", (e) => {
		const v = formatText2Input(e.target.value);
		e.target.value = v;
		ui.inputText2Mobile.value = v;
		singleObject.text2 = v;
	});
	ui.inputText2Mobile.addEventListener("input", (e) => {
		const v = formatText2Input(e.target.value);
		e.target.value = v;
		ui.inputText2.value = v;
		singleObject.text2 = v;
	});
	ui.inputText.addEventListener("input", onTextChange);
	ui.inputTextMobile.addEventListener("input", onTextChange);
	ui.selectFont.addEventListener("change", onTextChange);
	ui.selectFontMobile.addEventListener("change", onTextChange);
	ui.inputColor.addEventListener("input", onTextChange);
	ui.inputColorMobile.addEventListener("input", onTextChange);
	ui.inputText2.addEventListener("input", onTextChange);
	ui.inputText2Mobile.addEventListener("input", onTextChange);
}