# Cosmo Proof Shot

 <img src="https://i.ibb.co/bM4cH4KX/4-K-S1-S24.jpg" />

Cosmo 認證照 — tripleS / ARTMS / idntt 照片打卡 Object 小卡模擬工具

Cosmo Proof Shot 是一個純前端的網頁應用，讓使用者把 Cosmo 風格的Object 小卡疊加到自己的照片或影片上，快速做出認證照的打卡效果整個工具所有處理都在瀏覽器本機完成

使用流程：上傳一張背景圖片或一段背景影片，貼上 Apollo 網址一鍵載入 Object，或用內建的 Object 選擇面板挑選系列、成員與編號；接著用滑鼠或手指拖曳、縮放、旋轉、3D 傾斜調整位置，也能同時疊加多個 Object 並套用網格、圓形、扇形、Stack、Flip3D 等排版完成後可匯出 PNG、WebP、JPG、AVIF、JPEG XL、GIF，或直接把背景影片與 Object 一起輸出成 MP4 變成影片支持多種編碼和碼率

介面同時支援桌機與手機：桌機使用可收折的側邊欄，手機使用頂部欄位加底部dock與抽屜，並內建繁體中文、简体中文、English、日本語、한국어、ไทย、Tiếng Việt 七種語系，以及深色與淺色主題切換專案以原生 ES Module 撰寫、無需建置流程，適合直接部署到任何靜態網站託管服務

> 本專案為粉絲自製工具，與Modhaus官方無關Object圖像與相關素材版權屬原權利人所有，請僅供個人非商業用途

```
main.js
│
├── [1] 資料、網路與靜態配置層（葉節點，不依賴其他本地模組）
│   │
│   ├── static.js  ── 純常數與工具函式，無副作用
│   │   └── export:
│   │       ├── MEMBER_ORDER / MEMBER_PREFIX / MEMBER_COLORS
│   │       ├── SEASON_COLORS
│   │       ├── SLEEVE_DATA_URL（卡套 base64 圖片）
│   │       ├── BASE64_ANIM_LOADING（Loading 轉圈動畫）
│   │       ├── OBJEKTS_DATA_FALLBACK（Apollo離線備援資料）
│   │       ├── PICKER_PAGE_SIZE
│   │       └── getMemberColor() / getSeasonColor() / escapeHtml()
│   │
│   ├── imageLoader.js  ── 圖片載入與快取
│   │   └── export: initImageLoader() / loadImage() / loadImageCached()
│   │
│   └── api.js  ── Apollo 抓取與書籤（import: static.js, imageLoader.js）
│       └── export:
│           ├── apolloFetch()           解析 Apollo 網址、抓 metadata、走 Worker 圖片代理
│           ├── parseSlug()             解析 slug (成員 / 編號 / 系列)
│           ├── fetchArtistCollections() 抓系列清單
│           ├── fetchUserObjekts()       抓使用者 Object 清單
│           ├── addBookmark() / loadBookmarks()
│           └── clearAllLocalStorage()
│
├── [2] 核心畫布渲染引擎（狀態中心）
│   │
│   ├── canvas.js ★
│   │   ├── import: objectVideo.js, static.js, imageLoader.js
│   │   ├── 狀態（全專案共用，其他模組只讀不複製）：
│   │   │   ├── objects[]             Object 陣列，objects[0] 為最上層的圖層但不一定對應到摺疊菜單中的顯示只是變數作用
│   │   │   ├── singleObject          當前 Object 的 getter
│   │   │   ├── state                 拖曳/縮放/旋轉/pinch/zoomMode/cropRatio/alignGuides...
│   │   │   ├── currentObjectIndex / selectedIndex
│   │   │   └── bgCtx / CANVAS_W / CANVAS_H
│   │   └── export:
│   │       ├── 渲染：scheduleDraw() / scheduleDrawBg() / render() / initCanvas()
│   │       ├── 尺寸：applyCanvasSize()
│   │       ├── 合成：composeOverlay() / composeBackOverlay() / recomposeCurrent()
│   │       ├── 命中：hitTestHandle() / computeSnap() / getOverlaySize()
│   │       ├── 座標：getPointer() / resetOverlayPosition()
│   │       ├── 生命週期：addObject() / removeObject() / setCurrentObjectIndex()
│   │       └── 常數：TRASH_POS / TRASH_RADIUS / TRASH_HIT_RADIUS / TRASH_DELETE_RADIUS / MAX_OBJECTS
│   │
│   └── objectVideo.js  ── Object 影片播放（與 canvas.js 雙向依賴）
│       ├── import: canvas.js（讀 objects / 呼叫 scheduleDraw）
│       └── export: startObjectVideo() / stopObjectVideo()
│                   pauseAllObjectVideos() / resumeAllObjectVideos()
│
├── [3] 物件編輯與操作工具群（全部依賴 canvas.js 的狀態）
│   │
│   ├── objectSelector.js  ── Object 切換列（桌機垂直、手機橫向捲動）
│   │   ├── import: canvas.js, objectColorBar.js, objectDragSort.js, i18n.js
│   │   └── export: initObjectSelector() / refreshObjectSelectorUI()
│   │
│   ├── objectDragSort.js  ── Object 按鈕 HTML5 拖曳排序
│   │   ├── import: canvas.js（重排 objects[] 並 scheduleDraw）
│   │   └── export: initObjectDragSort()
│   │
│   ├── objectColorBar.js  ── Object 按鈕左側成員/季節色條
│   │   ├── import: static.js（getMemberColor / getSeasonColor）
│   │   └── export: applyObjectColorBar()
│   │
│   ├── coords.js  ── 座標面板（X / Y / Z / R / RX / RY）
│   │   ├── import: canvas.js, i18n.js
│   │   └── export: initCoords() / bindCoordInputs() / applyCoordInputs() / updateCoordDisplay()
│   │
│   ├── textInput.js  ── 文字1/文字2/字型/顏色輸入同步
│   │   ├── import: canvas.js（recomposeCurrent）
│   │   └── export: initTextInput() / bindTextInputs()
│   │
│   ├── cropRatio.js  ── 背景裁切比例（無 / 1:1 / 4:5 / 16:9）
│   │   ├── import: canvas.js（applyCanvasSize / state.cropRatio）
│   │   └── export: initCropRatio() / updateCropButtons()
│   │
│   ├── assist.js  ── 對齊輔助線開關
│   │   ├── import: canvas.js（state.alignGuides）
│   │   └── export: bindAssistToggles()
│   │
│   └── emptyHint.js  ── 畫布空白提示（點擊上傳）
│       ├── import: canvas.js（objects）
│       └── export: initEmptyHint() / updateEmptyHint()
│
├── [4] 排版佈局層
│   │
│   ├── layoutTools.js  ── 排版演算法（直接操作 objects[]）
│   │   ├── import: canvas.js
│   │   └── export: layoutGrid() / layoutCircle() / layoutFan() / layoutStack() / layoutFlip3D()
│   │
│   └── layoutUI.js  ── 排版 UI 綁定（桌機滑桿、手機按鈕）
│       ├── import: layoutTools.js, i18n.js
│       └── export: initLayoutUI()
│
├── [5] 使用者介面與互動管理層
│   │
│   ├── picker.js  ── Object 選擇面板（桌機側滑、手機底部抽屜）
│   │   ├── import: api.js, static.js, i18n.js, objectColorBar.js
│   │   └── export: initPicker() / bindObjektsPicker() / pickerOpen() / pickerClose()
│   │               pickerReset() / pickerUpdateConfirmState()
│   │
│   ├── bookmarks.js  ── 書籤列表渲染與搜尋
│   │   ├── import: api.js, i18n.js
│   │   └── export: initBookmarks() / renderBookmarks()
│   │
│   ├── settings.js  ── 語言、QR 文字、清除快取
│   │   ├── import: i18n.js, api.js
│   │   └── export: initSettings() / bindQrTextInputs() / bindClearCacheButtons()
│   │
│   ├── clipboardPaste.js  ── Ctrl+V 貼上圖片作為背景
│   │   ├── import: imageLoader.js
│   │   └── export: initClipboardPaste()
│   │
│   ├── advancedSettings.js  ── 進階設定面板（動態建立）
│   │   ├── import: i18n.js
│   │   └── export: createAdvancedSettings()
│   │
│   ├── uiSync.js  ── 桌機/手機雙輸入同步工具
│   │   └── export: setupSyncInputs()
│   │
│   ├── uploadButtonVisibility.js  ── 依狀態顯示/隱藏上傳按鈕
│   │   └── export: updateUploadButtonVisibility()
│   │
│   └── theme.js  ── 深/淺主題切換與 localStorage 持久化
│       └── export: initTheme() / bindThemeToggle()
│
├── [6] 全域輔助層
│   │
│   └── i18n.js  ── 七語系翻譯（葉節點，被多方引用）
│       └── export: detectLang() / applyTranslations() / getText() / isMobile
│
└── [7] 匯出管線層
    │
    ├── export.js  ── 匯出總管（靜態圖 + MP4 影片）
    │   ├── import: canvas.js, glExportRenderer.js, objectVideo.js, i18n.js
    │   ├── 外部：Mediabunny（CDN 動態 import()，封裝 MP4）
    │   └── export: initExport() / handleExportClick() / isMp4Exporting()
    │
    └── glExportRenderer.js  ── WebGL 逐幀渲染（僅被 export.js 呼叫）
        └── 職責：建立 GL Context → 逐幀上傳 Texture → 交給 Mediabunny 編碼
```