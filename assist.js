import { state, scheduleDraw } from "./canvas.js";

export function bindAssistToggles(ui) {
	const setGrid = (v) => {
		state.gridMode = v;
		if (ui.selectGrid) ui.selectGrid.value = v;
		if (ui.selectGridMobile) ui.selectGridMobile.value = v;
		scheduleDraw();
	};
	const setAlign = (v) => {
		state.showAlignGuides = v;
		if (ui.chkAlign) ui.chkAlign.checked = v;
		if (ui.chkAlignMobile) ui.chkAlignMobile.checked = v;
		if (!v) state.alignGuides = [];
		scheduleDraw();
	};
	if (ui.selectGrid) ui.selectGrid.addEventListener("change", (e) => setGrid(e.target.value));
	if (ui.selectGridMobile) ui.selectGridMobile.addEventListener("change", (e) => setGrid(e.target.value));
	if (ui.chkAlign) ui.chkAlign.addEventListener("change", (e) => setAlign(e.target.checked));
	if (ui.chkAlignMobile) ui.chkAlignMobile.addEventListener("change", (e) => setAlign(e.target.checked));

	if (ui.selectGrid) ui.selectGrid.value = state.gridMode;
	if (ui.selectGridMobile) ui.selectGridMobile.value = state.gridMode;
	if (ui.chkAlign) ui.chkAlign.checked = state.showAlignGuides;
	if (ui.chkAlignMobile) ui.chkAlignMobile.checked = state.showAlignGuides;
}