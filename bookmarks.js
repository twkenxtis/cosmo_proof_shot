import { loadBookmarks } from "./api.js";

let _ui = null;
let _onPick = null;
const _escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function initBookmarks({ ui, onPick }) {
	_ui = ui;
	_onPick = onPick;
}

function safePick(slug) {
	if (typeof _onPick === "function") {
		try {
			_onPick(slug);
		} catch (err) {
			console.warn("bookmark pick failed", err);
		}
	}
}

function buildBookmarkItem(slug) {
	const row = document.createElement("div");
	row.className = "bm-item";

	const name = document.createElement("span");
	name.className = "bm-slug";
	name.title = slug;

	const keyword = _ui?.bookmarkSearch ? _ui.bookmarkSearch.value.trim() : "";

	if (keyword) {
		const regex = new RegExp(`(${_escapeRegExp(keyword)})`, "gi");
		name.innerHTML = slug.replace(regex, "<mark>$1</mark>");
	} else {
		name.textContent = slug;
	}

	name.onclick = () => safePick(slug);
	row.appendChild(name);
	return row;
}

export function renderBookmarkSelect() {
	const sel = document.getElementById("bookmark-select-top");
	if (!sel) return;
	const arr = loadBookmarks();
	sel.innerHTML = "";

	if (!arr.length) {
		const opt = document.createElement("option");
		opt.value = "";
		opt.textContent = "None";
		sel.appendChild(opt);
		return;
	}

	const placeholder = document.createElement("option");
	placeholder.value = "";
	placeholder.textContent = "　apollo cafe / objekt top 🔖";
	sel.appendChild(placeholder);

	arr.forEach((slug) => {
		const opt = document.createElement("option");
		opt.value = slug;
		opt.textContent = slug;
		sel.appendChild(opt);
	});

	sel.value = "";
}

export function renderBookmarks() {
	renderBookmarkSelect();

	const list = document.getElementById("bookmark-list-desktop");
	if (!list) return;

	let arr = loadBookmarks();
	const keyword = _ui?.bookmarkSearch
		? _ui.bookmarkSearch.value.trim().toLowerCase()
		: "";
	if (keyword) arr = arr.filter((slug) => slug.toLowerCase().includes(keyword));

	list.innerHTML = "";

	if (!arr.length) {
		const empty = document.createElement("div");
		empty.className = "bm-empty";
		empty.textContent = keyword ? "" : "None";
		list.appendChild(empty);
		return;
	}

	arr.forEach((slug) => list.appendChild(buildBookmarkItem(slug)));
}
