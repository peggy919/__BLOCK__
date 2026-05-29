# Neon Breakout (TypeScript + React)

一個使用 Vite、React 與 TypeScript 撰寫的單頁打磚塊遊戲。專案為純前端應用，使用 HTML5 Canvas 與 Web Audio。

## 本地開發

需求：已安裝 Node.js

1. 安裝相依性：

```bash
npm install
```

2. 啟動開發伺服器：

```bash
npm run dev
```

3. 進入瀏覽器檢視：

打開 http://localhost:3000

若要產生 production build：

```bash
npm run build
```

---

保留檔案：`src/`、`assets/`、`index.html`、`tsconfig.json` 等。已移除 AI Studio 的設定檔與範例金鑰檔案。

## GitHub Pages（透過 GitHub Actions 自動部署）

此專案已包含 GitHub Actions workflow，會在 push 到 `main` 時自動建置並將 `dist/` 發佈到 `gh-pages` 分支。若要使用：

1. 將此 repo push 到 GitHub（預設分支為 `main`）。
2. 確認 GitHub Actions 成功建置後，前往 repository Settings → Pages，將來源設為 `gh-pages` 分支（若尚未自動設定）。

發佈後，網站路徑會是 `https://<your-username>.github.io/__BLOCK__/`。
