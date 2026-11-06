# Cosmo Proof Shot

 <img src="https://i.ibb.co/bM4cH4KX/4-K-S1-S24.jpg" />

Cosmo 認證照 — tripleS / ARTMS / idntt 照片打卡 Object 小卡模擬工具

Cosmo Proof Shot 是一個純前端的網頁應用，讓使用者把 Cosmo 風格的Object 小卡疊加到自己的照片或影片上，快速做出認證照的打卡效果整個工具所有處理都在瀏覽器本機完成

使用流程：上傳一張背景圖片或一段背景影片，貼上 Apollo 網址一鍵載入 Object，或用內建的 Object 選擇面板挑選系列、成員與編號；接著用滑鼠或手指拖曳、縮放、旋轉、3D 傾斜調整位置，也能同時疊加多個 Object 並套用網格、圓形、扇形、Stack、Flip3D 等排版完成後可匯出 PNG、WebP、JPG、AVIF、JPEG XL、GIF，或直接把背景影片與 Object 一起輸出成 MP4 變成影片支持多種編碼和碼率

介面同時支援桌機與手機：桌機使用可收折的側邊欄，手機使用頂部欄位加底部dock與抽屜，並內建繁體中文、简体中文、English、日本語、한국어、ไทย、Tiếng Việt 七種語系，以及深色與淺色主題切換專案以原生 ES Module 撰寫、無需建置流程，適合直接部署到任何靜態網站託管服務

> 本專案為粉絲自製工具，與Modhaus官方無關Object圖像與相關素材版權屬原權利人所有，請僅供個人非商業用途

```
main.js (總入口：負責初始化所有模組與事件綁定)
│
├── [1] 資料、網路與靜態配置層
│   ├── static.js          純常數與工具函式（成員顏色、卡套 base64、離線資料）
│   ├── imageLoader.js     圖片載入與快取
│   └── api.js             Apollo 抓取（含 Worker 代理）、書籤存取
│
├── [2] 核心畫布渲染引擎（狀態中心）
│   ├── canvas.js ★        全專案共用狀態（objects, singleObject, state, 尺寸, ctx）
│   └── objectVideo.js     Object 影片播放（與 canvas.js 雙向依賴）
│
├── [3] 物件編輯與操作工具群（依賴 canvas.js 狀態）
│   ├── objectSelector.js  Object 切換列（桌機垂直 / 手機橫向）
│   ├── objectDragSort.js  按鈕拖曳排序
│   ├── objectColorBar.js  成員/季節色條
│   ├── coords.js          X / Y / Z / R / RX / RY 座標顯示與輸入
│   ├── textInput.js       文字 / 字型 / 顏色同步
│   ├── cropRatio.js       背景裁切比例
│   ├── assist.js          對齊輔助線開關
│   └── emptyHint.js       畫布空白提示
│
├── [4] 排版佈局層
│   ├── layoutTools.js     排版演算法（直接操作 objects[]）
│   └── layoutUI.js        排版 UI 綁定（桌機滑桿、手機拉桿同步）
│
├── [5] 使用者介面與互動管理層
│   ├── picker.js          Object 選擇面板（系列 / 成員 / 編號）
│   ├── bookmarks.js       書籤列表渲染與搜尋
│   ├── settings.js        語言、QR 文字、清除快取
│   ├── clipboardPaste.js  Ctrl+V 貼上背景
│   ├── advancedSettings.js 進階設定面板
│   ├── uiSync.js          桌機/手機雙輸入同步
│   ├── uploadButtonVisibility.js 上傳按鈕顯示控制
│   └── theme.js           深/淺主題切換
│
├── [6] 全域輔助層
│   └── i18n.js            七語系翻譯（葉節點，被多方引用）
│
└── [7] 匯出管線層
    ├── export.js          匯出總管（靜態圖 + MP4 影片）
    └── glExportRenderer.js WebGL 逐幀渲染（僅被 export.js 呼叫）
```