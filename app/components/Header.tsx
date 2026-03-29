"use client";

import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

const TOOLTIP_TEXT = [
  "画像をタップ／クリックして書きこんでね！",
  "ダウンロードボタンで保存したら、Xボタンでシェアしてね！",
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const btnRef     = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        tooltipRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-6"
      style={{
        backgroundColor: "#998DBD",
        height: "50px",
        fontSize: 20,
        fontWeight: 800,
        color: "#f0d0ff",
        letterSpacing: "0.05em",
      }}
    >
      {/* タイトル */}
      <p>
        <span style={{ color: "#64469666" }}>✿</span>
        &nbsp;平成女児プロフ&nbsp;
        <span style={{ color: "#64469666" }}>✿</span>
      </p>

      {/* インフォボタン（右上） */}
      <div className="ml-auto relative">
        <button
          ref={btnRef}
          onClick={() => setOpen((v) => !v)}
          className={`
            w-9 h-9 rounded-full flex items-center justify-center
            transition-all duration-200
            ${open
              ? "bg-purple-200 text-purple-700"
              : "text-white hover:bg-white/30"}
          `}
          aria-label="使い方"
        >
          <Info size={30} />
        </button>

        {/* ツールチップ */}
        {open && (
          <div
            ref={tooltipRef}
            className="absolute right-0 top-[calc(100%+8px)] z-[100] w-60 sm:w-80"
            style={{
              filter: "drop-shadow(0 4px 16px rgba(100,70,150,0.18))",
            }}
          >
            {/* 吹き出し三角 */}
            <div className="flex justify-end pr-3">
              <div
                className="w-3 h-2"
                style={{
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderBottom: "8px solid rgba(255,255,255,0.95)",
                }}
              />
            </div>

            {/* 本体 */}
            <div
              className="rounded-2xl px-4 py-3 border border-purple-100"
              style={{ backgroundColor: "rgba(255,255,255,0.95)" }}
            >
              <p className="text-xs font-bold text-purple-500 mb-2 tracking-widest text-center">
                ✦ 使い方 ✦
              </p>
              <ul className="flex flex-col">
                {TOOLTIP_TEXT.map((text, i) => (
                  <li key={i} className="text-xs text-purple-700">
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
