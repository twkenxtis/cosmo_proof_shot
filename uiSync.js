export function setupSyncInputs(desktopEl, mobileEl, callback) {
	if (!desktopEl || !mobileEl) return;
	desktopEl.addEventListener("input", (e) => {
		mobileEl.value = desktopEl.value;
		if (callback) callback(e);
	});
	mobileEl.addEventListener("input", (e) => {
		desktopEl.value = mobileEl.value;
		if (callback) callback(e);
	});
	desktopEl.addEventListener("change", (e) => {
		mobileEl.value = desktopEl.value;
		if (callback) callback(e);
	});
	mobileEl.addEventListener("change", (e) => {
		desktopEl.value = mobileEl.value;
		if (callback) callback(e);
	});
}
