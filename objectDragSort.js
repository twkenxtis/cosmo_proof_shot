import { objects, currentObjectIndex, setCurrentObjectIndex } from "./canvas.js";

let _onReorder = () => {};
let _dragSrcIdx = -1;

export function initObjectDragSort({ onReorder }) {
	_onReorder = onReorder || (() => {});

	document.addEventListener("dragstart", (e) => {
		const btn = e.target.closest(".obj-sel-btn[data-index]");
		if (!btn) return;
		if (!btn.closest(".object-selector-desktop")) return;
		_dragSrcIdx = parseInt(btn.dataset.index, 10);
		if (isNaN(_dragSrcIdx)) return;
		btn.classList.add("dragging");
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", String(_dragSrcIdx));
	});

	document.addEventListener("dragover", (e) => {
		const btn = e.target.closest(".obj-sel-btn[data-index]");
		if (!btn || _dragSrcIdx < 0) return;
		if (!btn.closest(".object-selector-desktop")) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		btn.classList.add("drag-over");
	});

	document.addEventListener("dragleave", (e) => {
		const btn = e.target.closest(".obj-sel-btn[data-index]");
		if (btn) btn.classList.remove("drag-over");
	});

	document.addEventListener("drop", (e) => {
		const btn = e.target.closest(".obj-sel-btn[data-index]");
		if (!btn || _dragSrcIdx < 0) return;
		if (!btn.closest(".object-selector-desktop")) return;
		e.preventDefault();
		btn.classList.remove("drag-over");
		const dst = parseInt(btn.dataset.index, 10);
		if (isNaN(dst) || dst === _dragSrcIdx) { _dragSrcIdx = -1; return; }

		const moved = objects.splice(_dragSrcIdx, 1)[0];
		objects.splice(dst, 0, moved);

		if (currentObjectIndex === _dragSrcIdx) {
			setCurrentObjectIndex(dst);
		} else if (_dragSrcIdx < currentObjectIndex && dst >= currentObjectIndex) {
			setCurrentObjectIndex(currentObjectIndex - 1);
		} else if (_dragSrcIdx > currentObjectIndex && dst <= currentObjectIndex) {
			setCurrentObjectIndex(currentObjectIndex + 1);
		}
		_dragSrcIdx = -1;
		_onReorder();
	});

	document.addEventListener("dragend", () => {
		document.querySelectorAll(".obj-sel-btn.dragging").forEach((b) => b.classList.remove("dragging"));
		document.querySelectorAll(".obj-sel-btn.drag-over").forEach((b) => b.classList.remove("drag-over"));
		_dragSrcIdx = -1;
	});
}