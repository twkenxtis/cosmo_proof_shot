import { objects } from "./canvas.js";
import { getMemberColor, getSeasonColor, MEMBER_COLORS, MEMBER_ORDER } from "./static.js";

const SEASONS = ["S1", "S2", "S3", "S4", "S5"];

// MEMBER_ORDER 是物件 { tripleS: [...], ARTMS: [...], ... }，展開成扁平陣列
function getMemberList() {
	const out = [];
	if (!MEMBER_ORDER) return out;
	if (Array.isArray(MEMBER_ORDER)) return MEMBER_ORDER;
	if (typeof MEMBER_ORDER === "object") {
		for (const group of Object.values(MEMBER_ORDER)) {
			if (Array.isArray(group)) {
				for (const m of group) out.push(m);
			}
		}
	}
	return out;
}

// 成員名稱取首字母大寫 其餘小寫
function normalize(name) {
	return String(name || "").toLowerCase();
}


// 將 slug 最後一碼的字母轉大寫
export function formatSlug(slug) {
	if (!slug) return "";
	const parts = String(slug).split("-");
	if (parts.length === 0) return slug;
	const last = parts[parts.length - 1];
	if (/[a-z]$/i.test(last)) {
		parts[parts.length - 1] = last.toUpperCase();
	}
	return parts.join("-");
}

export function getObjectColor(index) {
    const obj = objects[index];
    if (!obj) return null;

    if (obj.backgroundColor) return obj.backgroundColor;

    const name = normalize(obj.name);
    if (!name) return null;

    const members = getMemberList();
    for (const m of members) {
        if (name.includes(normalize(m))) {
            const c = getMemberColor(m);
            if (c) return c;
        }
    }

    // Season ATOM Binary Cream 
    for (const s of SEASONS) {
        if (name.includes(s.toLowerCase())) {
            const c = getSeasonColor(s);
            if (c) return c;
        }
    }

    /* tripleS 成員版
    // fallback：obj.color（文字色）
    if (obj.color && obj.color !== "#ffffff") return obj.color;

    const keys = MEMBER_COLORS ? Object.keys(MEMBER_COLORS) : [];
    if (keys.length) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
        const idx = Math.abs(h) % keys.length;
        return MEMBER_COLORS[keys[idx]] || null;
    }
    return null;
    */

    // fallback：obj.color（文字色，非白才算）
    if (obj.color && obj.color !== "#ffffff") return obj.color;

    // fallback：依 slug 穩定雜湊到 MEMBER_COLORS 的色票
    const keys = MEMBER_COLORS ? Object.keys(MEMBER_COLORS) : [];
    if (keys.length) {
        let h = 0;
        for (let i = 0; i < name.length; i++) {
            h = (h * 31 + name.charCodeAt(i)) | 0;
        }
        const idx = Math.abs(h) % keys.length;
        return MEMBER_COLORS[keys[idx]] || null;
    }

    return obj.backgroundColor || null;
}