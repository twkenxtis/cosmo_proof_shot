import {
	CANVAS_H,
	CANVAS_W,
	getOverlaySize,
	scheduleDraw,
	singleObject,
} from "./canvas.js";
import { isMobile } from "./i18n.js";

let _ui = null;
let coordInputTimer = null;
let coordRafId = null;

export function initCoords(uiRef) {
	_ui = uiRef;
}

function parseSafe(val, defaultVal = 0) {
	if (!val || val === "-" || val === "." || val === "-.") return defaultVal;
	const num = parseFloat(val);
	return isNaN(num) ? defaultVal : num;
}

export function applyCoordInputs() {
	if (!_ui) return;
	if (!singleObject.canvas.width) return;

	const ui = _ui;

	let newX = parseSafe(ui.inputCoordX?.value, 0);
	let newY = parseSafe(ui.inputCoordY?.value, 0);
	let newZ = parseSafe(ui.inputCoordZ?.value, 0);
	let newR = parseSafe(ui.inputCoordR?.value, 0);

	newZ = Math.max(-90, Math.min(700, newZ));
	newR = Math.max(-180, Math.min(180, newR));

	singleObject.overlay.scale = 1 + newZ / 100;
	singleObject.overlay.rotation = newR;

	const { w, h } = getOverlaySize();
	const rad = (newR * Math.PI) / 180;
	const rotW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
	const rotH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));

	const marginX = rotW / 2 - 40;
	const marginY = rotH / 2 - 40;

	const minX = -CANVAS_W / 2 - marginX;
	const maxX = CANVAS_W / 2 + marginX;
	const minY = -CANVAS_H / 2 - marginY;
	const maxY = CANVAS_H / 2 + marginY;

	newX = Math.max(minX, Math.min(maxX, newX));
	newY = Math.max(minY, Math.min(maxY, newY));

	singleObject.overlay.x = newX + CANVAS_W / 2;
	singleObject.overlay.y = CANVAS_H / 2 - newY;

	const newRx = parseSafe(ui.inputCoordRx?.value, 0);
	const newRy = parseSafe(ui.inputCoordRy?.value, 0);

	singleObject.overlay.rotX = Math.max(-180, Math.min(180, newRx));
	singleObject.overlay.rotY = Math.max(-180, Math.min(180, newRy));

	scheduleDraw();
	updateCoordDisplay();
}

function handleCoordInput(e) {
	if (!_ui || !_ui.inputCoordX) return;
	const val = e.target.value;
	if (val === "" || val === "-" || val === ".") return;
	if (val.length > 6) e.target.value = val.slice(0, 6);
	clearTimeout(coordInputTimer);
	coordInputTimer = setTimeout(() => applyCoordInputs(), 200);
}

export function bindCoordInputs() {
	if (!_ui) return;
	if (isMobile || !_ui.inputCoordX) return;

	const ui = _ui;
	const inputs = [
		ui.inputCoordX,
		ui.inputCoordY,
		ui.inputCoordZ,
		ui.inputCoordR,
		ui.inputCoordRx,
		ui.inputCoordRy,
	];

	const preventInvalidChars = (e) => {
		if (["e", "E", "+"].includes(e.key)) e.preventDefault();
	};

	inputs.forEach((input) => {
		if (!input) return;

		input.addEventListener("keydown", preventInvalidChars);
		input.addEventListener("input", handleCoordInput);

		input.addEventListener("blur", () => {
			clearTimeout(coordInputTimer);
			if (input.value === "" || input.value === "-" || input.value === ".")
				input.value = "0";
			applyCoordInputs();
		});

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				clearTimeout(coordInputTimer);
				applyCoordInputs();
				input.blur();
			}
		});
	});
}

export function updateCoordDisplay() {
	if (!_ui) return;

	const coordXEl = document.getElementById("coord-x");
	const coordYEl = document.getElementById("coord-y");
	const coordZEl = document.getElementById("coord-z");
	const coordREl = document.getElementById("coord-r");

	if (isMobile || !coordXEl) return;
	if (coordRafId !== null) return;

	const ui = _ui;

	coordRafId = requestAnimationFrame(() => {
		coordRafId = null;

		if (!singleObject.canvas.width) {
			coordXEl.textContent = "0";
			coordYEl.textContent = "0";
			coordZEl.textContent = "0";
			if (coordREl) coordREl.textContent = "0°";
			if (ui.inputCoordX && document.activeElement !== ui.inputCoordX)
				ui.inputCoordX.value = 0;
			if (ui.inputCoordY && document.activeElement !== ui.inputCoordY)
				ui.inputCoordY.value = 0;
			if (ui.inputCoordZ && document.activeElement !== ui.inputCoordZ)
				ui.inputCoordZ.value = 0;
			if (ui.inputCoordR && document.activeElement !== ui.inputCoordR)
				ui.inputCoordR.value = 0;
			if (ui.inputCoordRx && document.activeElement !== ui.inputCoordRx)
				ui.inputCoordRx.value = 0;
			if (ui.inputCoordRy && document.activeElement !== ui.inputCoordRy)
				ui.inputCoordRy.value = 0;
			return;
		}

		const cx = Math.round(singleObject.overlay.x - CANVAS_W / 2);
		const cy = Math.round(CANVAS_H / 2 - singleObject.overlay.y);
		const cz = Math.round((singleObject.overlay.scale - 1) * 100);

		let cr = singleObject.overlay.rotation;
		cr = ((((cr + 180) % 360) + 360) % 360) - 180;
		cr = Math.round(cr * 10) / 10;

		coordXEl.textContent = cx;
		coordYEl.textContent = cy;
		coordZEl.textContent = (cz > 0 ? "+" : "") + cz + "%";
		if (coordREl) coordREl.textContent = (cr > 0 ? "+" : "") + cr + "°";

		if (ui.inputCoordX && document.activeElement !== ui.inputCoordX)
			ui.inputCoordX.value = cx;
		if (ui.inputCoordY && document.activeElement !== ui.inputCoordY)
			ui.inputCoordY.value = cy;
		if (ui.inputCoordZ && document.activeElement !== ui.inputCoordZ)
			ui.inputCoordZ.value = cz;
		if (ui.inputCoordR && document.activeElement !== ui.inputCoordR)
			ui.inputCoordR.value = cr;

		const crx = singleObject.overlay.rotX || 0;
		const cry = singleObject.overlay.rotY || 0;
		if (ui.inputCoordRx && document.activeElement !== ui.inputCoordRx)
			ui.inputCoordRx.value = crx;
		if (ui.inputCoordRy && document.activeElement !== ui.inputCoordRy)
			ui.inputCoordRy.value = cry;
	});
}
