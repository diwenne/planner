"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Block } from "@/lib/types";

// ─── Slash commands ─────────────────────────────────────────────────────────

const SLASH_COMMANDS = [
  { command: "/todo", label: "To-do", type: "todo" as const, icon: "☐" },
  { command: "/h1", label: "Heading 1", type: "h1" as const, icon: "H₁" },
  { command: "/h2", label: "Heading 2", type: "h2" as const, icon: "H₂" },
  { command: "/h3", label: "Heading 3", type: "h3" as const, icon: "H₃" },
  { command: "/text", label: "Text", type: "text" as const, icon: "¶" },
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export default function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{
    blockId: string;
    query: string;
  } | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});
  const pendingFocusId = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  const filteredCommands = slashMenu
    ? SLASH_COMMANDS.filter((c) =>
        c.command.startsWith(slashMenu.query.toLowerCase())
      )
    : [];

  // (Menu position is computed inline in handleInput)

  // ─── Focus management ──────────────────────────────────────────────────

  useEffect(() => {
    if (pendingFocusId.current) {
      const el = blockRefs.current[pendingFocusId.current];
      if (el) {
        el.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        if (el.childNodes.length > 0) {
          range.setStartAfter(el.lastChild!);
        } else {
          range.setStart(el, 0);
        }
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      pendingFocusId.current = null;
    }
  });

  // ─── Block operations ─────────────────────────────────────────────────

  const updateBlock = useCallback(
    (id: string, updates: Partial<Block>) => {
      onChange(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    },
    [blocks, onChange]
  );

  const addBlockAfter = useCallback(
    (afterId: string, type: Block["type"] = "text") => {
      const newBlock: Block = { id: generateId(), type, content: "" };
      const idx = blocks.findIndex((b) => b.id === afterId);
      const updated = [...blocks];
      updated.splice(idx + 1, 0, newBlock);
      onChange(updated);
      pendingFocusId.current = newBlock.id;
    },
    [blocks, onChange]
  );

  const deleteBlock = useCallback(
    (id: string) => {
      if (blocks.length <= 1) return;
      const idx = blocks.findIndex((b) => b.id === id);
      const updated = blocks.filter((b) => b.id !== id);
      onChange(updated);
      const prev = updated[Math.max(0, idx - 1)];
      if (prev) pendingFocusId.current = prev.id;
    },
    [blocks, onChange]
  );

  const applySlashCommand = useCallback(
    (blockId: string, cmd: (typeof SLASH_COMMANDS)[0]) => {
      const el = blockRefs.current[blockId];
      if (el) el.textContent = "";

      updateBlock(blockId, {
        type: cmd.type,
        content: "",
        ...(cmd.type === "todo" ? { checked: false } : {}),
      });
      setSlashMenu(null);
      pendingFocusId.current = blockId;
    },
    [updateBlock]
  );

  // ─── Event handlers ──────────────────────────────────────────────────

  const handleInput = useCallback(
    (id: string, e: React.FormEvent<HTMLElement>) => {
      const text = (e.target as HTMLElement).textContent || "";
      updateBlock(id, { content: text });

      const slashMatch = text.match(/\/(\S*)$/);
      if (slashMatch) {
        // Capture caret position NOW, while selection is still valid
        let pos = { x: 0, y: 0 };
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.height > 0) {
            pos = { x: rect.left, y: rect.bottom + 4 };
          } else {
            // Collapsed caret fallback: use block element
            const el = blockRefs.current[id];
            if (el) {
              const blockRect = el.getBoundingClientRect();
              pos = { x: blockRect.left, y: blockRect.bottom + 4 };
            }
          }
        }
        setMenuPos(pos);
        setSlashMenu({ blockId: id, query: "/" + slashMatch[1] });
        setSelectedMenuIndex(0);
      } else {
        setSlashMenu(null);
        setMenuPos(null);
      }
    },
    [updateBlock]
  );

  const handleKeyDown = useCallback(
    (id: string, e: KeyboardEvent<HTMLElement>) => {
      const block = blocks.find((b) => b.id === id);
      if (!block) return;

      // Slash menu navigation
      if (slashMenu && slashMenu.blockId === id) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedMenuIndex((i) =>
            Math.min(i + 1, filteredCommands.length - 1)
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedMenuIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          if (filteredCommands.length > 0) {
            e.preventDefault();
            applySlashCommand(id, filteredCommands[selectedMenuIndex]);
            return;
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashMenu(null);
          return;
        }
      }

      // Enter → new block
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        addBlockAfter(id);
      }

      // Backspace on empty → downgrade type, then delete
      if (e.key === "Backspace") {
        const el = blockRefs.current[id];
        if ((el?.textContent || "") === "") {
          e.preventDefault();
          if (block.type !== "text") {
            updateBlock(id, { type: "text", checked: undefined });
          } else {
            deleteBlock(id);
          }
        }
      }

      // Arrow key navigation between blocks
      if (e.key === "ArrowUp" && !slashMenu) {
        const idx = blocks.findIndex((b) => b.id === id);
        if (idx > 0) {
          e.preventDefault();
          blockRefs.current[blocks[idx - 1].id]?.focus();
        }
      }
      if (e.key === "ArrowDown" && !slashMenu) {
        const idx = blocks.findIndex((b) => b.id === id);
        if (idx < blocks.length - 1) {
          e.preventDefault();
          blockRefs.current[blocks[idx + 1].id]?.focus();
        }
      }
    },
    [
      blocks,
      slashMenu,
      filteredCommands,
      selectedMenuIndex,
      applySlashCommand,
      addBlockAfter,
      deleteBlock,
      updateBlock,
    ]
  );

  // ─── Style helpers ────────────────────────────────────────────────────

  const blockStyle = (type: Block["type"]) => {
    switch (type) {
      case "h1":
        return "text-base font-bold leading-tight";
      case "h2":
        return "text-sm font-semibold leading-tight";
      case "h3":
        return "text-[13px] font-medium leading-tight";
      default:
        return "text-xs leading-relaxed";
    }
  };

  const placeholderText = (type: Block["type"]) => {
    switch (type) {
      case "todo":
        return "To-do";
      case "h1":
        return "Heading 1";
      case "h2":
        return "Heading 2";
      case "h3":
        return "Heading 3";
      default:
        return "Type / for commands";
    }
  };

  // ─── SSR fallback ─────────────────────────────────────────────────────

  if (!mounted) {
    return (
      <div className="space-y-px">
        {blocks.map((block) => (
          <div
            key={block.id}
            className={`py-px ${blockStyle(block.type)} text-neutral-300`}
          >
            {block.content || placeholderText(block.type)}
          </div>
        ))}
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-px">
        {blocks.map((block) => (
          <div key={block.id} className="relative flex items-start gap-1.5">
            {/* Checkbox for to-do */}
            {block.type === "todo" && (
              <input
                type="checkbox"
                checked={block.checked || false}
                onChange={(e) =>
                  updateBlock(block.id, { checked: e.target.checked })
                }
                className="mt-[3px] h-3.5 w-3.5 rounded border-neutral-300 accent-neutral-900 cursor-pointer shrink-0"
              />
            )}

            <div className="flex-1 relative min-w-0">
              {/* contentEditable: NO React children — cursor stays put */}
              <div
                ref={(el) => {
                  blockRefs.current[block.id] = el;
                  if (el && !el.dataset.init) {
                    el.dataset.init = "1";
                    el.textContent = block.content;
                  }
                }}
                contentEditable
                suppressContentEditableWarning
                className={`outline-none py-px min-h-[1.3em] ${blockStyle(
                  block.type
                )} ${
                  block.type === "todo" && block.checked
                    ? "line-through text-neutral-400"
                    : "text-neutral-800"
                }`}
                onInput={(e) => handleInput(block.id, e)}
                onKeyDown={(e) => handleKeyDown(block.id, e)}
                onFocus={() => {
                  if (slashMenu && slashMenu.blockId !== block.id)
                    setSlashMenu(null);
                }}
              />

              {/* Placeholder overlay */}
              {!block.content && (
                <div className="absolute inset-0 pointer-events-none text-neutral-300 py-px text-xs select-none">
                  {placeholderText(block.type)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Slash command dropdown — rendered via portal at document body level
          so it's never clipped by overflow:hidden on parent cells */}
      {slashMenu &&
        menuPos &&
        filteredCommands.length > 0 &&
        createPortal(
          <div
            className="fixed w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
            style={{
              left: menuPos.x,
              top: menuPos.y,
              zIndex: 9999,
            }}
          >
            <div className="px-3 py-1 text-[9px] uppercase tracking-widest text-neutral-400 font-medium">
              Blocks
            </div>
            {filteredCommands.map((cmd, i) => (
              <button
                key={cmd.command}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 ${
                  i === selectedMenuIndex
                    ? "bg-neutral-100"
                    : "hover:bg-neutral-50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySlashCommand(slashMenu.blockId, cmd);
                }}
                onMouseEnter={() => setSelectedMenuIndex(i)}
              >
                <span className="text-neutral-400 text-[11px] w-5 text-center shrink-0">
                  {cmd.icon}
                </span>
                <span className="text-neutral-700">{cmd.label}</span>
                <span className="ml-auto text-neutral-300 text-[10px] font-mono">
                  {cmd.command}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
