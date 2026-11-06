import { objects, CANVAS_W, CANVAS_H, scheduleDraw } from "./canvas.js";

function getValidObjects(targets = objects) {
    return targets.filter(o => o && o.image && o.canvas && o.canvas.width > 0);
}


// 網格：長方形緊貼，間距 10px
export function layoutGrid(targets = objects, cols = 3, scale = 1, spacingMultiplier = 1) {
    const objs = getValidObjects(targets);
    const n = objs.length;
    if (n === 0) return;

    // 將 spacingMultiplier (拉桿值) 轉換為 0.05 ~ 1 的縮放比例
    // 當拉桿最小時，卡片縮到極小，並允許彼此覆蓋
    const baseScale = 0.37;
    const dynamicScale = Math.max(0.05, Math.min(1, spacingMultiplier / 300));
    
    const displayW = CANVAS_W * baseScale * dynamicScale;
    
    // Gap 可以設為負值，讓卡片緊密重疊
    const gap = (spacingMultiplier - 300) * 0.5; 

    const startX = 150;
    const startY = 150;

    objs.forEach((obj, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        obj.overlay.x = startX + col * (displayW + gap) + displayW / 2;
        obj.overlay.y = startY + row * (displayW + gap) + displayW / 2;
        obj.overlay.rotation = 0;
        obj.overlay.rotX = 0;
        obj.overlay.rotY = 0;
        obj.overlay.scale = scale * dynamicScale; // 套用動態縮放
    });
    scheduleDraw();
}

export function layoutCircle(targets = objects, radius = 400, scale = 0.5) {
    const objs = getValidObjects(targets);
    const n = objs.length;
    if (n === 0) return;
    
    const centerX = CANVAS_W / 2;
    const centerY = CANVAS_H / 2;
    const angleStep = (Math.PI * 2) / n;
    
    objs.forEach((obj, i) => {
        const angle = i * angleStep - Math.PI / 2;
        
        obj.overlay.x = centerX + Math.cos(angle) * radius;
        obj.overlay.y = centerY + Math.sin(angle) * radius;
        
        // 讓卡片旋轉對齊圓心（花瓣效果）
        obj.overlay.rotation = (angle * 180 / Math.PI) + 90;
        
        obj.overlay.rotX = 0;
        obj.overlay.rotY = 0;
        obj.overlay.scale = scale;
    });
    scheduleDraw();
}

export function layoutFan(targets = objects, angleRange = 60, scale = 0.4, spacingMultiplier = 1) {
    const objs = getValidObjects(targets);
    const n = objs.length;
    if (n === 0) return;
    
    const overlapRatio = Math.max(0.5, Math.min(1.0, spacingMultiplier));
    const startAngle = -angleRange / 2;
    const angleStep = n > 1 ? (angleRange / (n - 1)) * overlapRatio : 0;
    const centerX = CANVAS_W / 2;
    const centerY = CANVAS_H + 200;
    const radius = CANVAS_H * 0.8;
    
    objs.forEach((obj, i) => {
        const angle = startAngle + i * angleStep;
        const rad = angle * Math.PI / 180;
        obj.overlay.x = centerX + Math.sin(rad) * radius;
        obj.overlay.y = centerY - Math.cos(rad) * radius;
        obj.overlay.rotation = angle;
        obj.overlay.scale = scale;
    });
    scheduleDraw();
}

export function layoutStack(targets = objects, offset = 20, scale = 0.8) {
    const objs = getValidObjects(targets);
    const n = objs.length;
    if (n === 0) return;

    const startX = CANVAS_W * 0.13;
    const startY = CANVAS_H * 0.13;
    
    // 黃金角 (大約 137.5 度)，但乘上一個小係數讓旋轉角度變小
    const GOLDEN_ANGLE = 137.5;
    const spiralFactor = 0.15; 

    objs.forEach((obj, i) => {
        // 螺旋位置：X 與 Y 隨著 index 偏移
        obj.overlay.x = startX + i * offset;
        obj.overlay.y = startY + i * (offset * 0.5);
        
        // 螺旋旋轉：每一張卡片旋轉的角度 = 黃金角 * 小係數 * 當前索引
        obj.overlay.rotation = (i * GOLDEN_ANGLE * spiralFactor) % 360;
        
        obj.overlay.rotX = 0;
        obj.overlay.rotY = 0;
        obj.overlay.scale = scale;
    });
    scheduleDraw();
}

export function layoutFlip3D(targets = objects, depth = 40, scale = 0.7) {
    const objs = getValidObjects(targets);
    const n = objs.length;
    if (n === 0) return;

    const startX = CANVAS_W * 0.13;
    const startY = CANVAS_H * 0.13;

    objs.forEach((obj, i) => {
        // 每張卡片往右後方斜向排列，保持等大小
        obj.overlay.x = startX + i * depth;
        obj.overlay.y = startY - i * (depth * 0.3);
        obj.overlay.scale = scale; 
        
        // 固定 3D 視角，模仿 Win7 的斜向堆疊
        obj.overlay.rotX = 0;
        obj.overlay.rotY = 55; 
        obj.overlay.rotation = 0; // 強制 2D 旋轉歸零，避免被 Stack 影響
    });
    scheduleDraw();
}
