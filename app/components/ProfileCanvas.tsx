"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Rect } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import dynamic from "next/dynamic";
import Toolbar from "./Toolbar";

// ---- 定数 ----
const GAP      = 20;
const PAD      = 20;
const MAX_SCALE = 8;
const HEADER_H  = 50;
const FOOTER_H  = 50;
const CLAMP = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Tool = "pen" | "pan";
type LineData = { points: number[]; strokeWidth: number };

function usePair() {
  const [front] = useImage("/myprofile_front.png", "anonymous");
  const [back]  = useImage("/myprofile_back.png",  "anonymous");
  return { front, back };
}

function ProfileCanvasInner() {
  const { front, back } = usePair();
  const stageRef = useRef<Konva.Stage>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  const [scale,  setScale]  = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const scaleRef    = useRef(1);
  const offsetRef   = useRef({ x: 0, y: 0 });
  const minScaleRef = useRef(0.05);
  const isPCRef     = useRef(false);
  const stageWRef   = useRef(1);
  const stageHRef   = useRef(1);

  const [lines,   setLines]   = useState<LineData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ---- モード管理（モバイルはpanデフォルト） ----
  const activeToolRef = useRef<Tool>(
    typeof window !== "undefined" && window.innerWidth < 1024 ? "pan" : "pen"
  );
  const [activeTool, setActiveTool] = useState<Tool>(activeToolRef.current);
  const handleToolChange = useCallback((tool: Tool) => {
    activeToolRef.current = tool;
    setActiveTool(tool);
  }, []);

  const isDrawing   = useRef(false);
  const wasPinching = useRef(false);
  const lastDist    = useRef(0);
  const lastMid     = useRef({ x: 0, y: 0 });

  // ---- タッチ開始位置（しきい値判定用） ----
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const DRAW_THRESHOLD = 8;

  // ---- レイアウト計算 ----
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
  const imgW = front?.width  ?? 500;
  const imgH = front?.height ?? 625;
  const bkW  = back?.width   ?? 500;
  const bkH  = back?.height  ?? 625;

  const frontX = PAD;
  const frontY = PAD;
  const backX  = isMobile ? PAD              : PAD + imgW + GAP;
  const backY  = isMobile ? PAD + imgH + GAP : PAD;

  const stageW = isMobile
    ? PAD * 2 + Math.max(imgW, bkW)
    : PAD * 2 + imgW + GAP + bkW;
  const stageH = isMobile
    ? PAD * 2 + imgH + GAP + bkH
    : PAD * 2 + Math.max(imgH, bkH);

  // ---- パン範囲クランプ ----
  // 画像が画面外に完全に出ないよう offset を制限する
  // 「画面端に触れるまで」= stageW*scale の端が viewport の端に達するまで動かせる
  const clampOffset = useCallback((s: number, ox: number, oy: number) => {
    const el = outerRef.current;
    if (!el) return { x: ox, y: oy };
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const sw = stageWRef.current * s;
    const sh = stageHRef.current * s;

    // x: 右端が左に来てもダメ、左端が右に来てもダメ
    const minX = sw >= vw ? vw - sw : (vw - sw) / 2;
    const maxX = sw >= vw ? 0       : (vw - sw) / 2;
    // y: paddingTop(32px)分を考慮。上はpadding内に収め、下は画像が消えないよう制限
    const PTOP = 32;
    const minY = sh >= vh ? vh - sh : PTOP;
    const maxY = sh >= vh ? PTOP    : vh - sh;

    return {
      x: CLAMP(ox, minX, maxX),
      y: CLAMP(oy, minY, maxY),
    };
  }, []);

  const applyTransform = useCallback((s: number, o: { x: number; y: number }) => {
    const clamped = clampOffset(s, o.x, o.y);
    scaleRef.current  = s;
    offsetRef.current = clamped;
    setScale(s);
    setOffset(clamped);
  }, [clampOffset]);

  // ---- 初期スケール・センタリング ----
  useEffect(() => {
    if (!outerRef.current || !front || !back) return;
    const el     = outerRef.current;
    const availW = el.clientWidth;
    const availH = el.clientHeight;
    const isPC   = window.innerWidth >= 1024;
    isPCRef.current   = isPC;
    stageWRef.current = stageW;
    stageHRef.current = stageH;

    let s: number;
    if (isPC) {
      const sx = (availW * 0.92) / stageW;
      const sy = (availH * 0.92) / stageH;
      s = Math.min(sx, sy);
    } else {
      // モバイル: 幅基準のみ
      s = (availW * 0.88) / stageW;
    }
    s = CLAMP(s, 0.05, MAX_SCALE);
    minScaleRef.current = s; // 初期スケール = 最小スケール

    const ox = (availW - stageW * s) / 2;
    // PC: 上部に小さめの余白（16px）、モバイル: ヘッダー直下
    const oy = 8;
    applyTransform(s, { x: ox, y: oy });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front, back]);

  // ---- 画像内チェック ----
  const inImage = (x: number, y: number) =>
    (x >= frontX && x <= frontX + imgW && y >= frontY && y <= frontY + imgH) ||
    (x >= backX  && x <= backX  + bkW  && y >= backY  && y <= backY  + bkH);

  // ---- 描画（マウス） ----
  const handleMouseDown = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== "pen") return;
    const pos = stageRef.current?.getPointerPosition();
    if (!pos || !inImage(pos.x, pos.y)) return;
    isDrawing.current = true;
    setLines(prev => [...prev, { points: [pos.x, pos.y], strokeWidth: 3 }]);
  };

  const handleMouseMove = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== "pen" || !isDrawing.current) return;
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    setLines(prev => {
      const u = [...prev];
      u[u.length - 1] = { ...u[u.length - 1], points: [...u[u.length - 1].points, pos.x, pos.y] };
      return u;
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    setLines(cur => { pushHistory(cur); return cur; });
  };

  // ---- 描画（タッチ） ----
  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (activeTool !== "pen") return;
    if (e.evt.touches.length !== 1 || wasPinching.current) return;
    const pos = stageRef.current?.getPointerPosition();
    if (!pos || !inImage(pos.x, pos.y)) return;
    // 描画開始はせず開始位置だけ記録
    touchStartPos.current = { x: pos.x, y: pos.y };
  };

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (activeTool !== "pen") return;
    if (e.evt.touches.length !== 1) return;
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;

    if (!isDrawing.current) {
      // しきい値チェック
      if (!touchStartPos.current) return;
      const dx = pos.x - touchStartPos.current.x;
      const dy = pos.y - touchStartPos.current.y;
      if (Math.hypot(dx, dy) < DRAW_THRESHOLD) return;
      // しきい値超え → 開始点から描画開始
      isDrawing.current = true;
      setLines(prev => [
        ...prev,
        { points: [touchStartPos.current!.x, touchStartPos.current!.y, pos.x, pos.y], strokeWidth: 3 },
      ]);
      return;
    }

    setLines(prev => {
      const u = [...prev];
      u[u.length - 1] = {
        ...u[u.length - 1],
        points: [...u[u.length - 1].points, pos.x, pos.y],
      };
      return u;
    });
  };

  const handleTouchEnd = () => {
    touchStartPos.current = null;
    if (!isDrawing.current) return;
    isDrawing.current = false;
    setLines(cur => { pushHistory(cur); return cur; });
  };

  // ---- History（refのみで管理・stale closure完全回避） ----
  const historyRef    = useRef<LineData[][]>([[]]);
  const historyIdxRef = useRef(0);

  const pushHistory = useCallback((newLines: LineData[]) => {
    const current = historyRef.current[historyIdxRef.current];
    if (JSON.stringify(current) === JSON.stringify(newLines)) return;

    const next = historyRef.current.slice(0, historyIdxRef.current + 1);
    next.push([...newLines]);
    historyRef.current    = next;
    historyIdxRef.current = next.length - 1;
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    const ni = historyIdxRef.current - 1;
    historyIdxRef.current = ni;
    setLines([...historyRef.current[ni]]);
    setCanUndo(ni > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    const ni = historyIdxRef.current + 1;
    historyIdxRef.current = ni;
    setLines([...historyRef.current[ni]]);
    setCanUndo(true);
    setCanRedo(ni < historyRef.current.length - 1);
  }, []);

  // ---- ダウンロード ----
  const handleDownloadAll = () => {
    const stage = stageRef.current;
    if (!stage) return;

    // ---- iOS/iPadOS判定 ----
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
      || (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
    const win = isIOS ? window.open() : null;

    const frontUri = stage.toDataURL({ x: frontX, y: frontY, width: imgW, height: imgH, pixelRatio: 2 });
    const backUri  = stage.toDataURL({ x: backX,  y: backY,  width: bkW,  height: bkH,  pixelRatio: 2 });

    const canvas  = document.createElement("canvas");
    canvas.width  = (imgW + bkW) * 2;
    canvas.height = Math.max(imgH, bkH) * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frontImg = new Image();
    const backImg  = new Image();

    frontImg.onload = () => {
      backImg.onload = () => {
        ctx.drawImage(frontImg, 0, 0);
        ctx.drawImage(backImg, imgW * 2, 0);

        const dataUrl = canvas.toDataURL("image/png");

        if (isIOS) {
          // iOS/iPadOS → 新規タブで開いて長押し保存
          if (!win) return;

          win.document.title = "プロフィール画像";

          const meta = win.document.createElement("meta");
          meta.name = "viewport";
          meta.content = "width=device-width,initial-scale=1";
          win.document.head.appendChild(meta);

          win.document.body.style.cssText = `
            margin: 0;
            min-height: 100vh;
            background-image: url('/yumekawa_bg.jpeg');
            background-size: cover;
            background-position: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
            gap: 16px;
            `;

          const img = win.document.createElement("img");
          img.src = dataUrl;
          img.style.cssText = "max-width:100%;height:auto;display:block";
          win.document.body.appendChild(img);

          const p = win.document.createElement("p");
          p.textContent = "長押しして「写真に保存」してね！";
          p.style.cssText = `
            color: #000;
            text-align: center;
            font-size: 14px;
            background: rgba(255,255,255,0.6);
            padding: 6px 16px;
            border-radius: 8px;
            margin: 0;
            `;
          win.document.body.appendChild(p);
        } else {
          // Mac・Android・PCは通常ダウンロード
          const a = document.createElement("a");
          a.download = "myprofile.png";
          a.href = dataUrl;
          a.click();
        }
      };
      backImg.src = backUri;
    };
    frontImg.src = frontUri;
  };

  const handleShareTwitter = () => {
    const t = encodeURIComponent("プロフィール書いたよ✨ #平成女児プロフ");
    window.open(`https://twitter.com/intent/tweet?text=${t}`, "_blank");
  };

  // ---- ホイール / トラックパッド ----
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px   = e.clientX - rect.left;
      const py   = e.clientY - rect.top;

      if (e.ctrlKey) {
        // ピンチズーム
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        const ns = CLAMP(scaleRef.current * factor, minScaleRef.current, MAX_SCALE);
        const r  = ns / scaleRef.current;
        applyTransform(ns, {
          x: px - (px - offsetRef.current.x) * r,
          y: py - (py - offsetRef.current.y) * r,
        });
      } else {
        // 2本指スクロール → パン
        // PC: 拡大されていれば全方向、初期スケールなら不可
        // モバイル: 初期スケールでは上下のみ、拡大時は全方向
        const isZoomed = scaleRef.current > minScaleRef.current + 0.001;
        const isPC     = isPCRef.current;

        if (isPC && !isZoomed) return; // PCで初期表示はパン不可

        const dx = (isPC || isZoomed) ? -e.deltaX : 0; // 横パン: 拡大時のみ
        const dy = -e.deltaY;
        applyTransform(scaleRef.current, {
          x: offsetRef.current.x + dx,
          y: offsetRef.current.y + dy,
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  // ---- タッチ（ピンチ＋2本指パン） ----
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    let singleTouchStart: { x: number; y: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // ピンチ処理
        wasPinching.current = true;
        isDrawing.current   = false;
        touchStartPos.current = null;
        lastDist.current = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY,
        );
        lastMid.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      } else if (e.touches.length < 2 && activeToolRef.current === "pan") {
        // 1本指パン開始
        singleTouchStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        // 1本指パン
        if (e.touches.length < 2 && activeToolRef.current === "pan") {
          if (!singleTouchStart) return;
          e.preventDefault();
          const dx = e.touches[0].clientX - singleTouchStart.x;
          const dy = e.touches[0].clientY - singleTouchStart.y;
          singleTouchStart = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
          applyTransform(scaleRef.current, {
            x: offsetRef.current.x + dx,
            y: offsetRef.current.y + dy,
          });
        }
        // 拡大縮小は描写しない
        return;
      }
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const nd   = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      const mid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      const px     = mid.x - rect.left;
      const py     = mid.y - rect.top;
      const factor = nd / lastDist.current;
      const panDx  = mid.x - lastMid.current.x;
      const panDy  = mid.y - lastMid.current.y;
      lastDist.current = nd;
      lastMid.current  = mid;

      const isZoomed = scaleRef.current > minScaleRef.current + 0.001;
      const ns = CLAMP(scaleRef.current * factor, minScaleRef.current, MAX_SCALE);
      const r  = ns / scaleRef.current;

      // 初期スケールでは上下パンのみ、拡大時は全方向
      const dx = isZoomed ? px - (px - offsetRef.current.x) * r + panDx
       : offsetRef.current.x; // x固定
      const dy = py - (py - offsetRef.current.y) * r + panDy;
      applyTransform(ns, { x: dx, y: dy });
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        setTimeout(() => { wasPinching.current = false; }, 50);
      }
      if (e.touches.length === 0) {
        singleTouchStart = null;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, [applyTransform]);

  return (
    <>
      <div className="fixed top-20 left-2 z-50 flex flex-col gap-2 lg:flex-row lg:left-4">
        <Toolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          onUndo={undo}
          onRedo={redo}
          onDownloadAll={handleDownloadAll}
          canUndo={canUndo}
          canRedo={canRedo}
          onShareTwitter={handleShareTwitter}
        />
      </div>

      <div
        ref={outerRef}
        className="w-full overflow-hidden"
        style={{
          height: `calc(100vh - ${HEADER_H + FOOTER_H}px)`,
          touchAction: "none",
          cursor: activeTool === "pen" ? "crosshair" : "grab",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
            display: "inline-block",
          }}
        >
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ display: "block" }}
          >
            <Layer>
              <Rect x={0} y={0} width={stageW} height={stageH}
                fill="rgba(255,255,255,0.5)" cornerRadius={16} />
              {front && <KonvaImage image={front} x={frontX} y={frontY} width={imgW} height={imgH} />}
              {back  && <KonvaImage image={back}  x={backX}  y={backY}  width={bkW}  height={bkH}  />}
              {lines.map((line, i) => (
                <Line key={i} points={line.points} stroke="#000"
                  strokeWidth={line.strokeWidth} tension={0.5}
                  lineCap="round" lineJoin="round" />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
    </>
  );
}
export default dynamic(() => Promise.resolve(ProfileCanvasInner), { ssr: false });
