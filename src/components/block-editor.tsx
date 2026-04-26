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
  { command: "/number", label: "Numbered List", type: "number" as const, icon: "1." },
  { command: "/h1", label: "Heading 1", type: "h1" as const, icon: "H₁" },
  { command: "/h2", label: "Heading 2", type: "h2" as const, icon: "H₂" },
  { command: "/h3", label: "Heading 3", type: "h3" as const, icon: "H₃" },
  { command: "/quote", label: "Quote", type: "quote" as const, icon: "“" },
  { command: "/divider", label: "Divider", type: "divider" as const, icon: "—" },
  { command: "/code", label: "Code", type: "code" as const, icon: "<>" },
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
  const [history, setHistory] = useState<Block[][]>([blocks]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});
  const pendingFocusId = useRef<string | null>(null);
  const isUndoRedoing = useRef(false);

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

  // ─── History management ─────────────────────────────────────────────

  const pushToHistory = useCallback((newBlocks: Block[]) => {
    if (isUndoRedoing.current) return;
    setHistory((prev) => {
      const next = prev.slice(0, currentHistoryIndex + 1);
      if (JSON.stringify(next[next.length - 1]) === JSON.stringify(newBlocks)) return next;
      // Limit history to 50 steps
      const updated = [...next, newBlocks];
      if (updated.length > 50) updated.shift();
      setCurrentHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [currentHistoryIndex]);

  const undo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      isUndoRedoing.current = true;
      const prev = history[currentHistoryIndex - 1];
      setCurrentHistoryIndex(currentHistoryIndex - 1);
      onChange(prev);
      // Wait for React to update and reset the flag
      setTimeout(() => { isUndoRedoing.current = false; }, 0);
    }
  }, [currentHistoryIndex, history, onChange]);

  const redo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      isUndoRedoing.current = true;
      const next = history[currentHistoryIndex + 1];
      setCurrentHistoryIndex(currentHistoryIndex + 1);
      onChange(next);
      setTimeout(() => { isUndoRedoing.current = false; }, 0);
    }
  }, [currentHistoryIndex, history, onChange]);

  // Handle outside updates to blocks (like from other cells or initial load)
  useEffect(() => {
    if (!isUndoRedoing.current) {
        setHistory([blocks]);
        setCurrentHistoryIndex(0);
    }
  }, []); // Only on mount

  // ─── Block operations ─────────────────────────────────────────────────

  const updateBlocks = useCallback((newBlocks: Block[]) => {
    pushToHistory(newBlocks);
    onChange(newBlocks);
  }, [pushToHistory, onChange]);

  const updateBlock = useCallback(
    (id: string, updates: Partial<Block>) => {
      updateBlocks(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    },
    [blocks, updateBlocks]
  );

  const addBlockAfter = useCallback(
    (afterId: string, type: Block["type"] = "text") => {
      const newBlock: Block = { id: generateId(), type, content: "" };
      const idx = blocks.findIndex((b) => b.id === afterId);
      const updated = [...blocks];
      updated.splice(idx + 1, 0, newBlock);
      updateBlocks(updated);
      pendingFocusId.current = newBlock.id;
    },
    [blocks, updateBlocks]
  );

  const addBlockBefore = useCallback(
    (beforeId: string, type: Block["type"] = "text") => {
      const newBlock: Block = { id: generateId(), type, content: "" };
      const idx = blocks.findIndex((b) => b.id === beforeId);
      const updated = [...blocks];
      updated.splice(idx, 0, newBlock);
      updateBlocks(updated);
      pendingFocusId.current = newBlock.id;
    },
    [blocks, updateBlocks]
  );

  const deleteBlock = useCallback(
    (id: string) => {
      if (blocks.length <= 1) return;
      const idx = blocks.findIndex((b) => b.id === id);
      const updated = blocks.filter((b) => b.id !== id);
      updateBlocks(updated);
      const prev = updated[Math.max(0, idx - 1)];
      if (prev) pendingFocusId.current = prev.id;
    },
    [blocks, updateBlocks]
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

  const handlePaste = useCallback(
    (id: string, e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text");
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

      // If it's multi-line or starts with markdown-like indicators, split into blocks
      if (
        lines.length > 1 ||
        lines[0].match(/^([-*] |[0-9]+\. |- ?\[[ xX]?\]\s|# |> )/)
      ) {
        e.preventDefault();

        const idx = blocks.findIndex((b) => b.id === id);
        const currentBlock = blocks[idx];
        const newBlocks: Block[] = [];

        lines.forEach((originalLine) => {
          let type: Block["type"] = "text";
          const line = originalLine.trim();
          let content = line;
          let checked = false;

          if (line.match(/^-\s*\[[ xX]?\]\s/)) {
            type = "todo";
            content = line.replace(/^-\s*\[[ xX]?\]\s*/, "");
            checked = /\[x\]/i.test(line);
          } else if (line.match(/^[0-9]+\. /)) {
            type = "number";
            content = line.replace(/^[0-9]+\. /, "");
          } else if (line.startsWith("# ")) {
            type = "h1";
            content = line.substring(2);
          } else if (line.startsWith("## ")) {
            type = "h2";
            content = line.substring(3);
          } else if (line.startsWith("### ")) {
            type = "h3";
            content = line.substring(4);
          } else if (line.startsWith("> ")) {
            type = "quote";
            content = line.substring(2);
          }

          newBlocks.push({
            id: generateId(),
            type,
            content: content.trim(),
            ...(type === "todo" ? { checked } : {}),
          });
        });

        const updated = [...blocks];
        // If current block is empty text, replace it. Otherwise insert after.
        if (currentBlock.content === "" && currentBlock.type === "text") {
          updated.splice(idx, 1, ...newBlocks);
        } else {
          updated.splice(idx + 1, 0, ...newBlocks);
        }

        updateBlocks(updated);

        // Clear refs for the replaced/new blocks so they re-init with correct textContent
        newBlocks.forEach((nb) => {
          if (blockRefs.current[nb.id]) {
            blockRefs.current[nb.id]!.dataset.init = "";
          }
        });

        pendingFocusId.current = newBlocks[newBlocks.length - 1].id;
      }
    },
    [blocks, updateBlocks]
  );

  const handleInput = useCallback(
    (id: string, e: React.FormEvent<HTMLElement>) => {
      const rawText = (e.target as HTMLElement).textContent || "";
      const text = rawText.replace(/\u00a0/g, " ");

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

      // Markdown shortcuts: detect pattern BEFORE Space is inserted
      if (e.key === " ") {
        const el = blockRefs.current[id];
        const rawText = (el?.textContent || "").replace(/\u00a0/g, " ");

        if (block.type === "text") {
          // Todo: - [] or - [ ] or [] or - [x]
          if (/^-\s*\[[ x]?\]$/i.test(rawText) || rawText === "[]") {
            e.preventDefault();
            const checked = /\[x\]/i.test(rawText);
            if (el) { el.textContent = ""; el.dataset.init = ""; }
            updateBlock(id, { type: "todo", content: "", checked });
            return;
          }
          // Number: 1.
          if (rawText === "1.") {
            e.preventDefault();
            if (el) { el.textContent = ""; el.dataset.init = ""; }
            updateBlock(id, { type: "number", content: "" });
            return;
          }
          // Heading: #
          if (rawText === "#") {
            e.preventDefault();
            if (el) { el.textContent = ""; el.dataset.init = ""; }
            updateBlock(id, { type: "h1", content: "" });
            return;
          }
          // Quote: >
          if (rawText === ">") {
            e.preventDefault();
            if (el) { el.textContent = ""; el.dataset.init = ""; }
            updateBlock(id, { type: "quote", content: "" });
            return;
          }
        }
      }

      // Select All (Cmd+A)
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const container = (e.currentTarget as HTMLElement).closest(".space-y-px");
        if (container) {
          const range = document.createRange();
          range.selectNodeContents(container);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          // Focus the container so it can catch the next Delete event
          (container as HTMLElement).focus();
        }
      }

      // Undo (Cmd+Z)
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        
        // If at start of line, insert BEFORE
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (range.startOffset === 0 && range.endOffset === 0) {
            addBlockBefore(id);
            return;
          }
        }
        
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
      case "quote":
        return "text-xs italic border-l-2 border-neutral-200 pl-2 text-neutral-600";
      case "code":
        return "text-[10px] font-mono bg-neutral-50 px-1.5 py-1 rounded border border-neutral-100";
      case "divider":
        return "h-px bg-neutral-200 my-2";
      default:
        return "text-xs leading-relaxed";
    }
  };

  const placeholderText = (type: Block["type"]) => {
    switch (type) {
      case "todo":
        return "To-do";
      case "number":
        return "Step";
      case "h1":
        return "Heading 1";
      case "h2":
        return "Heading 2";
      case "h3":
        return "Heading 3";
      case "quote":
        return "Quote";
      case "code":
        return "Code";
      case "divider":
        return "";
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
      <div 
        className="space-y-px outline-none select-text"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Backspace" || e.key === "Delete") {
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) {
              // If selection spans multiple blocks or is the container
              if (sel.anchorNode !== sel.focusNode || e.target === e.currentTarget) {
                e.preventDefault();
                const firstBlockId = generateId();
                updateBlocks([{ id: firstBlockId, type: "text", content: "" }]);
                pendingFocusId.current = firstBlockId;
              }
            }
          }
        }}
      >
        {blocks.map((block) => (
          <div 
            key={block.id} 
            className="relative flex items-start gap-1.5 group/block cursor-text"
            onClick={(e) => {
              // If clicking the container (gutter), focus the editable area
              const target = e.target as HTMLElement;
              if (target.classList.contains('group/block') || target.tagName === 'DIV' && !target.hasAttribute('contenteditable')) {
                blockRefs.current[block.id]?.focus();
              }
            }}
          >
            {/* Visual indicators for lists */}
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
            {block.type === "number" && (
              <div className="mt-[3px] text-[10px] font-bold text-neutral-900 shrink-0 min-w-[14px]">
                {blocks.filter((b, i) => b.type === "number" && i <= blocks.indexOf(block)).length}.
              </div>
            )}

            <div className={`flex-1 relative min-w-0 ${block.type === "divider" ? "invisible pointer-events-none" : ""}`}>
              {/* Only show contentEditable if NOT a divider */}
              {block.type !== "divider" && (
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
                  onPaste={(e) => handlePaste(block.id, e)}
                  onFocus={() => {
                    setFocusedId(block.id);
                    if (slashMenu && slashMenu.blockId !== block.id)
                      setSlashMenu(null);
                  }}
                  onBlur={() => setFocusedId(null)}
                />
              )}

              {/* Divider line */}
              {block.type === "divider" && (
                <div className="absolute inset-0 flex items-center pointer-events-auto cursor-default" onClick={() => deleteBlock(block.id)}>
                   <div className="w-full h-px bg-neutral-200" />
                </div>
              )}

              {/* Placeholder overlay */}
              {!block.content && block.type !== "divider" && (
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
