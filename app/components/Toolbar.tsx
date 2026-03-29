"use client";

import {
  PenLine,
  Undo2,
  Redo2,
  Download,
} from "lucide-react";

import Image from 'next/image';

type Tool = "pen";

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDownloadAll: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onShareTwitter: () => void;
}

interface ToolButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function ToolButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
  className,
}: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        w-11 h-11 rounded-full flex items-center justify-center
        shadow-md transition-all duration-200
        border-2
        ${
          active
            ? "bg-pink-400 border-pink-500 text-white scale-110 shadow-pink-200"
            : "bg-white/80 border-purple-200 text-purple-400 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-400 hover:scale-105"
        }
        ${disabled ? "opacity-40 cursor-not-allowed hover:scale-100 hover:bg-white/80 hover:border-purple-200 hover:text-purple-400" : "cursor-pointer"}
        ${className ?? ""}
      `}
    >
      {children}
    </button>
  );
}

export default function Toolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onDownloadAll,
  canUndo,
  canRedo,
  onShareTwitter,
}: ToolbarProps) {
  return (
    <div
      className="
        fixed top-20 left-3 z-50
        flex flex-col gap-2
        lg:flex-row lg:left-4
      "
    >
      {/* ペン */}
      <ToolButton
        onClick={() => onToolChange("pen")}
        active={activeTool === "pen"}
        title="ペン"
      >
        <PenLine size={20} />
      </ToolButton>

      {/* 区切り */}
      <div className="w-px h-4 bg-purple-200 self-center hidden lg:block" />
      <div className="h-px w-4 bg-purple-200 self-center lg:hidden" />

      {/* Undo */}
      <ToolButton onClick={onUndo} disabled={!canUndo} title="元に戻す">
        <Undo2 size={20} />
      </ToolButton>

      {/* Redo */}
      <ToolButton onClick={onRedo} disabled={!canRedo} title="やり直す">
        <Redo2 size={20} />
      </ToolButton>

      {/* 区切り */}
      <div className="w-px h-4 bg-purple-200 self-center hidden lg:block" />
      <div className="h-px w-4 bg-purple-200 self-center lg:hidden" />

      {/* ダウンロード（表裏まとめて） */}
      <ToolButton onClick={onDownloadAll} title="表裏をダウンロード">
        <Download size={20} />
      </ToolButton>

      {/* Xシェア */}
      <ToolButton className="!bg-black" onClick={onShareTwitter} title="Xでシェア">
        <Image src="/twitter_logo.svg" alt="X" width={20} height={20} />
      </ToolButton>
    </div>
  );
}
