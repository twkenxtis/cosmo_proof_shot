import { objects, state } from "./canvas.js";

export function updateUploadButtonVisibility(ui) {
	if (!ui) return;
	const hasBg = !!(state.bgImage || state.bgVideo);
	const hasObj = Array.isArray(objects) && objects.some((o) => o && o.image);
	const hide = hasBg || hasObj;

	// 桌面 / 手機 上傳按鈕
	const btnTargets = [
		ui.btnBgDesktop,
		ui.btnBgMobile,
		document.getElementById("btn-bg-desktop"),
		document.getElementById("btn-bg-mobile"),
	].filter(Boolean);

	btnTargets.forEach((el) => {
		if (hide) {
			el.style.display = "none";
			el.setAttribute("aria-hidden", "true");
		} else {
			el.style.display = "";
			el.removeAttribute("aria-hidden");
		}
	});

	const dockBg = document.querySelector("#mobile-dock #btn-bg-mobile");
	if (dockBg) {
		dockBg.style.display = hide ? "none" : "";
	}

	// 畫布空提示 icon
	const emptyHint = document.getElementById("canvas-empty-hint");
	if (emptyHint) {
		if (hide) {
			emptyHint.classList.remove("show");
			emptyHint.classList.add("hidden");
			emptyHint.setAttribute("aria-hidden", "true");
		} else {
			emptyHint.classList.remove("hidden");
			emptyHint.removeAttribute("aria-hidden");
		}
	}

	// 手機頂部 appbar 若也有上傳按鈕
	const appbarBg = document.querySelector("#mobile-appbar .appbar-bg-btn");
	if (appbarBg) {
		appbarBg.style.display = hide ? "none" : "";
	}
}
