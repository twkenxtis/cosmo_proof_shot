import { objects, state } from "./canvas.js";

let _el = null;

function _getEl() {
        if (!_el) _el = document.getElementById("canvas-empty-hint");
        return _el;
}

export function initEmptyHint() {
        const el = _getEl();
        if (!el) {
                console.warn("[emptyHint] #canvas-empty-hint not found");
                return;
        }
        updateEmptyHint();
        if (!el._boundClick) {
                el._boundClick = true;
                el.addEventListener("click", () => {
                        const inputBg = document.getElementById("input-bg");
                        if (inputBg) inputBg.click();
                });
        }
}

export function updateEmptyHint() {
        const el = _getEl();
        if (!el) return;

        // 有效 object 有圖或影片，且 canvas 已 compose
        const hasObj = Array.isArray(objects) && objects.some(
                (o) => o && (o.image || o.mediaBlob) && o.canvas && o.canvas.width > 0,
        );

        // 有效背景 圖片、裁切圖、影片 element、或影片 blob
        const hasBg = !!(
                state &&
                (state.bgImage || state.bgImageCropped || state.bgVideo || state.bgVideoBlob)
        );

        const show = !hasObj && !hasBg;
        el.classList.toggle("show", show);
        el.classList.toggle("hidden", !show);
        el.setAttribute("aria-hidden", show ? "false" : "true");
}