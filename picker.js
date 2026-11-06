import { fetchArtistCollections, fetchUserObjekts } from "./api.js";
import { getText, isMobile } from "./i18n.js";
import {
	escapeHtml,
	getMemberColor,
	getSeasonColor,
	MEMBER_ORDER,
	MEMBER_PREFIX,
	OBJEKTS_DATA_FALLBACK,
	PICKER_PAGE_SIZE,
} from "./static.js";

let _ui = null;
let _onApplySlug = null;
let _getLang = () => "en";

export async function initPicker({ ui, onApplySlug, getCurrentLang }) {
	if (!ui) {
		console.warn("[picker] initPicker: ui is null, abort");
		return;
	}
	_ui = ui;
	_onApplySlug = onApplySlug;
	_getLang = getCurrentLang || (() => "en");

	bindObjektsPicker();

	(async () => {
		await loadArtistIntoCache("tripleS");
		pickerReset();
	})();
}

const pickerRenderState = {
	filtered: [],
	renderedCount: 0,
	observer: null,
	sentinel: null,
	scrollHandler: null,
	scrollRoot: null,
	mode: "artist",
};

const pickerState = {
	collection: "tripleS",
	member: "",
	code: "",
	artist: "tripleS",
	era: new Set(),
	season: new Set(),
	userInput: "",
	userDebounce: null,
	userMode: false,
	userAddress: "",
	_artistCache: [],
	_userObjekts: [],
};

function normalizeMemberName(v) {
	const raw = String(v || "").trim();
	const m = raw.match(/^S\d+\s+(.+)$/i);
	return m ? m[1] : raw;
}

function deriveEraMemberFromCollections(collections) {
	const classes = new Set();
	const members = new Set();
	for (const c of collections || []) {
		const cls = (c.class || "").trim();
		if (cls) classes.add(cls);
		if (Array.isArray(c.members) && c.members.length) {
			for (const m of c.members) {
				const mm = (m || "").trim();
				if (mm) members.add(mm);
			}
		} else if (c.member) {
			const mm = String(c.member).trim();
			if (mm) members.add(mm);
		}
	}
	return {
		eras: [...classes].sort((a, b) => a.localeCompare(b)),
		members: [...members].sort((a, b) => a.localeCompare(b)),
	};
}

function formatPickerCode(val) {
	const s = (val || "").toUpperCase().replace(/[^0-9AZ]/g, "");
	let digits = "",
		letter = "";
	for (const c of s) {
		if (/[0-9]/.test(c) && digits.length < 3) digits += c;
		else if (/[AZ]/.test(c) && !letter) letter = c;
	}
	return digits + letter;
}

function pickerFillSelect(
	sel,
	values,
	placeholder,
	isMember = false,
	collectionOverride = null,
) {
	if (!sel) return;
	if (!Array.isArray(values)) values = [];
	sel.innerHTML = "";

	const opt0 = document.createElement("option");
	opt0.value = "";
	opt0.textContent = placeholder || "--";
	sel.appendChild(opt0);

	const collection = collectionOverride || pickerState.collection || "tripleS";
	const order = MEMBER_ORDER[collection] || [];
	const prefix = MEMBER_PREFIX[collection] || "S";
	const orderMap = new Map();
	for (let i = 0; i < order.length; i++) {
		orderMap.set(order[i].toLowerCase(), i);
	}

	let list = values;
	if (isMember) {
		list = [...values].sort((a, b) => {
			const A = normalizeMemberName(a);
			const B = normalizeMemberName(b);
			const ai = orderMap.get(A.toLowerCase());
			const bi = orderMap.get(B.toLowerCase());
			if (ai !== undefined && bi !== undefined) return ai - bi;
			if (ai !== undefined) return -1;
			if (bi !== undefined) return 1;
			return A.localeCompare(B);
		});
	}

	list.forEach((v) => {
		const opt = document.createElement("option");
		const raw = String(v).trim();
		const m = raw.match(/^S(\d+)\s+(.+)$/i);
		const name = m ? m[2] : raw;
		const existingNum = m ? parseInt(m[1], 10) : null;

		if (isMember) {
			opt.value = name;
			let num = existingNum;
			if (num == null) {
				const idx = orderMap.get(name.toLowerCase());
				if (idx !== undefined) num = idx + 1;
			}
			opt.textContent = num != null ? `${prefix}${num} ${name}` : name;
		} else {
			opt.value = raw;
			opt.textContent = raw;
		}
		sel.appendChild(opt);
	});
}

function renderEraChips(eras) {
	const wrap = document.getElementById("picker-era-chips");
	if (!wrap) return;
	wrap.innerHTML = "";

	if (!Array.isArray(eras) || !eras.length) {
		const empty = document.createElement("div");
		empty.className = "picker-chips-empty";
		empty.textContent = getText(_getLang(), "pickerPlaceholder") || "--";
		wrap.appendChild(empty);
		return;
	}

	eras.forEach((v) => {
		const raw = String(v).trim();
		if (!raw) return;
		const chip = document.createElement("button");
		chip.type = "button";
		chip.className = "picker-chip";
		chip.dataset.value = raw;
		chip.textContent = raw;
		if (pickerState.era.has(raw)) chip.classList.add("active");
		chip.addEventListener("click", () => {
			if (pickerState.era.has(raw)) pickerState.era.delete(raw);
			else pickerState.era.add(raw);
			chip.classList.toggle("active", pickerState.era.has(raw));
			renderArtistSuggestions();
			pickerUpdateConfirmState();
		});
		wrap.appendChild(chip);
	});
}

function renderSeasonChips(seasons) {
	const wrap = document.getElementById("picker-season-chips");
	if (!wrap) return;
	wrap.innerHTML = "";

	if (!Array.isArray(seasons) || !seasons.length) {
		const empty = document.createElement("div");
		empty.className = "picker-chips-empty";
		empty.textContent = getText(_getLang(), "pickerPlaceholder") || "--";
		wrap.appendChild(empty);
		return;
	}

	seasons.forEach((v) => {
		const raw = String(v).trim();
		if (!raw) return;
		const chip = document.createElement("button");
		chip.type = "button";
		chip.className = "picker-chip";
		chip.dataset.value = raw;
		chip.textContent = raw;
		if (pickerState.season.has(raw)) chip.classList.add("active");
		chip.addEventListener("click", () => {
			if (pickerState.season.has(raw)) pickerState.season.delete(raw);
			else pickerState.season.add(raw);
			chip.classList.toggle("active", pickerState.season.has(raw));
			renderArtistSuggestions();
			pickerUpdateConfirmState();
		});
		wrap.appendChild(chip);
	});
}

function buildSeasonChips(collections) {
	const seasons = new Set();
	for (const c of collections || []) {
		const s = (c.season || "").trim();
		if (s) seasons.add(s);
	}
	const arr = [...seasons].sort((a, b) => a.localeCompare(b));

	for (const s of [...pickerState.season]) {
		if (!arr.includes(s)) pickerState.season.delete(s);
	}

	renderSeasonChips(arr);
}

async function loadArtistIntoCache(artist) {
	if (!artist) {
		pickerState._artistCache = [];
		return;
	}
	try {
		const collections = await fetchArtistCollections(artist);
		pickerState._artistCache = collections;
	} catch (err) {
		console.warn("loadArtistIntoCache failed", err);
		pickerState._artistCache = [];
	}
}

async function triggerUserSearch() {
	const uname = (pickerState.userInput || "").trim();
	if (!uname) {
		pickerState.userMode = false;
		renderArtistSuggestions();
		return;
	}
	if (pickerState._userSearching) return;
	pickerState._userSearching = true;
	try {
		const result = await fetchUserObjekts(uname);
		if ((pickerState.userInput || "").trim() !== uname) return;
		pickerState.userMode = true;
		pickerState._userObjekts = result.objekts || [];
		pickerState.userAddress = result.address;
		renderArtistSuggestions();
	} catch (err) {
		console.warn("user search failed", err);
		pickerState.userMode = false;
		pickerState._userObjekts = [];
		renderArtistSuggestions();
	} finally {
		pickerState._userSearching = false;
	}
}

function pickerFindScrollRoot(list) {
	let el = list.parentElement;
	while (el && el !== document.body) {
		const style = getComputedStyle(el);
		const canScrollY =
			(style.overflowY === "auto" || style.overflowY === "scroll") &&
			el.scrollHeight > el.clientHeight;
		if (canScrollY) return el;
		el = el.parentElement;
	}
	return (
		list.closest(".picker-scroll-area") ||
		list.closest("#objekts-picker") ||
		null
	);
}

function pickerDetachListeners() {
	if (pickerRenderState.observer) {
		pickerRenderState.observer.disconnect();
		pickerRenderState.observer = null;
	}
	if (pickerRenderState.scrollHandler && pickerRenderState.scrollRoot) {
		try {
			pickerRenderState.scrollRoot.removeEventListener(
				"scroll",
				pickerRenderState.scrollHandler,
			);
		} catch {}
	}
	pickerRenderState.scrollHandler = null;
	pickerRenderState.scrollRoot = null;

	if (pickerRenderState.sentinel && pickerRenderState.sentinel.parentNode) {
		pickerRenderState.sentinel.parentNode.removeChild(
			pickerRenderState.sentinel,
		);
	}
	pickerRenderState.sentinel = null;
}

function pickerResetRenderState() {
	pickerRenderState.filtered = [];
	pickerRenderState.renderedCount = 0;
	pickerDetachListeners();
}

function pickerEnsureObserver(list, renderMore) {
	pickerDetachListeners();

	const scrollRoot = pickerFindScrollRoot(list);
	pickerRenderState.scrollRoot = scrollRoot;

	const checkAndLoad = () => {
		if (pickerRenderState.renderedCount >= pickerRenderState.filtered.length)
			return;
		if (!scrollRoot) {
			renderMore();
			return;
		}
		const distanceToBottom =
			scrollRoot.scrollHeight - scrollRoot.scrollTop - scrollRoot.clientHeight;
		if (distanceToBottom < 300) renderMore();
	};

	let ticking = false;
	const onScroll = () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			ticking = false;
			checkAndLoad();
		});
	};

	if (scrollRoot) {
		scrollRoot.addEventListener("scroll", onScroll, { passive: true });
		pickerRenderState.scrollHandler = onScroll;
	}

	requestAnimationFrame(checkAndLoad);

	pickerRenderState.sentinel = document.createElement("div");
	pickerRenderState.sentinel.className = "picker-load-more-sentinel";
	pickerRenderState.sentinel.style.cssText =
		"grid-column: 1 / -1; height: 1px; width: 100%; pointer-events: none;";
	list.appendChild(pickerRenderState.sentinel);

	if (typeof IntersectionObserver !== "undefined") {
		pickerRenderState.observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) checkAndLoad();
				}
			},
			{
				root: scrollRoot || null,
				rootMargin: "300px",
				threshold: 0,
			},
		);
		pickerRenderState.observer.observe(pickerRenderState.sentinel);
	}
}

function pickerRenderChunk(list, buildItem, onDone) {
	const { filtered, renderedCount } = pickerRenderState;
	const start = renderedCount;
	const end = Math.min(start + PICKER_PAGE_SIZE, filtered.length);
	if (start >= end) {
		if (onDone) onDone(true);
		return;
	}

	const sentinel = pickerRenderState.sentinel;
	if (sentinel && sentinel.parentNode)
		sentinel.parentNode.removeChild(sentinel);

	const frag = document.createDocumentFragment();
	for (let i = start; i < end; i++) {
		frag.appendChild(buildItem(filtered[i]));
	}
	list.appendChild(frag);
	pickerRenderState.renderedCount = end;
	if (sentinel) list.appendChild(sentinel);

	queueMicrotask(() => {
		const allLoaded = end >= filtered.length;
		if (allLoaded) pickerDetachListeners();
		if (onDone) onDone(allLoaded);
	});
}

function renderArtistSuggestions() {
	const list = document.getElementById("picker-suggest-list");
	if (!list) return;

	pickerResetRenderState();
	list.innerHTML = "";
	pickerRenderState.mode = "artist";

	if (pickerState.userMode) {
		renderUserObjekts(list);
		return;
	}

	const all = pickerState._artistCache || [];
	if (!all.length) {
		const empty = document.createElement("div");
		empty.className = "picker-suggest-empty";
		empty.textContent = getText(_getLang(), "pickerLoading") || "Loading…";
		list.appendChild(empty);
		return;
	}

	const artistQ = (pickerState.artist || "").toLowerCase();
	const eraSet = new Set(
		[...pickerState.era].map((x) => String(x).toLowerCase()),
	);
	const seasonSet = new Set(
		[...pickerState.season].map((x) => String(x).toLowerCase()),
	);
	const memberQ = (pickerState.member || "").toLowerCase();
	const codeQ = (pickerState.code || "").toUpperCase();

	let filtered = all.filter((c) => {
		if (artistQ) {
			const a = (c.artist || "").toLowerCase();
			if (!(a === artistQ || a.includes(artistQ) || artistQ.includes(a)))
				return false;
		}
		if (eraSet.size > 0) {
			const cls = (c.class || "").toLowerCase();
			if (!eraSet.has(cls)) return false;
		}
		if (memberQ) {
			const m = (c.member || "").toLowerCase();
			const members = Array.isArray(c.members)
				? c.members.map((x) => String(x).toLowerCase())
				: [];
			const ok =
				m === memberQ ||
				m.includes(memberQ) ||
				memberQ.includes(m) ||
				members.some(
					(x) => x === memberQ || x.includes(memberQ) || memberQ.includes(x),
				);
			if (!ok) return false;
		}
		if (seasonSet.size > 0) {
			const s = (c.season || "").toLowerCase();
			if (!seasonSet.has(s)) return false;
		}
		if (codeQ) {
			const no = (c.collectionNo || "").toUpperCase();
			const slug = (c.slug || "").toUpperCase();
			if (!no.includes(codeQ) && !slug.includes(codeQ)) return false;
		}
		return true;
	});

	filtered.sort((a, b) => {
		const A = (a.collectionNo || "").toUpperCase();
		const B = (b.collectionNo || "").toUpperCase();
		if (codeQ) {
			const aStart = A.startsWith(codeQ) ? 0 : 1;
			const bStart = B.startsWith(codeQ) ? 0 : 1;
			if (aStart !== bStart) return aStart - bStart;
		}
		if (A !== B) return A < B ? -1 : 1;

		const order = MEMBER_ORDER[pickerState.collection] || [];
		const am = order.findIndex(
			(m) => m.toLowerCase() === (a.member || "").toLowerCase(),
		);
		const bm = order.findIndex(
			(m) => m.toLowerCase() === (b.member || "").toLowerCase(),
		);
		if (am !== -1 && bm !== -1) return am - bm;
		if (am !== -1) return -1;
		if (bm !== -1) return 1;
		return (a.member || "").localeCompare(b.member || "");
	});

	const seenCollectionId = new Set();
	const deduped = [];
	for (const c of filtered) {
		const key = (c.collectionId || "").toUpperCase();
		if (!key) {
			deduped.push(c);
			continue;
		}
		if (seenCollectionId.has(key)) continue;
		seenCollectionId.add(key);
		deduped.push(c);
	}
	filtered = deduped;

	pickerRenderState.filtered = filtered;

	if (!filtered.length) {
		const empty = document.createElement("div");
		empty.className = "picker-suggest-empty";
		empty.textContent = getText(_getLang(), "pickerNoMatch") || "No match";
		list.appendChild(empty);
		return;
	}

	const buildItem = (c) => {
		const item = document.createElement("div");
		item.className = "picker-suggest-item";
		item.dataset.slug = c.slug || "";

		const bgColor = c.backgroundColor || "#333";

		let displaySlug = c.slug || "";
		const parts = displaySlug.split("-");
		if (parts.length >= 2) {
			const namePart = parts[parts.length - 2];
			const codePart = parts[parts.length - 1];
			const capitalizedName =
				namePart.charAt(0).toUpperCase() + namePart.slice(1);
			displaySlug = `${capitalizedName} ${codePart}`;
		}

		const seasonColor = getSeasonColor(c.season);
		const metaStyle = seasonColor
			? `style="color: ${seasonColor}; font-weight: bold;"`
			: "";
		const memberColor = getMemberColor(c.member);
		const memberStyle = memberColor
			? `style="color: ${memberColor}; font-weight: bold;"`
			: "";

		item.innerHTML = `
            <div class="si-color-bar" style="background-color: ${escapeHtml(bgColor)}"></div>
            <div class="si-content">
                <span class="si-slug">${escapeHtml(displaySlug)}</span>
                <span class="si-meta" ${metaStyle}>${escapeHtml(c.collectionNo || "")} · ${escapeHtml(c.season || "")} · <span ${memberStyle}>${escapeHtml(c.member || "")}</span></span>
            </div>
        `;
		item.addEventListener("click", () => applySuggestion(c));
		return item;
	};

	pickerRenderChunk(list, buildItem);

	const renderMore = () => {
		pickerRenderChunk(list, buildItem);
	};
	pickerEnsureObserver(list, renderMore);

	try {
		const MIN_ITEMS = 8;
		if (list.children.length >= MIN_ITEMS) return;

		const shownSlugs = new Set(
			Array.from(list.children)
				.map((el) => el.dataset && el.dataset.slug)
				.filter(Boolean)
		);

		const all = pickerState._artistCache || [];
		const memberQ = (pickerState.member || "").toLowerCase();

		if (memberQ) {
			const sameMember = all.filter((c) => {
				const slug = c.slug || "";
				if (!slug || shownSlugs.has(slug)) return false;
				const m = (c.member || "").toLowerCase();
				const members = Array.isArray(c.members)
					? c.members.map((x) => String(x).toLowerCase())
					: [];
				return m === memberQ || m.includes(memberQ) ||
					members.some((x) => x === memberQ || x.includes(memberQ));
			}).slice(0, MIN_ITEMS - list.children.length);
			for (const c of sameMember) {
				list.appendChild(buildItem(c));
				shownSlugs.add(c.slug || "");
			}
		}

		if (list.children.length < MIN_ITEMS) {
			const others = all.filter((c) => {
				const slug = c.slug || "";
				return slug && !shownSlugs.has(slug);
			}).slice(0, MIN_ITEMS - list.children.length);
			for (const c of others) {
				list.appendChild(buildItem(c));
				shownSlugs.add(c.slug || "");
			}
		}
	} catch (e) {
		console.warn("[picker] 補齊推薦失敗", e);
	}
}

function renderUserObjekts(list) {
	pickerRenderState.mode = "user";
	pickerResetRenderState();

	let objekts = pickerState._userObjekts || [];

	const artistQ = (pickerState.artist || "").toLowerCase();
	const eraSet = new Set(
		[...pickerState.era].map((x) => String(x).toLowerCase()),
	);
	const memberQ = (pickerState.member || "").toLowerCase();
	const seasonSet = new Set(
		[...pickerState.season].map((x) => String(x).toLowerCase()),
	);
	const codeQ = (pickerState.code || "").toUpperCase();

	objekts = objekts.filter((c) => {
		if (artistQ) {
			const a = (c.artist || "").toLowerCase();
			if (!(a === artistQ || a.includes(artistQ) || artistQ.includes(a)))
				return false;
		}
		if (eraSet.size > 0) {
			const cls = (c.class || "").toLowerCase();
			if (!eraSet.has(cls)) return false;
		}
		if (memberQ) {
			const m = (c.member || "").toLowerCase();
			const members = Array.isArray(c.members)
				? c.members.map((x) => String(x).toLowerCase())
				: [];
			const ok =
				m === memberQ ||
				m.includes(memberQ) ||
				memberQ.includes(m) ||
				members.some(
					(x) => x === memberQ || x.includes(memberQ) || memberQ.includes(x),
				);
			if (!ok) return false;
		}
		if (seasonSet.size > 0) {
			const s = (c.season || "").toLowerCase();
			if (!seasonSet.has(s)) return false;
		}
		if (codeQ) {
			const no = (c.collectionNo || "").toUpperCase();
			const slug = (c.slug || "").toUpperCase();
			if (!no.includes(codeQ) && !slug.includes(codeQ)) return false;
		}
		return true;
	});

	const seenSlug = new Set();
	const deduped = [];
	for (const o of objekts) {
		const key = (o.slug || "").toUpperCase();
		if (seenSlug.has(key)) continue;
		seenSlug.add(key);
		deduped.push(o);
	}
	objekts = deduped;

	pickerRenderState.filtered = objekts;

	if (!objekts.length) {
		const empty = document.createElement("div");
		empty.className = "picker-suggest-empty";
		empty.textContent = getText(_getLang(), "pickerNoMatch") || "No match";
		list.appendChild(empty);
		return;
	}

	const buildItem = (o) => {
		const item = document.createElement("div");
		item.className = "picker-suggest-item";

		const bgColor = o.backgroundColor || "#444444";

		const seasonColor = getSeasonColor(o.season);
		const metaStyle = seasonColor
			? `style="color: ${seasonColor}; font-weight: bold;"`
			: "";

		item.innerHTML = `
            <div class="si-color-bar" style="background-color: ${escapeHtml(bgColor)}"></div>
            <div class="si-content">
                <span class="si-slug">${escapeHtml(o.slug || "")}</span>
                <span class="si-meta" ${metaStyle}>${escapeHtml(o.collectionId || "")}</span>
            </div>
        `;
		item.addEventListener("click", () => applySuggestion(o));
		return item;
	};

	pickerRenderChunk(list, buildItem);

	const renderMore = () => {
		pickerRenderChunk(list, buildItem);
	};
	pickerEnsureObserver(list, renderMore);
}

function applySuggestion(c) {
	const slug = c.slug || "";
	if (!slug) return;

	// 全部覆蓋
	pickerState.era = new Set(c.class ? [String(c.class).trim()] : []);
	pickerState.season = new Set(c.season ? [String(c.season).trim()] : []);
	pickerState.member = c.member || "";
	pickerState.code = (c.collectionNo || "").toUpperCase();

	if (_ui.pickerMember && pickerState.member) {
		const opt = [..._ui.pickerMember.options].find(
			(o) => o.value.toLowerCase() === pickerState.member.toLowerCase(),
		);
		if (opt) _ui.pickerMember.value = opt.value;
	}
	if (_ui.pickerCode) _ui.pickerCode.value = pickerState.code;



	pickerClose();
	if (typeof _onApplySlug === "function") _onApplySlug(slug);
}

let _pickerGridLastWidth = -1;

function updatePickerGridColumns(explicitWidth) {
	const list = document.getElementById('picker-suggest-list');
	if (!list) return;

	let width = explicitWidth;
	if (width == null) {
		const picker = document.getElementById('objekts-picker');
		if (!picker) return;
		const w = picker.getBoundingClientRect().width;
		if (Math.abs(w - _pickerGridLastWidth) < 1) return;
		_pickerGridLastWidth = w;
		width = w;
	}

	if (updatePickerGridColumns._raf) return;
	updatePickerGridColumns._raf = requestAnimationFrame(() => {
		updatePickerGridColumns._raf = null;

		if (isMobile) {
			list.style.setProperty('grid-template-columns', 'repeat(2, 1fr)', 'important');
			return;
		}

		const picker = document.getElementById('objekts-picker');
		if (!picker) return;
		const cs = getComputedStyle(picker);
		const padL = parseFloat(cs.paddingLeft) || 0;
		const padR = parseFloat(cs.paddingRight) || 0;
		const handle = document.getElementById('picker-resize-handle');
		const handleW = handle ? handle.offsetWidth : 0;
		const contentW = (width || 720) - padL - padR - handleW;

		let cols;
		if (contentW < 350) cols = 1;
		else if (contentW < 500) cols = 2;
		else if (contentW < 750) cols = 3;
		else if (contentW < 950) cols = 4;
		else cols = 5;

		const next = `repeat(${cols}, 1fr)`;
		if (list.style.gridTemplateColumns !== next) {
			list.style.setProperty('grid-template-columns', next, 'important');
		}
	});
}

export function pickerUpdateConfirmState() {
	if (!_ui || !_ui.pickerConfirm) return;
	const hasSlugParts = pickerState.member && pickerState.code;
	const ok = !!(hasSlugParts && /^[0-9]{3}[AZ]$/.test(pickerState.code));
	_ui.pickerConfirm.disabled = !ok;
}

export async function pickerOpen() {
	// 開啟時只清 code，其餘保留
	pickerReset({ onlyCode: true });

	if (_ui.toolbar) _ui.toolbar.classList.remove("open");
	const backdrop = document.getElementById("drawer-backdrop");
	if (backdrop) backdrop.classList.remove("show");

	if (_ui.objektsPicker) _ui.objektsPicker.classList.add("open");
	// 寬度由 resize handle 控制，開啟時不覆蓋
	// 只在初次開啟且沒有寬度時給預設 720px
	if (_ui.objektsPicker && !isMobile) {
		const hasSavedWidth = _ui.objektsPicker.style.width &&
			_ui.objektsPicker.style.width !== "auto" &&
			_ui.objektsPicker.style.width !== "";
		if (!hasSavedWidth) {
			_ui.objektsPicker.style.setProperty('width', '720px', 'important');
			_ui.objektsPicker.style.setProperty('max-width', '70vw', 'important');
		}
	}
	if (_ui.btnObjMobile) _ui.btnObjMobile.setAttribute("aria-expanded", "true");
	if (_ui.btnObjDesktop)
		_ui.btnObjDesktop.setAttribute("aria-expanded", "true");
	if (isMobile && backdrop) backdrop.classList.add("show");

	const artist = pickerState.artist || "tripleS";
	await loadArtistIntoCache(artist);

	// 保留 season / member / era
	// 不在此處重置，避免每次開關都清空使用者設定

	const userInputEl = document.getElementById("picker-user-input");
	if (userInputEl) userInputEl.value = pickerState.userInput || "";

	if (pickerState.userInput && !pickerState.userMode) {
		triggerUserSearch();
	}

	const ph = getText(_getLang(), "pickerPlaceholder");
	const { eras, members } = deriveEraMemberFromCollections(
		pickerState._artistCache,
	);
	const fallback = OBJEKTS_DATA_FALLBACK[artist] || { eras: [], members: [] };
	const data = eras.length || members.length ? { eras, members } : fallback;

	renderEraChips(data.eras);

	if (_ui.pickerMember && _ui.pickerMember.options.length <= 1) {
		pickerFillSelect(
			_ui.pickerMember,
			data.members,
			ph,
			true,
			pickerState.collection || "tripleS",
		);
		_ui.pickerMember.disabled = false;
	}

	buildSeasonChips(pickerState._artistCache);
	renderArtistSuggestions();
	pickerUpdateConfirmState();
}

export function pickerReset(options = {}) {
	const onlyCode = options && options.onlyCode;
	const codeEl = document.getElementById("picker-code");
	const suggest = document.getElementById("picker-code-suggest");
	if (onlyCode) {
		// 只清 code id 301A 100Z
		pickerState.code = "";
		if (codeEl) codeEl.value = "";
		if (suggest) suggest.innerHTML = "";
		return;
	}
	// 完整重置
	if (typeof pickerState !== "undefined" && pickerState) {
		pickerState.collection = "";
		pickerState.member = "";
		pickerState.code = "";
		pickerState.userInput = "";
		if (pickerState.era && pickerState.era.clear) pickerState.era.clear();
		else pickerState.era = new Set();
		if (pickerState.season && pickerState.season.clear) pickerState.season.clear();
		else pickerState.season = new Set();
	}
	const ui = (typeof _ui !== "undefined" && _ui) ? _ui : {};
	if (ui.pickerCollection) {
		const col = pickerState.collection || "tripleS";
		const opts = [...ui.pickerCollection.options];
		const idx = opts.findIndex((o) => o.value === col);
		ui.pickerCollection.selectedIndex = idx >= 0 ? idx : 1;
		pickerState.collection = ui.pickerCollection.value || "tripleS";
	}
	if (ui.pickerMember) ui.pickerMember.selectedIndex = 0;
	if (codeEl) codeEl.value = "";
	const userInput = document.getElementById("picker-user-input");
	if (userInput) userInput.value = "";
	document.querySelectorAll("#picker-season-chips .picker-chip.active").forEach((c) => c.classList.remove("active"));
	document.querySelectorAll("#picker-era-chips .picker-chip.active").forEach((c) => c.classList.remove("active"));
	const list = document.getElementById("picker-suggest-list");
	if (list) list.innerHTML = "";
}

export function pickerClose() {
	if (_ui.objektsPicker) _ui.objektsPicker.classList.remove("open");
	if (_ui.btnObjMobile) _ui.btnObjMobile.setAttribute("aria-expanded", "false");
	if (_ui.btnObjDesktop)
		_ui.btnObjDesktop.setAttribute("aria-expanded", "false");

	if (isMobile) {
		const backdrop = document.getElementById("drawer-backdrop");
		if (backdrop) backdrop.classList.remove("show");
	}
	clearTimeout(pickerState.userDebounce);
	pickerState.userDebounce = null;
}

export function bindObjektsPicker() {
	if (!_ui) {
		console.warn("[picker] bindObjektsPicker: _ui is null, skip");
		return;
	}

	// 旋轉按鈕 清空 season / era / member（動 collection 與 code
	const resetBtn = document.getElementById("picker-reset-filters-btn");
	if (resetBtn) {
		resetBtn.addEventListener("click", () => {
			pickerState.era = new Set();
			pickerState.season = new Set();
			pickerState.member = "";

			if (_ui.pickerMember) _ui.pickerMember.value = "";

			document
				.querySelectorAll("#picker-season-chips .picker-chip.active")
				.forEach((c) => c.classList.remove("active"));
			document
				.querySelectorAll("#picker-era-chips .picker-chip.active")
				.forEach((c) => c.classList.remove("active"));

			renderArtistSuggestions();
			pickerUpdateConfirmState();

			resetBtn.classList.add("active");
			setTimeout(() => resetBtn.classList.remove("active"), 200);
		});
	}
	if (!_ui.objektsPicker) {
		console.warn(
			"[picker] bindObjektsPicker: ui.objektsPicker is missing, skip",
		);
		return;
	}

	const btnUserRefresh = document.getElementById("btn-user-refresh");
	if (btnUserRefresh) {
		btnUserRefresh.addEventListener("click", () => {
			clearTimeout(pickerState.userDebounce);
			triggerUserSearch();
		});
	}
	const pickerCloseMobile = document.getElementById("picker-close-mobile");
	if (pickerCloseMobile) {
		pickerCloseMobile.addEventListener("click", () => pickerClose());
	}
	if (!_ui.objektsPicker) return;

	if (_ui.btnObjMobile) {
		_ui.btnObjMobile.addEventListener("click", () => pickerOpen());
	}
	if (_ui.btnObjDesktop) {
		_ui.btnObjDesktop.addEventListener("click", () => {
			const isOpen =
				_ui.objektsPicker && _ui.objektsPicker.classList.contains("open");
			if (isOpen) pickerClose();
			else pickerOpen();
		});
	}

	if (_ui.pickerCollection) {
		_ui.pickerCollection.addEventListener("change", async (e) => {
			let val = e.target.value;
			if (!val) {
				val = "tripleS";
				e.target.value = "tripleS";
			}
			pickerState.collection = val;

			const map = { tripleS: "tripleS", ARTMS: "ARTMS", idntt: "idntt" };
			pickerState.artist = map[val] || null;

			pickerState.era = new Set();
			pickerState.season = new Set();
			pickerState.member = "";
			pickerState.code = "";
			if (_ui.pickerCode) _ui.pickerCode.value = "";

			const ph = getText(_getLang(), "pickerPlaceholder");

			await loadArtistIntoCache(pickerState.artist);

			if (pickerState.collection !== val) return;

			const { eras, members } = deriveEraMemberFromCollections(
				pickerState._artistCache,
			);
			const fallback = OBJEKTS_DATA_FALLBACK[val] || { eras: [], members: [] };
			const data = eras.length || members.length ? { eras, members } : fallback;

			renderEraChips(data.eras);
			if (_ui.pickerMember) {
				pickerFillSelect(_ui.pickerMember, data.members, ph, true, val);
				_ui.pickerMember.disabled = false;
			}

			buildSeasonChips(pickerState._artistCache);
			renderArtistSuggestions();
			pickerUpdateConfirmState();
		});
	}

	if (_ui.pickerMember) {
		_ui.pickerMember.addEventListener("change", (e) => {
			pickerState.member = e.target.value;
			renderArtistSuggestions();
			pickerUpdateConfirmState();
		});
	}

	if (_ui.pickerCode) {
		_ui.pickerCode.addEventListener("input", (e) => {
			const formatted = formatPickerCode(e.target.value);
			e.target.value = formatted;
			pickerState.code = formatted;
			pickerUpdateConfirmState();
			renderArtistSuggestions();
		});
		_ui.pickerCode.addEventListener("blur", () => {
			_ui.pickerCode.value = pickerState.code;
		});
	}

	const userInput = document.getElementById("picker-user-input");
	if (userInput) {
		userInput.addEventListener("focus", () => {
			requestAnimationFrame(() => userInput.select());
		});
		userInput.addEventListener("input", () => {
			const val = userInput.value.slice(0, 50);
			userInput.value = val;
			pickerState.userInput = val;

			if (pickerState.userMode) {
				pickerState.userMode = false;
				pickerState._userObjekts = [];
			}

			renderArtistSuggestions();

			clearTimeout(pickerState.userDebounce);
			pickerState.userDebounce = setTimeout(() => {
				if ((pickerState.userInput || "").trim() !== val.trim()) return;
				triggerUserSearch();
			}, 500);
		});
	}

	if (!isMobile) {
		const picker = document.getElementById('objekts-picker');
		const handle = document.getElementById('picker-resize-handle');

		document.addEventListener('mousedown', (e) => {
			if (!picker || !picker.classList.contains('open')) return;
			const sidebar = document.getElementById('desktop-sidebar');
			const sidebarToggle = document.getElementById('btn-sidebar-toggle');
			const isSidebar = sidebar && sidebar.contains(e.target);
			const isSidebarToggle = sidebarToggle && sidebarToggle.contains(e.target);
			const isPicker = picker.contains(e.target);
			const isBtn = e.target.closest('#btn-object-desktop');
			const isHandle = handle && handle.contains(e.target);
			if (!isPicker && !isHandle && !isSidebar && !isSidebarToggle && !isBtn) {
				pickerClose();
			}
		}, true);

		if (picker && handle) {
			let isResizing = false;
			let startX = 0;
			let startWidth = 0;
			const MIN_WIDTH = 720;
			const MAX_WIDTH_RATIO = 0.7;

			handle.addEventListener('pointerdown', (e) => {
				isResizing = true;
				startX = e.clientX;
				startWidth = picker.getBoundingClientRect().width || MIN_WIDTH;
				try { handle.setPointerCapture(e.pointerId); } catch (_) {}
				document.body.style.cursor = 'ew-resize';
				document.body.style.userSelect = 'none';
				e.preventDefault();
			});

			handle.addEventListener('pointermove', (e) => {
				if (!isResizing) return;
				const dx = e.clientX - startX;
				const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
				let newWidth = startWidth + dx;
				newWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, newWidth));
				picker.style.setProperty('width', newWidth + 'px', 'important');
				updatePickerGridColumns(newWidth);
			});

			const endResize = (e) => {
				if (!isResizing) return;
				isResizing = false;
				try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			};
			handle.addEventListener('pointerup', endResize);
			handle.addEventListener('pointercancel', endResize);

			if (typeof ResizeObserver !== 'undefined') {
				const ro = new ResizeObserver(() => updatePickerGridColumns());
				ro.observe(picker);
			}
		}
	}
}
