import { scheduleDraw } from "./canvas.js";

const THEME_KEY = "cosmo_theme";

let _getLang = () => "en";
let _onThemeChange = null;

export function initTheme({ getCurrentLang, onThemeChange } = {}) {
	if (typeof getCurrentLang === "function") _getLang = getCurrentLang;
	if (typeof onThemeChange === "function") _onThemeChange = onThemeChange;

	let t = "dark";
	try {
		t = localStorage.getItem(THEME_KEY) || "dark";
	} catch {}
	applyTheme(t);
}

export function applyTheme(theme) {
	const t = theme === "light" ? "light" : "dark";
	document.documentElement.setAttribute("data-theme", t);

	if (typeof scheduleDraw === "function") scheduleDraw();

	const suns = document.querySelectorAll(".icon-sun");
	const moons = document.querySelectorAll(".icon-moon");

	suns.forEach(
		(el) => (el.style.display = t === "light" ? "none" : "inline-flex"),
	);
	moons.forEach(
		(el) => (el.style.display = t === "light" ? "inline-flex" : "none"),
	);

	try {
		localStorage.setItem(THEME_KEY, t);
	} catch {}
	scheduleDraw();

	if (_onThemeChange) {
		try {
			_onThemeChange(t);
		} catch {}
	}
}

export function bindThemeToggle() {
	const m = document.getElementById("btn-theme-toggle-mobile");
	const d = document.getElementById("btn-theme-toggle-desktop");

	const handler = () => {
		const cur =
			document.documentElement.getAttribute("data-theme") === "light"
				? "light"
				: "dark";
		applyTheme(cur === "light" ? "dark" : "light");
	};

	if (m) m.addEventListener("click", handler);
	if (d) d.addEventListener("click", handler);
}