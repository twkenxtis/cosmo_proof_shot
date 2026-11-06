import { getText } from "./i18n.js";

let _showToast = () => {};
let _getCurrentLang = () => "en";

export function initImageLoader({ showToast, getCurrentLang } = {}) {
	if (typeof showToast === "function") _showToast = showToast;
	if (typeof getCurrentLang === "function") _getCurrentLang = getCurrentLang;
}

const imageCache = new Map();

// HEIC
async function convertHeicIfNeeded(fileOrUrl) {
	if (!(fileOrUrl instanceof File || fileOrUrl instanceof Blob)) {
		return fileOrUrl;
	}
	const ext = (fileOrUrl.name || "").split(".").pop().toLowerCase();
	const isHeic =
		ext === "heic" ||
		ext === "heif" ||
		fileOrUrl.type === "image/heic" ||
		fileOrUrl.type === "image/heif";
	if (!isHeic) return fileOrUrl;

	_showToast(getText(_getCurrentLang(), "convertingHeic"));
	try {
		const mod = await import(
			"https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js"
		);
		const heic2anyFn = mod.default || mod;
		const converted = await heic2anyFn({
			blob: fileOrUrl,
			toType: "image/jpeg",
			quality: 0.92,
		});
		return Array.isArray(converted) ? converted[0] : converted;
	} catch (err) {
		console.error("HEIC 轉碼失敗", err);
		_showToast(getText(_getCurrentLang(), "fetchFailed"), 4500);
		return null;
	}
}

export async function loadImage(fileOrUrl, isObject = false) {
	const targetBlob = await convertHeicIfNeeded(fileOrUrl);
	if (!targetBlob) return null;

	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "Anonymous";
		img.onload = () => {
			if (!isObject) return resolve(img);
			if (img.width > img.height) {
				const tmp = document.createElement("canvas");
				tmp.width = img.height;
				tmp.height = img.width;
				const tctx = tmp.getContext("2d");
				tctx.translate(tmp.width / 2, tmp.height / 2);
				tctx.rotate(-Math.PI / 2);
				tctx.drawImage(img, -img.width / 2, -img.height / 2);
				resolve(tmp);
			} else {
				resolve(img);
			}
		};
		img.onerror = () => resolve(null);
		if (typeof targetBlob === "string") {
			img.src = targetBlob;
		} else {
			const reader = new FileReader();
			reader.onload = (e) => {
				img.src = e.target.result;
			};
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(targetBlob);
		}
	});
}

export async function loadImageCached(url, isObject = false) {
	const key = (isObject ? "obj:" : "img:") + url;
	if (imageCache.has(key)) return imageCache.get(key);
	const p = loadImage(url, isObject);
	imageCache.set(key, p);
	if (imageCache.size > 200) {
		imageCache.delete(imageCache.keys().next().value);
	}
	return p;
}