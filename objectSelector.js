import {
	objects,
	currentObjectIndex,
	MAX_OBJECTS,
	addObject,
	removeObject,
} from "./canvas.js";
import { initObjectDragSort } from "./objectDragSort.js";
import { getObjectColor, formatSlug } from "./objectColorBar.js";

import { MEMBER_ORDER } from "./static.js";
let _onSelect = () => {};
let _onMutation = () => {};

function buildObjectButtons(container, isMobileStyle) {
	if (!container) return;
	container.innerHTML = "";
	const n = objects.length;
	for (let i = 0; i < n; i++) {
		const obj = objects[i];
		const isActive = i === currentObjectIndex;
		const hasImg = !!(obj.image && obj.canvas.width);
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "pure-button obj-sel-btn";
		if (isActive) btn.classList.add("active");
		if (!hasImg) btn.classList.add("empty");
		btn.dataset.index = String(i);
		btn.setAttribute("role", "tab");
		btn.setAttribute("aria-selected", isActive ? "true" : "false");
		const iconClass = hasImg || isActive ? "ti-cube" : "ti-cube-off";
		if (isMobileStyle) {
			btn.innerHTML = `<i class="ti ${iconClass}"></i>`;
			btn.setAttribute("aria-label", `Object ${i + 1}`);
			btn.title = `Object ${i + 1}`;
		} else {
			const color = getObjectColor(i);
			const slugStr = formatSlug(obj.name || obj.slug || "");
			// 取 artist (例如 tripleS) 與 code (例如 000A)
        // 小寫 member -> 官方大小寫（從 MEMBER_ORDER 展平後查表）
        const _memberList = (() => {
            const out = [];
            if (!MEMBER_ORDER) return out;
            if (Array.isArray(MEMBER_ORDER)) return MEMBER_ORDER;
            for (const g of Object.values(MEMBER_ORDER)) {
                if (Array.isArray(g)) out.push(...g);
            }
            return out;
        })();
        const _officialMember = (raw) => {
            if (!raw) return "";
            const low = String(raw).toLowerCase();
            const hit = _memberList.find((n) => String(n).toLowerCase() === low);
            return hit || (low.charAt(0).toUpperCase() + low.slice(1));
        };
        const _m1 = _officialMember(obj.member);
        const _m2 = _officialMember(obj.member2);
        const artistName = _m1 && _m2
            ? `${_m1} & ${_m2}`
            : (_m1 || obj.artist || obj.collection || "Artist");
			const codePart = slugStr.split("-").pop() || "";

			btn.innerHTML = `<span class="obj-color-bar" style="background:${color || "transparent"};"></span><i class="ti ${iconClass}"></i> <span style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${artistName} <span style="color:var(--text-muted);font-weight:normal;">${codePart}</span></span>`;
			btn.draggable = true;
		}
		btn.addEventListener("click", () => _onSelect(i));
		container.appendChild(btn);
	}
}

export function refreshObjectSelectorUI() {
	const deskList = document.getElementById("desktop-object-list");
	const mobList = document.getElementById("mobile-object-list");
	buildObjectButtons(deskList, false);
	buildObjectButtons(mobList, true);

	const n = objects.length;
	const addD = document.getElementById("btn-add-object-desktop");
	const addM = document.getElementById("btn-add-object-mobile");
	const remD = document.getElementById("btn-remove-object-desktop");
	const remM = document.getElementById("btn-remove-object-mobile");
	if (addD) addD.disabled = n >= MAX_OBJECTS;
	if (addM) addM.disabled = n >= MAX_OBJECTS;
	if (remD) remD.disabled = n <= 1;
	if (remM) remM.disabled = n <= 1;
}

function handleAddObject() {
	if (objects.length >= MAX_OBJECTS) return;
	const res = addObject();
	if (res.ok) _onMutation();
}

function handleRemoveObject() {
	if (objects.length <= 1) return;
	const res = removeObject(currentObjectIndex);
	if (res.ok) _onMutation();
}

export function initObjectSelector({ onSelect, onMutation }) {
	_onSelect = onSelect || (() => {});
	_onMutation = onMutation || (() => {});
	const addD = document.getElementById("btn-add-object-desktop");
	const addM = document.getElementById("btn-add-object-mobile");
	const remD = document.getElementById("btn-remove-object-desktop");
	const remM = document.getElementById("btn-remove-object-mobile");
	if (addD) addD.addEventListener("click", handleAddObject);
	if (addM) addM.addEventListener("click", handleAddObject);
	if (remD) remD.addEventListener("click", handleRemoveObject);
	if (remM) remM.addEventListener("click", handleRemoveObject);
	refreshObjectSelectorUI();

	initObjectDragSort({
		onReorder: () => {
			refreshObjectSelectorUI();
			_onMutation();
		},
	});
}