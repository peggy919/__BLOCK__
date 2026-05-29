/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import GameBoard from './components/GameBoard';
import { Gamepad2 } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-100 flex flex-col justify-start items-center p-4 md:p-8" id="root_app_container">
      {/* 頁面精美標題列 */}
      <header className="w-full max-w-4xl flex items-center justify-between gap-4 mb-6 border-b border-slate-900 pb-4" id="main_header">
        <div className="flex items-center gap-3" id="header_title_bar">
          <div className="p-2.5 bg-gradient-to-tr from-sky-500 to-indigo-500 rounded-xl text-white shadow-lg shadow-sky-500/15" id="header_icon_bg">
            <Gamepad2 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              NEON BREAKOUT <span className="text-xs bg-slate-800 text-sky-400 font-mono font-bold px-2 py-0.5 rounded border border-slate-700">TS + CANVAS</span>
            </h1>
            <p className="text-xs text-slate-400">
              精密物理模擬與動態 Web Audio 合成音效
            </p>
          </div>
        </div>
        <div className="text-right hidden sm:block" id="header_status">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
            Platform Ready
          </span>
          <div className="flex items-center gap-1.5 justify-end">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">100% Client-Side</span>
          </div>
        </div>
      </header>

      {/* 核心遊戲元件 */}
      <main className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center" id="main_game_wrapper">
        <GameBoard />
      </main>

      {/* 頁尾極簡標籤 */}
      <footer className="w-full max-w-4xl text-center text-[11px] text-slate-600 mt-8 border-t border-slate-900 pt-4 font-mono flex flex-col sm:flex-row items-center justify-between gap-2" id="main_footer">
        <span>© 2026 Neon Breakout. Web Audio synthesized engine.</span>
        <span>Made with Vite, React, TypeScript and HTML5 Canvas</span>
      </footer>
    </div>
  );
}

