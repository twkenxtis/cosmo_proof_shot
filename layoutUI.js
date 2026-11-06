import { layoutGrid, layoutCircle, layoutFan, layoutStack, layoutFlip3D } from "./layoutTools.js";
import { state, objects, scheduleDraw } from "./canvas.js";

let _currentLayoutType = "line";
let _sliderValue = 300;
let _globalScale = 0.6;
let _globalRotY = 0;
let _globalRotX = 0;
let _globalX = 0;
let _globalY = 0;
let _globalRotation = 0;
let _force3D = false;

const DEFAULTS = {
    slider: 300,
    scale: 0.6,
    rotY: 0,
    rotX: 0,
    x: 0,
    y: 0,
    rotation: 0
};

export function initLayoutUI() {
    const bindBtn = (id, type) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("click", () => {
                _currentLayoutType = type;
                resetAllParams();
                markLayoutButtonActive(type);
                triggerLayout();
            });
        }
    };
    bindBtn("btn-layout-grid", "grid");
    bindBtn("btn-layout-grid-mobile", "grid");
    bindBtn("btn-layout-circle", "circle");
    bindBtn("btn-layout-circle-mobile", "circle");
    bindBtn("btn-layout-fan", "fan");
    bindBtn("btn-layout-fan-mobile", "fan");
    bindBtn("btn-layout-stack", "stack");
    bindBtn("btn-layout-stack-mobile", "stack");
    bindBtn("btn-layout-flip3d", "flip3d");
    bindBtn("btn-layout-flip3d-mobile", "flip3d");

        const slider = document.getElementById("slider-layout-spacing");
    if (slider) {
        // 加入拖曳狀態防護
        slider.addEventListener("pointerdown", () => { window._isDraggingSlider = true; });
        slider.addEventListener("pointerup", () => { window._isDraggingSlider = false; });
        slider.addEventListener("pointercancel", () => { window._isDraggingSlider = false; });
        
        slider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            if (_currentLayoutType === "grid") {
                // Grid 模式：直接線性映射 (50~500 對應 50~500)
                _sliderValue = val;
            } else {
                // 其他模式：非線性映射，但限制在合理範圍
                _sliderValue = Math.round(50 + Math.pow(val / 300, 1.5) * 1990);
            }
            triggerLayout();
        });
    }

    const scaleSlider = document.getElementById("slider-global-scale");
    if (scaleSlider) {
        scaleSlider.addEventListener("pointerdown", () => { window._isDraggingSlider = true; });
        scaleSlider.addEventListener("pointerup", () => { window._isDraggingSlider = false; });
        scaleSlider.addEventListener("pointercancel", () => { window._isDraggingSlider = false; });
        scaleSlider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            _globalScale = 0.1 + (val / 100) * 2.9;
            triggerLayout();
        });
    }

    const rotYSlider = document.getElementById("slider-3d-roty");
    if (rotYSlider) {
        rotYSlider.addEventListener("pointerdown", () => { window._isDraggingSlider = true; });
        rotYSlider.addEventListener("pointerup", () => { window._isDraggingSlider = false; });
        rotYSlider.addEventListener("pointercancel", () => { window._isDraggingSlider = false; });
        rotYSlider.addEventListener("input", (e) => {
            let val = parseInt(e.target.value, 10);
            let angle = -180 + (val / 100) * 360;
            if (Math.abs(angle - 180) < 5) angle = 180;
            if (Math.abs(angle + 180) < 5) angle = -180;
            _globalRotY = angle;
            _force3D = true;
            triggerLayout();
        });
    }

    const rotXSlider = document.getElementById("slider-3d-rotx");
    if (rotXSlider) {
        rotXSlider.addEventListener("pointerdown", () => { window._isDraggingSlider = true; });
        rotXSlider.addEventListener("pointerup", () => { window._isDraggingSlider = false; });
        rotXSlider.addEventListener("pointercancel", () => { window._isDraggingSlider = false; });
        rotXSlider.addEventListener("input", (e) => {
            let val = parseInt(e.target.value, 10);
            let angle = -180 + (val / 100) * 360;
            if (Math.abs(angle - 180) < 5) angle = 180;
            if (Math.abs(angle + 180) < 5) angle = -180;
            _globalRotX = angle;
            _force3D = true;
            triggerLayout();
        });
    }

    const xSlider = document.getElementById("slider-global-x");
    if (xSlider) {
        xSlider.addEventListener("pointerdown", () => { window._isDraggingSlider = true; });
        xSlider.addEventListener("pointerup", () => { window._isDraggingSlider = false; });
        xSlider.addEventListener("pointercancel", () => { window._isDraggingSlider = false; });
        xSlider.addEventListener("input", (e) => {
            _globalX = parseInt(e.target.value, 10);
            triggerLayout();
        });
    }

    const ySlider = document.getElementById("slider-global-y");
    if (ySlider) {
        ySlider.addEventListener("pointerdown", () => { window._isDraggingSlider = true; });
        ySlider.addEventListener("pointerup", () => { window._isDraggingSlider = false; });
        ySlider.addEventListener("pointercancel", () => { window._isDraggingSlider = false; });
        ySlider.addEventListener("input", (e) => {
            _globalY = parseInt(e.target.value, 10);
            triggerLayout();
        });
    }

    const rotSlider = document.getElementById("slider-global-rotation");
    if (rotSlider) {
        rotSlider.addEventListener("pointerdown", () => { window._isDraggingSlider = true; });
        rotSlider.addEventListener("pointerup", () => { window._isDraggingSlider = false; });
        rotSlider.addEventListener("pointercancel", () => { window._isDraggingSlider = false; });
        rotSlider.addEventListener("input", (e) => {
            _globalRotation = parseInt(e.target.value, 10);
            triggerLayout();
        });
    }
}

function resetAllParams() {
    _sliderValue = DEFAULTS.slider;
    _globalScale = DEFAULTS.scale;
    _globalRotY = DEFAULTS.rotY;
    _globalRotX = DEFAULTS.rotX;
    _globalX = DEFAULTS.x;
    _globalY = DEFAULTS.y;
    _globalRotation = 0;
    _force3D = false;

    const pairs = [
        ["slider-layout-spacing", "slider-layout-spacing-mobile"],
        ["slider-global-scale", "slider-global-scale-mobile"],
        ["slider-3d-roty", "slider-3d-roty-mobile"],
        ["slider-3d-rotx", "slider-3d-rotx-mobile"],
        ["slider-global-x", "slider-global-x-mobile"],
        ["slider-global-y", "slider-global-y-mobile"],
        ["slider-global-rotation", "slider-global-rotation-mobile"],
    ];

}

function triggerLayout() {
    const objs = objects.filter(o => o && o.image && o.canvas && o.canvas.width > 0);
    if (objs.length === 0) return;

    if (_currentLayoutType === "grid") {
        layoutGrid(objs, 3, 1, _sliderValue);
    } else if (_currentLayoutType === "circle") {
        layoutCircle(objs, _sliderValue * 0.15, 1);
    } else if (_currentLayoutType === "fan") {
        layoutFan(objs, 60, 1, 0.5 + (_sliderValue / 1000));
    } else if (_currentLayoutType === "stack") {
        layoutStack(objs, _sliderValue / 20, 1);
    } else if (_currentLayoutType === "flip3d") {
        layoutFlip3D(objs, _sliderValue / 10, 1);
    }

    objs.forEach(obj => {
        obj.overlay.scale *= _globalScale;

        if (_force3D) {
            obj.overlay.rotX = _globalRotX;
            obj.overlay.rotY = _globalRotY;
        } else {
            obj.overlay.rotX = 0;
            obj.overlay.rotY = 0;
        }

        if (_globalRotation !== 0) {
            obj.overlay.rotation = _globalRotation;
        }

        obj.overlay.x += _globalX;
        obj.overlay.y += _globalY;
    });

    if (!window._isDraggingSlider) {
        syncSlidersToDOM();
    }
    scheduleDraw();
}

function syncSlidersToDOM() {
    if (typeof document === "undefined") return;
    const map = [
        ["slider-layout-spacing",     "slider-layout-spacing-mobile",     _sliderValue],
        ["slider-global-scale",       "slider-global-scale-mobile",       Math.round((_globalScale - 0.1) / 2.9 * 100)],
        ["slider-3d-roty",            "slider-3d-roty-mobile",            Math.round((_globalRotY + 180) / 360 * 100)],
        ["slider-3d-rotx",            "slider-3d-rotx-mobile",            Math.round((_globalRotX + 180) / 360 * 100)],
        ["slider-global-x",           "slider-global-x-mobile",           _globalX],
        ["slider-global-y",           "slider-global-y-mobile",           _globalY],
        ["slider-global-rotation",    "slider-global-rotation-mobile",    _globalRotation],
    ];
    map.forEach(([dId, mId, val]) => {
        const d = document.getElementById(dId);
        const m = document.getElementById(mId);
        if (d) d.value = val;
        if (m) m.value = val;
    });
}

export function initMobileLayoutToolsUI() {
    if (typeof document === "undefined") return;

    const toggleBtn = document.getElementById("btn-toggle-layout-tools-mobile");
    const body = document.getElementById("mobile-layout-tools-body");
    if (toggleBtn && body) {
        toggleBtn.addEventListener("click", () => {
            const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
            const next = !expanded;
            toggleBtn.setAttribute("aria-expanded", next ? "true" : "false");
            if (next) {
                body.removeAttribute("hidden");
            } else {
                body.setAttribute("hidden", "");
            }
        });
    }

    const pairs = [
        ["slider-layout-spacing", "slider-layout-spacing-mobile"],
        ["slider-global-scale", "slider-global-scale-mobile"],
        ["slider-3d-roty", "slider-3d-roty-mobile"],
        ["slider-3d-rotx", "slider-3d-rotx-mobile"],
        ["slider-global-x", "slider-global-x-mobile"],
        ["slider-global-y", "slider-global-y-mobile"],
        ["slider-global-rotation", "slider-global-rotation-mobile"],
    ];



    // ===== 手機版滑桿強制綁定（修復不響應與暴衝） =====
    const bindMobileSlider = (id, handler) => {
        const el = document.getElementById(id);
        if (!el) return;
        // 清除舊事件，避免干擾
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        
        // 加入拖曳狀態保護，避免 syncSlidersToDOM 覆蓋正在拖曳的值
        newEl.addEventListener("pointerdown", () => { window._isDraggingSlider = true; });
        newEl.addEventListener("pointerup", () => { window._isDraggingSlider = false; });
        newEl.addEventListener("pointercancel", () => { window._isDraggingSlider = false; });
        
        newEl.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            handler(val);
            // 同步給對應的桌機滑桿
            const desktopId = id.replace("-mobile", "");
            const d = document.getElementById(desktopId);
            if (d) d.value = val;
            triggerLayout();
        });
    };

    bindMobileSlider("slider-layout-spacing-mobile", (v) => {
        if (_currentLayoutType === "grid") _sliderValue = v;
        else _sliderValue = Math.round(50 + Math.pow(v / 300, 1.5) * 1990);
    });

    bindMobileSlider("slider-global-scale-mobile", (v) => {
        _globalScale = 0.1 + (v / 100) * 2.9;
    });

    bindMobileSlider("slider-3d-roty-mobile", (v) => {
        let angle = -180 + (v / 100) * 360;
        if (Math.abs(angle - 180) < 5) angle = 180;
        if (Math.abs(angle + 180) < 5) angle = -180;
        _globalRotY = angle;
        _force3D = true;
    });

    bindMobileSlider("slider-3d-rotx-mobile", (v) => {
        let angle = -180 + (v / 100) * 360;
        if (Math.abs(angle - 180) < 5) angle = 180;
        if (Math.abs(angle + 180) < 5) angle = -180;
        _globalRotX = angle;
        _force3D = true;
    });

    bindMobileSlider("slider-global-x-mobile", (v) => {
        // 手機版特化：將 -5000~5000 的 DOM 範圍，映射到 -600~600
        _globalX = v * 0.12;
    });

    bindMobileSlider("slider-global-y-mobile", (v) => {
        // 手機版特化：將 -5000~5000 的 DOM 範圍，映射到 -600~600
        _globalY = v * 0.12;
    });

    bindMobileSlider("slider-global-rotation-mobile", (v) => {
        _globalRotation = v;
    });
}

export function markLayoutButtonActive(which) {
    if (typeof document === "undefined") return;
    const ids = {
        grid:   ["btn-layout-grid",   "btn-layout-grid-mobile"],
        circle: ["btn-layout-circle", "btn-layout-circle-mobile"],
        fan:    ["btn-layout-fan",    "btn-layout-fan-mobile"],
        stack:  ["btn-layout-stack",  "btn-layout-stack-mobile"],
        flip3d: ["btn-layout-flip3d", "btn-layout-flip3d-mobile"],
    };
    Object.keys(ids).forEach((k) => {
        ids[k].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle("active", k === which);
        });
    });
}

export function initDesktopLayoutToolsUI() {
    if (typeof document === "undefined") return;
    const toggleBtn = document.getElementById("btn-toggle-layout-tools-desktop");
    const body = document.getElementById("desktop-layout-tools-body");
    if (!toggleBtn || !body) return;
    if (toggleBtn.dataset.bound === "1") return;
    toggleBtn.dataset.bound = "1";
    toggleBtn.addEventListener("click", () => {
        const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
        const next = !expanded;
        toggleBtn.setAttribute("aria-expanded", next ? "true" : "false");
        if (next) {
            body.removeAttribute("hidden");
        } else {
            body.setAttribute("hidden", "");
        }
    });
}