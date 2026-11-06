import { state } from "./canvas.js";
import { getText } from "./i18n.js";

export function createAdvancedSettings(ui, getCurrentLang) {
    if (!state.exportSettings) {
        state.exportSettings = {
            videoBitrate: 4_500_000,
            audioBitrate: 128_000,
            fps: 30,
            videoCodec: "avc",
            audioCodec: "aac",
            container: "mp4",
            gifQuality: 95,
            jpgQuality: 85,
            pngCompression: 5,
            webpQuality: 90,
        };
    }

    const renderHTML = (isMobile) => `
        <div class="advanced-settings-wrapper" data-mobile="${isMobile}">
            <button type="button" class="advanced-toggle pure-button" aria-expanded="false">
                <i class="ti ti-adjustments-horizontal"></i>
                <span data-i18n="advancedTitle">Advanced</span>
                <i class="ti ti-chevron-down advanced-chevron"></i>
            </button>
            <div class="advanced-content" style="display: none;">
                <div class="advanced-grid">
                    <label class="advanced-field">
                        <span data-i18n="advVideoBitrate">Video Bitrate (bps)</span>
                        <input type="number" class="adv-video-bitrate pure-input-1" value="${state.exportSettings.videoBitrate}" step="100000" min="100000" oninput="window.__advUpdate && window.__advUpdate()">
                    </label>
                    <label class="advanced-field">
                        <span data-i18n="advAudioBitrate">Audio Bitrate (bps)</span>
                        <input type="number" class="adv-audio-bitrate pure-input-1" value="${state.exportSettings.audioBitrate}" step="10000" min="10000" oninput="window.__advUpdate && window.__advUpdate()">
                    </label>
                    <label class="advanced-field">
                        <span data-i18n="advFps">FPS</span>
                        <input type="number" class="adv-fps pure-input-1" value="${state.exportSettings.fps}" step="1" min="1" max="60" oninput="window.__advUpdate && window.__advUpdate()">
                    </label>
                    <label class="advanced-field">
                        <span data-i18n="advVideoCodec">Video Codec</span>
                        <select class="adv-video-codec pure-input-1">
                            <option value="avc" ${state.exportSettings.videoCodec === 'avc' ? 'selected' : ''}>H.264 (AVC)</option>
                            <option value="hevc" ${state.exportSettings.videoCodec === 'hevc' ? 'selected' : ''}>H.265 (HEVC)</option>
                            <option value="vp9" ${state.exportSettings.videoCodec === 'vp9' ? 'selected' : ''}>VP9</option>
                            <option value="av1" ${state.exportSettings.videoCodec === 'av1' ? 'selected' : ''}>AV1</option>
                        </select>
                    </label>
                    <label class="advanced-field">
                        <span data-i18n="advAudioCodec">Audio Codec</span>
                        <select class="adv-audio-codec pure-input-1">
                            <option value="aac" ${state.exportSettings.audioCodec === 'aac' ? 'selected' : ''}>AAC</option>
                            <option value="opus" ${state.exportSettings.audioCodec === 'opus' ? 'selected' : ''}>Opus</option>
                        </select>
                    </label>
                    <label class="advanced-field">
                        <span data-i18n="advContainer">Container</span>
                        <select class="adv-container pure-input-1">
                            <option value="mp4" ${state.exportSettings.container === 'mp4' ? 'selected' : ''}>MP4</option>
                            <option value="mov" ${state.exportSettings.container === 'mov' ? 'selected' : ''}>MOV</option>
                            <option value="mkv" ${state.exportSettings.container === 'mkv' ? 'selected' : ''}>MKV</option>
                            <option value="webm" ${state.exportSettings.container === 'webm' ? 'selected' : ''}>WebM</option>
                        </select>
                    </label>
                    <label class="advanced-field">
                        <span data-i18n="advGifQuality">GIF Quality (0-100)</span>
                        <input type="number" class="adv-gif-quality pure-input-1" value="${state.exportSettings.gifQuality || 95}" step="1" min="0" max="100" oninput="window.__advUpdate && window.__advUpdate()">
                    </label>
                    <label class="advanced-field">
                        <span data-i18n="advJpgQuality">JPG Quality (0-100)</span>
                        <input type="number" class="adv-jpg-quality pure-input-1" value="${state.exportSettings.jpgQuality || 85}" step="1" min="0" max="100" oninput="window.__advUpdate && window.__advUpdate()">
                    </label>
                    <label class="advanced-field">
                        <span data-i18n="advPngCompression">PNG Compression (0-9)</span>
                        <input type="number" class="adv-png-compression pure-input-1" value="${state.exportSettings.pngCompression || 5}" step="1" min="0" max="9" oninput="window.__advUpdate && window.__advUpdate()">
                    </label>
                    <label class="advanced-field">
                        <span data-i18n="advWebpQuality">WebP Quality (0-100)</span>
                        <input type="number" class="adv-webp-quality pure-input-1" value="${state.exportSettings.webpQuality || 90}" step="1" min="0" max="100" oninput="window.__advUpdate && window.__advUpdate()">
                    </label>
                </div>
            </div>
            <div style="height: 16px; width: 100%; flex-shrink: 0;"></div>
            <a href="https://github.com/twkenxtis" target="_blank" rel="noopener noreferrer" class="advanced-github pure-button">
                <i class="ti ti-brand-github"></i>
                <span data-i18n="advGithub">GitHub Repository</span>
            </a>
        </div>
    `;

    // 動態掛載
    const mount = (container, isMobile) => {
        if (!container) return;
        const wrapper = document.createElement("div");
        wrapper.innerHTML = renderHTML(isMobile);
        container.appendChild(wrapper.firstElementChild);
    };

    // 電腦版掛載到 #desktop-sidebar 的最底部
    const sidebar = document.getElementById("desktop-sidebar");
    if (sidebar) {
        mount(sidebar, false);
    }

    // 手機版：插在最底部，並在下方塞入 Spacer
    const toolbar = document.getElementById("toolbar");
    if (toolbar) {
        const closeRow = toolbar.querySelector(".picker-mobile-close-row");
        
        // 建立 Advanced wrapper
        const wrapper = document.createElement("div");
        wrapper.innerHTML = renderHTML(true);
        const el = wrapper.firstElementChild;
        
        if (el) {
            if (closeRow) {
                toolbar.insertBefore(el, closeRow);
            } else {
                toolbar.appendChild(el);
            }

            const spacer = document.createElement("div");
            spacer.style.height = "25px";
            spacer.style.width = "100%";
            spacer.style.flexShrink = "0";
            
            if (closeRow) {
                toolbar.insertBefore(spacer, closeRow);
            } else {
                toolbar.appendChild(spacer);
            }
            console.log("[Advanced] mounted with spacer");
        }
    }

    // 綁定所有 Advanced 按鈕 電腦與手機各一個
    document.querySelectorAll(".advanced-settings-wrapper").forEach((wrapper) => {
        const toggle = wrapper.querySelector(".advanced-toggle");
        const content = wrapper.querySelector(".advanced-content");
        const chevron = wrapper.querySelector(".advanced-chevron");

        const updateSettings = () => {
            state.exportSettings.videoBitrate = parseInt(videoBitrateInput.value, 10) || 3000000;
            state.exportSettings.audioBitrate = parseInt(audioBitrateInput.value, 10) || 128000;
            state.exportSettings.fps = parseInt(fpsInput.value, 10) || 30;
            state.exportSettings.videoCodec = videoCodecSelect.value;
            state.exportSettings.audioCodec = audioCodecSelect.value;
            state.exportSettings.container = containerSelect.value;
            // 品質參數
            const gifQualityInput = wrapper.querySelector(".adv-gif-quality");
            const jpgQualityInput = wrapper.querySelector(".adv-jpg-quality");
            const pngCompressionInput = wrapper.querySelector(".adv-png-compression");
            const webpQualityInput = wrapper.querySelector(".adv-webp-quality");
            if (gifQualityInput) state.exportSettings.gifQuality = Math.max(0, Math.min(100, parseInt(gifQualityInput.value, 10) || 95));
            if (jpgQualityInput) state.exportSettings.jpgQuality = Math.max(0, Math.min(100, parseInt(jpgQualityInput.value, 10) || 85));
            if (pngCompressionInput) state.exportSettings.pngCompression = Math.max(0, Math.min(9, parseInt(pngCompressionInput.value, 10) || 5));
            if (webpQualityInput) state.exportSettings.webpQuality = Math.max(0, Math.min(100, parseInt(webpQualityInput.value, 10) || 90));

            // 同步到另一個裝置的輸入框
            document.querySelectorAll(".advanced-settings-wrapper").forEach((other) => {
                if (other === wrapper) return;
                other.querySelector(".adv-video-bitrate").value = state.exportSettings.videoBitrate;
                other.querySelector(".adv-audio-bitrate").value = state.exportSettings.audioBitrate;
                other.querySelector(".adv-fps").value = state.exportSettings.fps;
                other.querySelector(".adv-video-codec").value = state.exportSettings.videoCodec;
                other.querySelector(".adv-audio-codec").value = state.exportSettings.audioCodec;
                other.querySelector(".adv-container").value = state.exportSettings.container;
                const gq = other.querySelector(".adv-gif-quality");
                const jq = other.querySelector(".adv-jpg-quality");
                const pc = other.querySelector(".adv-png-compression");
                const wq = other.querySelector(".adv-webp-quality");
                if (gq) gq.value = state.exportSettings.gifQuality;
                if (jq) jq.value = state.exportSettings.jpgQuality;
                if (pc) pc.value = state.exportSettings.pngCompression;
                if (wq) wq.value = state.exportSettings.webpQuality;
            });
        }

        toggle.addEventListener("click", () => {
            const isOpen = content.style.display !== "none";
            content.style.display = isOpen ? "none" : "block";
            toggle.setAttribute("aria-expanded", !isOpen);
            if (chevron) {
                chevron.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
            }
            
            if (!isOpen) {
                // 重新綁定這個 wrapper 內的所有輸入框
                const inputs = content.querySelectorAll("input, select");
                inputs.forEach((el) => {
                    // 移除舊的事件監聽器
                    el.removeEventListener("input", updateSettings);
                    el.removeEventListener("change", updateSettings);
                    // 重新綁定
                    el.addEventListener("input", updateSettings);
                    el.addEventListener("change", updateSettings);
                });
                }
        });

        // 綁定輸入框事件
        const videoBitrateInput = wrapper.querySelector(".adv-video-bitrate");
        const audioBitrateInput = wrapper.querySelector(".adv-audio-bitrate");
        const fpsInput = wrapper.querySelector(".adv-fps");
        const videoCodecSelect = wrapper.querySelector(".adv-video-codec");
        const audioCodecSelect = wrapper.querySelector(".adv-audio-codec");
        const containerSelect = wrapper.querySelector(".adv-container");

        ;

        [videoBitrateInput, audioBitrateInput, fpsInput, videoCodecSelect, audioCodecSelect, containerSelect].forEach((el) => {
            el.addEventListener("change", updateSettings);
            el.addEventListener("input", updateSettings);
        });
    });



    // 在掛載後，手動套用翻譯
    document.querySelectorAll(".advanced-settings-wrapper [data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        el.textContent = getText(getCurrentLang(), key);
    });
}