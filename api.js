const WORKER = "https://little-cake-f3d5.ken8902026.workers.dev";
const SLUG_RE = /([a-z0-9]+-[a-z0-9]+(?:-x-[a-z0-9]+)?-[0-9]{3}[az])$/i;
const SLUG_RE_EXACT = /^([a-z0-9]+-[a-z0-9]+(?:-x-[a-z0-9]+)?-[0-9]{3}[az])$/i;

const SLUG_RE_LOOSE =
	/((?:[a-z0-9]+-){1,3}[a-z0-9]+(?:-x-[a-z0-9]+)?-[0-9]{3}[az])$/i;

function isGzipBuf(buf) {
	return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function isZlibBuf(buf) {
	if (buf.length < 2) return false;
	if (buf[0] !== 0x78) return false;
	return ((buf[0] << 8) | buf[1]) % 31 === 0;
}

/**
 * 用 DecompressionStream 解壓指定格式
 * @param {Uint8Array} buf
 * @param {'gzip'|'deflate'|'deflate-raw'} format
 * @returns {Promise<Uint8Array>}
 */
async function decompressBuf(buf, format) {
	if (typeof DecompressionStream === "undefined") {
		throw new Error("DecompressionStream unsupported");
	}
	const ds = new DecompressionStream(format);
	const stream = new Blob([buf]).stream().pipeThrough(ds);
	const outBuf = await new Response(stream).arrayBuffer();
	return new Uint8Array(outBuf);
}

async function readResponseTextAutoDecompress(res) {
	const buf = new Uint8Array(await res.arrayBuffer());
	if (!buf.length) return "";

	const ce = (res.headers.get("content-encoding") || "").toLowerCase();
	const hasBr = ce.includes("br");

	if (isGzipBuf(buf)) {
		try {
			const out = await decompressBuf(buf, "gzip");
			return new TextDecoder("utf-8").decode(out);
		} catch (err) {
			console.warn("[api] gzip decompress failed", err);
			return new TextDecoder("utf-8").decode(buf);
		}
	}

	if (isZlibBuf(buf)) {
		try {
			const out = await decompressBuf(buf, "deflate");
			return new TextDecoder("utf-8").decode(out);
		} catch (err) {
			console.warn("[api] deflate decompress failed", err);
			return new TextDecoder("utf-8").decode(buf);
		}
	}

	if (hasBr && typeof DecompressionStream !== "undefined") {
		try {
			const out = await decompressBuf(buf, "brotli");
			return new TextDecoder("utf-8").decode(out);
		} catch {
			console.warn("[api] brotli decompress unsupported, fallback raw");
			return new TextDecoder("utf-8").decode(buf);
		}
	}
	return new TextDecoder("utf-8").decode(buf);
}

async function readResponseJsonAutoDecompress(res) {
	const text = await readResponseTextAutoDecompress(res);
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch (err) {
		console.warn(
			"[api] JSON parse failed, first 200 chars:",
			text.slice(0, 200),
		);
		throw new Error("response is not valid JSON");
	}
}

const SUMMARY_FIELDS = [
	"slug",
	"collectionNo",
	"collectionId",
	"class",
	"season",
	"member",
	"members",
	"backgroundColor",
	"artist",
];

function toSummary(c) {
	if (!c || typeof c !== "object") return c;
	const o = {};
	for (const k of SUMMARY_FIELDS) {
		if (c[k] !== undefined) o[k] = c[k];
	}
	return o;
}

export function parseSlug(slug) {
	if (typeof slug !== "string") return null;
	const s = slug.trim().toLowerCase();
	const m = s.match(/^(.+?)-([a-z0-9]+)(?:-x-([a-z0-9]+))?-([0-9]{3}[a-z])$/i);
	if (!m) return null;
	return {
		era: m[1],
		member: m[2],
		member2: m[3] || null,
		code: m[4],
		isDual: !!m[3],
	};
}

function extractSlug(input) {
	const raw = (input || "").trim();
	if (!raw) return "";

	if (!/^https?:\/\//i.test(raw)) {
		let m = raw.match(SLUG_RE_EXACT);
		if (m) return m[1].toLowerCase();
		m = raw.match(SLUG_RE_LOOSE);
		return m ? m[1].toLowerCase() : "";
	}

	let u;
	try {
		u = new URL(raw);
	} catch {
		return "";
	}

	const host = u.hostname.toLowerCase();
	const allowedHosts = [
		"apollo.cafe",
		"www.apollo.cafe",
		"objekt.top",
		"www.objekt.top",
	];
	if (!allowedHosts.includes(host)) return "";

	for (const key of ["id", "slug"]) {
		const val = u.searchParams.get(key);
		if (val) {
			const m = val.match(SLUG_RE);
			if (m) return m[1].toLowerCase();
		}
	}

	const segments = u.pathname.split("/").filter(Boolean);
	for (let i = segments.length - 1; i >= 0; i--) {
		const m = segments[i].match(SLUG_RE);
		if (m) return m[1].toLowerCase();
	}

	for (const [, val] of u.searchParams) {
		const m = (val || "").match(SLUG_RE);
		if (m) return m[1].toLowerCase();
	}

	return "";
}

async function fetchMediaViaWorker(videoUrl) {
	const proxied = WORKER + "/image?url=" + encodeURIComponent(videoUrl);
	const res = await fetch(proxied);
	if (!res.ok) throw new Error("media fetch failed: " + res.status);

	const corsHeaders = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
		"Access-Control-Allow-Headers": "*",
	};
	const newHeaders = new Headers(res.headers);
	Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
	if (!newHeaders.get("Content-Type")) {
		newHeaders.set("Content-Type", "video/mp4");
	}

	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers: newHeaders,
	});
}

export async function apolloFetch(urlOrSlug) {
	const slug = extractSlug(urlOrSlug);
	if (!slug) throw new Error("無法從網址解析出 slug");

	if (!window.Mediabunny && window.__loadMediabunny) {
		try {
			await window.__loadMediabunny();
		} catch {}
	}

	const parsed = parseSlug(slug);
	const res = await fetch(
		WORKER + "/api/objekts/by-slug/" + encodeURIComponent(slug),
		{
			headers: {
				Accept: "application/json",
			},
		},
	);
	if (!res.ok) throw new Error("HTTP " + res.status);

	const data = await readResponseJsonAutoDecompress(res);

	// 處理 frontMedia mp4 video
	let mediaImage = null;
	let mediaBlob = null;
	const frontMedia = data.frontMedia;

	const isMp4 =
		typeof frontMedia === "string" &&
		frontMedia.length > 1 &&
		frontMedia.toLowerCase().endsWith(".mp4");

	if (isMp4 && window.Mediabunny) {
		try {
			const videoRes = await fetchMediaViaWorker(frontMedia);
			const videoBlob = await videoRes.blob();
			mediaBlob = videoBlob;

			const { Input, ALL_FORMATS, BlobSource, VideoSampleSink } =
				window.Mediabunny;
			const input = new Input({
				source: new BlobSource(videoBlob),
				formats: ALL_FORMATS,
			});

			try {
				const videoTrack = await input.getPrimaryVideoTrack();
				if (videoTrack) {
					const sink = new VideoSampleSink(videoTrack);
					const sample = await sink.getSample(0);
					if (sample) {
						const canvas = document.createElement("canvas");
						canvas.width = sample.displayWidth;
						canvas.height = sample.displayHeight;
						const ctx = canvas.getContext("2d");
						sample.draw(ctx, 0, 0);
						sample.close();
						mediaImage = canvas;
					}
				}
			} finally {
				input.dispose();
			}
		} catch (err) {
			console.warn("frontMedia decode fail:", err);
			mediaImage = null;
		}
	}

	return {
		frontImage: data.frontImage,
		backImage: data.backImage,
		textColor: data.textColor,
		collectionId: data.collectionId,
		slug: slug,
		artist: data.artist || (parsed && parsed.artist) || "",
		collection: data.collection || data.collectionId || "",
		backgroundColor: data.backgroundColor || "",

		isDual: !!(parsed && parsed.isDual),
		era: parsed ? parsed.era : null,
		member: parsed ? parsed.member : null,
		member2: parsed ? parsed.member2 : null,
		code: parsed ? parsed.code : null,

		mediaImage: mediaImage,
		mediaBlob,
	};
}

const BOOKMARK_KEY = "cosmo_apollo_bookmarks";
const BOOKMARK_MAX = 100;

export function loadBookmarks() {
	try {
		const raw = localStorage.getItem(BOOKMARK_KEY);
		const arr = raw ? JSON.parse(raw) : [];
		return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
	} catch {
		return [];
	}
}

export function saveBookmarks(arr) {
	try {
		localStorage.setItem(
			BOOKMARK_KEY,
			JSON.stringify(arr.slice(0, BOOKMARK_MAX)),
		);
	} catch {}
}

export function addBookmark(slug) {
  if (!slug) return loadBookmarks();
  const arr = loadBookmarks().filter((x) => x !== slug);
  arr.unshift(slug);
  saveBookmarks(arr);
  return arr;
}

export function removeBookmark(slug) {
	const arr = loadBookmarks().filter((x) => x !== slug);
	saveBookmarks(arr);
	return arr;
}

// artis collect cache
const ARTIST_CACHE_KEY = "cosmo_artist_collections_v2";
const ARTIST_TTL = 1000 * 60 * 60 * 6; // 6 小時

export async function fetchArtistCollections(artist, { force = false } = {}) {
	const key = (artist || "tripleS").toLowerCase();
	const cache = loadArtistCache();

	if (!force && cache[key] && Date.now() - cache[key].ts < ARTIST_TTL) {
		return cache[key].data;
	}

	const url = `${WORKER}/proxy/objekt?artist=${encodeURIComponent(artist)}`;
	const res = await fetch(url, {
		headers: {
			Accept: "application/json",
		},
	});
	if (!res.ok) throw new Error("artist fetch failed: " + res.status);

	const data = await readResponseJsonAutoDecompress(res);
	const collections = Array.isArray(data?.collections) ? data.collections : [];

	const summary = collections.map(toSummary);
	cache[key] = {
		ts: Date.now(),
		data: summary,
	};
	saveArtistCache(cache);

	return collections;
}

function loadArtistCache() {
	try {
		const raw = localStorage.getItem(ARTIST_CACHE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function saveArtistCache(cache) {
	try {
		localStorage.setItem(ARTIST_CACHE_KEY, JSON.stringify(cache));
	} catch {}
}

const USER_CACHE_KEY = "cosmo_user_objekts_v2";

export async function fetchUserObjekts(username) {
	const uname = (username || "").trim().replace(/^@+/, "");
	if (!uname) throw new Error("empty username");
	if (new TextEncoder().encode(uname).length > 100)
		throw new Error("username too long");

	const cache = loadUserCache();
	const cacheKey = uname.toLowerCase();
	if (cache[cacheKey]?.data) {
		// 快取裡是摘要版，直接回傳
		return cache[cacheKey].data;
	}

	const userRes = await fetch(
		`${WORKER}/proxy/user-objekts?username=${encodeURIComponent(uname)}`,
		{
			headers: {
				Accept: "text/html, application/json;q=0.9, */*;q=0.8",
			},
		},
	);
	if (!userRes.ok) throw new Error("user fetch failed: " + userRes.status);

	const html = await readResponseTextAutoDecompress(userRes);
	const match = html.match(/\baddress\s*:\s*["'](0x[a-fA-F0-9]{40})["']/);
	const address = match?.[1] ?? null;
	if (!address) throw new Error("address not found");

	const ownedRes = await fetch(
		`${WORKER}/proxy/owned?address=${encodeURIComponent(address)}`,
		{
			headers: {
				Accept: "application/json",
			},
		},
	);
	if (!ownedRes.ok) throw new Error("owned fetch failed: " + ownedRes.status);

	const ownedData = await readResponseJsonAutoDecompress(ownedRes);
	const objekts = ownedData?.json?.objekts || [];

	const result = {
		address,
		objekts,
		fetchedAt: Date.now(),
	};

	const summaryObjekts = objekts.map(toSummary);
	const cachedResult = {
		address,
		objekts: summaryObjekts,
		fetchedAt: Date.now(),
	};
	cache[cacheKey] = {
		ts: Date.now(),
		data: cachedResult,
	};
	saveUserCache(cache);

	return result;
}

function loadUserCache() {
	try {
		const raw = localStorage.getItem(USER_CACHE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function saveUserCache(cache) {
	try {
		localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cache));
	} catch {}
}

export function clearUserCache() {
	try {
		localStorage.removeItem(USER_CACHE_KEY);
	} catch {}
}
export function clearAllLocalStorage() {
	try {
		localStorage.removeItem(BOOKMARK_KEY);
		localStorage.removeItem(ARTIST_CACHE_KEY);
		localStorage.removeItem(USER_CACHE_KEY);
	} catch {}
}