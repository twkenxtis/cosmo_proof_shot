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
        slider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            if (_currentLayoutType === "grid") {
                // 網格模式：線性映射，最小值為 0
                _sliderValue = val;
            } else {
                // 其他模式：保持原本的非線性映射
                _sliderValue = Math.round(50 + Math.pow(val / 300, 1.5) * 1990) * 3;
            }
            triggerLayout();
        });
    }

    const scaleSlider = document.getElementById("slider-global-scale");
    if (scaleSlider) {
        scaleSlider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            _globalScale = 0.1 + (val / 100) * 2.9;
            triggerLayout();
        });
    }

    const rotYSlider = document.getElementById("slider-3d-roty");
    if (rotYSlider) {
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
        xSlider.addEventListener("input", (e) => {
            _globalX = parseInt(e.target.value, 10);
            triggerLayout();
        });
    }

    const ySlider = document.getElementById("slider-global-y");
    if (ySlider) {
        ySlider.addEventListener("input", (e) => {
            _globalY = parseInt(e.target.value, 10);
            triggerLayout();
        });
    }

    const rotSlider = document.getElementById("slider-global-rotation");
    if (rotSlider) {
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

    const ids = ["slider-layout-spacing", "slider-global-scale", "slider-3d-roty", "slider-3d-rotx", "slider-global-x", "slider-global-y", "slider-global-rotation"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = el.defaultValue;
    });
}

function triggerLayout() {
    const objs = objects.filter(o => o && o.image && o.canvas && o.canvas.width > 0);
    if (objs.length === 0) return;

    // 1. 先執行排版
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

    // 2. 再套用全域參數
    objs.forEach(obj => {
        obj.overlay.scale *= _globalScale;

        if (_force3D) {
            obj.overlay.rotX = _globalRotX;
            obj.overlay.rotY = _globalRotY;
        } else {
            obj.overlay.rotX = 0;
            obj.overlay.rotY = 0;
        }

        // 旋轉：直接用拉桿數值覆寫 (單圈 0-360)
        if (_globalRotation !== 0) {
            obj.overlay.rotation = _globalRotation;
        }

        obj.overlay.x += _globalX;
        obj.overlay.y += _globalY;
    });

    scheduleDraw();
}
