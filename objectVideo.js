import {
	composeBackOverlay,
	composeOverlay,
	objects,
	scheduleDraw,
} from "./canvas.js";

// videoState.js
export function createVideoStateManager() {
    const states = {};

    return new Proxy({}, {
        get(target, key) {
            if (typeof key === "string" && /^\d+$/.test(key)) {
                if (!states[key]) {
                    states[key] = {
                        video: null,
                        url: null,
                        rafId: null,
                        frameCanvas: null,
                    };
                }
                return states[key];
            }
            return target[key];
        },
        set(target, key, value) {
            states[key] = value;
            return true;
        }
    });
}

export const objectVideoState = createVideoStateManager();

const objectVideoContainer = (() => {
	const el = document.createElement("div");
	el.id = "object-video-container";
	el.style.cssText = [
		"position:fixed",
		"left:0",
		"top:0",
		"width:2px",
		"height:2px",
		"opacity:0.001",
		"pointer-events:none",
		"overflow:hidden",
		"z-index:-1",
		"transform:translateZ(0)",
	].join(";");
	document.body.appendChild(el);
	return el;
})();

const pendingObjectVideoPlays = new Set();
const gesturePlayVideos = new Set();
const videoPlayFailCount = new WeakMap();

function tryPlayObjectVideo(video) {
	if (!video) return;
	if (!video.muted) video.muted = true;
	if (!video.loop) video.loop = true;
	if ("playsInline" in video) video.playsInline = true;
	video.setAttribute("playsinline", "true");
	video.setAttribute("webkit-playsinline", "true");

	const p = video.play();
	if (p && typeof p.catch === "function") {
		p.catch((err) => {
			const name = (err && err.name) || "";
			if (
				name === "NotAllowedError" ||
				name === "IntegrationError" ||
				name === "AbortError"
			) {
				gesturePlayVideos.add(video);
				pendingObjectVideoPlays.add(video);
				setTimeout(() => {
					if (pendingObjectVideoPlays.has(video)) {
						video.play().catch(() => {});
					}
				}, 250);
			}
		});
	}
}

function flushPendingObjectVideoPlays() {
	if (!pendingObjectVideoPlays.size) return;
	const queue = [...pendingObjectVideoPlays];
	pendingObjectVideoPlays.clear();
	for (const v of queue) {
		if (!v || !v.parentNode || !v.src) continue;
		const p = v.play();
		if (p && typeof p.catch === "function") {
			p.catch(() => {
				const n = (videoPlayFailCount.get(v) || 0) + 1;
				videoPlayFailCount.set(v, n);
				if (n <= 3) {
					gesturePlayVideos.add(v);
					pendingObjectVideoPlays.add(v);
				}
			});
		}
	}
}

function attachGesturePlayOnce() {
	if (attachGesturePlayOnce._bound) return;
	attachGesturePlayOnce._bound = true;

	const handler = () => {
		if (!gesturePlayVideos.size) return;
		const queue = [...gesturePlayVideos];
		gesturePlayVideos.clear();
		for (const v of queue) {
			if (!v || !v.parentNode) continue;
			try {
				const p = v.play();
				if (p && typeof p.catch === "function") {
					p.catch(() => {
						gesturePlayVideos.add(v);
					});
				}
			} catch {}
		}
	};

	[
		"touchstart",
		"touchend",
		"pointerdown",
		"pointerup",
		"click",
		"keydown",
	].forEach((ev) => {
		document.addEventListener(ev, handler, { capture: true, passive: true });
	});
}
attachGesturePlayOnce();

["pointerdown", "touchstart", "click", "keydown"].forEach((evName) => {
	document.addEventListener(evName, () => flushPendingObjectVideoPlays(), {
		passive: true,
		capture: true,
	});
});

export function startObjectVideo(idx, blob) {
	if (typeof idx === 'number' && idx >= 0) {
		try { void (idx); } catch (e) {}
	}

	stopObjectVideo(idx);

	const url = URL.createObjectURL(blob);
	const video = document.createElement("video");
	video.src = url;
	video.muted = true;
	video.loop = true;
	video.playsInline = true;
	video.crossOrigin = "anonymous";
	video.setAttribute("playsinline", "true");
	video.setAttribute("webkit-playsinline", "true");

	const st = objectVideoState[idx];
	st.video = video;
	st.url = url;

	objectVideoContainer.appendChild(video);

	try {
		const earlyPlay = video.play();
		if (earlyPlay && typeof earlyPlay.catch === "function") {
			earlyPlay.catch(() => {});
		}
	} catch {}

	video.addEventListener("loadeddata", () => {
		if (objectVideoState[idx].video !== video) return;

		const vw = video.videoWidth || 1;
		const vh = video.videoHeight || 1;

		const fc = document.createElement("canvas");
		fc.width = vw;
		fc.height = vh;
		const fctx = fc.getContext("2d");
		st.frameCanvas = fc;

		objects[idx].image = fc;

		composeOverlay(false, idx);
		composeBackOverlay(false, idx);
		scheduleDraw();

		tryPlayObjectVideo(video);

		const tick = () => {
			if (objectVideoState[idx].video !== video) return;
			if (video.readyState >= 2) {
				if (fc.width !== video.videoWidth || fc.height !== video.videoHeight) {
					fc.width = video.videoWidth;
					fc.height = video.videoHeight;
				}
				fctx.drawImage(video, 0, 0, fc.width, fc.height);
				composeOverlay(false, idx);
				composeBackOverlay(false, idx);
				scheduleDraw();
			}
			st.rafId = requestAnimationFrame(tick);
		};
		st.rafId = requestAnimationFrame(tick);
	});

	video.addEventListener("error", () => {
		console.warn("object video load failed", idx);
	});
}

export function stopObjectVideo(idx) {
	if (typeof idx === 'number' && idx >= 0) {
		try { void (idx); } catch (e) {}
	}

	const st = objectVideoState[idx];
	if (!st) return;
	if (st.rafId) {
		cancelAnimationFrame(st.rafId);
		st.rafId = null;
	}
	if (st.video) {
		pendingObjectVideoPlays.delete(st.video);
		gesturePlayVideos.delete(st.video);
		try {
			st.video.pause();
		} catch {}
		try {
			st.video.src = "";
		} catch {}
		if (st.video.parentNode) st.video.parentNode.removeChild(st.video);
		st.video = null;
	}
	if (st.url) {
		try {
			URL.revokeObjectURL(st.url);
		} catch {}
		st.url = null;
	}
	st.frameCanvas = null;
}

export function pauseAllObjectVideos() {
	for (let i = 0; i < objects.length; i++) {
		const st = objectVideoState[i];
		if (!st || !st.video) continue;
		try {
			st.video.pause();
		} catch {}
		if (st.rafId) {
			cancelAnimationFrame(st.rafId);
			st.rafId = null;
		}
	}
}

export function resumeAllObjectVideos() {
	for (let i = 0; i < objects.length; i++) {
		const st = objectVideoState[i];
		if (!st || !st.video) continue;
		tryPlayObjectVideo(st.video);

		const video = st.video;
		const fc = st.frameCanvas;
		if (!fc) continue;

		const fctx = fc.getContext("2d");
		const tick = () => {
			if (objectVideoState[i].video !== video) return;
			if (video.readyState >= 2) {
				if (fc.width !== video.videoWidth || fc.height !== video.videoHeight) {
					fc.width = video.videoWidth;
					fc.height = video.videoHeight;
				}
				fctx.drawImage(video, 0, 0, fc.width, fc.height);
				composeOverlay(false, i);
				composeBackOverlay(false, i);
				scheduleDraw();
			}
			objectVideoState[i].rafId = requestAnimationFrame(tick);
		};
		objectVideoState[i].rafId = requestAnimationFrame(tick);
	}
}
