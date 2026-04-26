"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Block, PlannerData } from "@/lib/types";
import BlockEditor from "@/components/block-editor";
import { Button } from "@/components/ui/button";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function getMonthWeeks(year: number, month: number): (number | null)[][] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7)
    weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function monthToGlobalIndex(year: number, month: number) {
  return year * 12 + month;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_COL_WIDTH = 190;
const DEFAULT_ROW_HEIGHT = 150;
const MIN_COL_WIDTH = 120;
const MIN_ROW_HEIGHT = 60;
const HEADER_HEIGHT = 36;
const TITLE_HEIGHT = 44;
const PAGE_GAP = 80;
const RENDER_RANGE = 2; // Render focused ± 2 months = 5 pages

// ─── Component ──────────────────────────────────────────────────────────────

export default function Home() {
  const today = new Date();
  const todayStr = formatDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const anchorGlobal = useRef(
    monthToGlobalIndex(today.getFullYear(), today.getMonth())
  ).current;

  // ─── Data ─────────────────────────────────────────────────────────────

  const [data, setData] = useState<PlannerData>({});
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const defaultBlocksRef = useRef<Record<string, Block[]>>({});

  // ─── Focused month ───────────────────────────────────────────────────

  const [focusedYear, setFocusedYear] = useState(today.getFullYear());
  const [focusedMonth, setFocusedMonth] = useState(today.getMonth());
  // Refs keep latest values for rapid clicks and callbacks
  const focusedYearRef = useRef(focusedYear);
  const focusedMonthRef = useRef(focusedMonth);

  // ─── Canvas state ────────────────────────────────────────────────────

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);

  // ─── Grid sizing ──────────────────────────────────────────────────────

  const [colWidths, setColWidths] = useState<number[]>(
    Array(7).fill(DEFAULT_COL_WIDTH)
  );
  // Per-month row min-heights: keyed by "year-month"
  const [allRowHeights, setAllRowHeights] = useState<
    Record<string, number[]>
  >({});

  const getRowMinHeight = useCallback(
    (year: number, month: number, rowIndex: number): number => {
      const key = `${year}-${month}`;
      return allRowHeights[key]?.[rowIndex] ?? DEFAULT_ROW_HEIGHT;
    },
    [allRowHeights]
  );

  const [resizing, setResizing] = useState<{
    type: "col" | "row";
    index: number;
    monthKey?: string;
    numRows?: number;
    startPos: number;
    startSize: number;
  } | null>(null);

  // ─── Drag to pan state ───────────────────────────────────────────────

  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });

  // ─── Mobile detection ────────────────────────────────────────────

  const [isMobile, setIsMobile] = useState(false);
  const [showMobileBanner, setShowMobileBanner] = useState(false);
  const touchRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number; lastDist: number; lastScale: number }>({ startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0, lastDist: 0, lastScale: 1 });

  useEffect(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    setShowMobileBanner(mobile);
    if (mobile) {
      setScale(0.45);
    }
  }, []);

  // ─── Sync refs ────────────────────────────────────────────────────────

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  useEffect(() => {
    focusedYearRef.current = focusedYear;
  }, [focusedYear]);
  useEffect(() => {
    focusedMonthRef.current = focusedMonth;
  }, [focusedMonth]);

  // ─── Derived layout values ───────────────────────────────────────────

  const pageWidth = colWidths.reduce((a, b) => a + b, 0);
  const PAGE_STRIDE = pageWidth + PAGE_GAP;

  // Stable global X position for any month
  const getMonthX = useCallback(
    (year: number, month: number) => {
      const idx = monthToGlobalIndex(year, month);
      return (idx - anchorGlobal) * PAGE_STRIDE;
    },
    [anchorGlobal, PAGE_STRIDE]
  );

  // Months to render (sliding window around focused month)
  const monthPages = useMemo(() => {
    const pages = [];
    for (let i = -RENDER_RANGE; i <= RENDER_RANGE; i++) {
      const d = new Date(focusedYear, focusedMonth + i, 1);
      pages.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        x: getMonthX(d.getFullYear(), d.getMonth()),
      });
    }
    return pages;
  }, [focusedYear, focusedMonth, getMonthX]);

  // ─── Localhost detection ───────────────────────────────────────────
  const isLocalNetwork = () => {
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local");
  };

  const [isLocal, setIsLocal] = useState(false);
  useEffect(() => {
    setIsLocal(isLocalNetwork());
  }, []);

  // ─── Data fetching ──────────────────────────────────────────────────

  useEffect(() => {
    const savedData = localStorage.getItem("planner-data");
    
    // If we have local storage, use it (works for everyone)
    if (savedData) {
      try {
        setData(JSON.parse(savedData));
        setLoaded(true);
        return;
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    }

    // If no local storage AND we are on local network, pull from the JSON file
    if (isLocalNetwork()) {
      fetch("/api/planner")
        .then((r) => r.json())
        .then((d) => {
          setData(d);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    } else {
      setLoaded(true);
    }
  }, []);

  // ─── Center on mount ────────────────────────────────────────────────

  useEffect(() => {
    if (canvasRef.current && !initializedRef.current && loaded) {
      initializedRef.current = true;
      const { clientWidth, clientHeight } = canvasRef.current;
      const weeks = getMonthWeeks(focusedYear, focusedMonth);
      const calH =
        TITLE_HEIGHT + HEADER_HEIGHT + weeks.length * DEFAULT_ROW_HEIGHT;
      setOffset({
        x: Math.max(60, (clientWidth - pageWidth) / 2),
        y: Math.max(40, (clientHeight - calH) / 2),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // ─── Auto-save ──────────────────────────────────────────────────────

  const saveToLocalStorage = useCallback((updatedData: PlannerData) => {
    localStorage.setItem("planner-data", JSON.stringify(updatedData));
  }, []);

  const saveToServer = useCallback((date: string, blocks: Block[]) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, blocks }),
      });
    }, 500);
  }, []);

  const handleBlocksChange = useCallback(
    (date: string, blocks: Block[]) => {
      delete defaultBlocksRef.current[date];
      setData((prev) => {
        const next = { ...prev, [date]: blocks };
        saveToLocalStorage(next);
        return next;
      });
      
      // ONLY sync to JSON file if on local network
      if (isLocalNetwork()) {
        saveToServer(date, blocks);
      }
    },
    [saveToLocalStorage, saveToServer]
  );

  const getBlocks = useCallback(
    (date: string): Block[] => {
      if (data[date]) return data[date];
      if (!defaultBlocksRef.current[date]) {
        defaultBlocksRef.current[date] = [
          { id: `default-${date}`, type: "text", content: "" },
        ];
      }
      return defaultBlocksRef.current[date];
    },
    [data]
  );

  // ─── Export / Import Modal ─────────────────────────────────────────

  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const exportAsFile = useCallback(() => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", `planner-backup-${new Date().toISOString().split('T')[0]}.json`);
    linkElement.click();
    setShowExportModal(false);
  }, [data]);

  const exportAsText = useCallback(() => {
    const dataStr = JSON.stringify(data);
    navigator.clipboard.writeText(dataStr).then(() => {
      setCopySuccess(true);
      setTimeout(() => { setCopySuccess(false); setShowExportModal(false); }, 1200);
    });
  }, [data]);

  const importFromFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (re: any) => {
        try {
          const imported = JSON.parse(re.target.result);
          setData(imported);
          saveToLocalStorage(imported);
          setShowImportModal(false);
        } catch (err) {
          alert("Failed to import: Invalid file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [saveToLocalStorage]);

  const importFromText = useCallback(() => {
    try {
      const imported = JSON.parse(importText);
      setData(imported);
      saveToLocalStorage(imported);
      setImportText("");
      setShowImportModal(false);
    } catch (err) {
      alert("Failed to import: Invalid data. Make sure you pasted the full text.");
    }
  }, [importText, saveToLocalStorage]);


  // ─── Smooth animation helper ────────────────────────────────────────

  const animateToOffset = useCallback(
    (targetX: number, targetY: number) => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      const startX = offsetRef.current.x;
      const startY = offsetRef.current.y;
      const startTime = performance.now();
      const duration = 350;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

        setOffset({
          x: startX + (targetX - startX) * ease,
          y: startY + (targetY - startY) * ease,
        });

        if (t < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(step);
    },
    []
  );

  // ─── Navigation ──────────────────────────────────────────────────────

  const navigateToMonth = useCallback(
    (year: number, month: number) => {
      const d = new Date(year, month, 1);
      const y = d.getFullYear();
      const m = d.getMonth();

      // Update refs synchronously (for rapid clicks)
      focusedYearRef.current = y;
      focusedMonthRef.current = m;
      setFocusedYear(y);
      setFocusedMonth(m);

      if (canvasRef.current) {
        const { clientWidth, clientHeight } = canvasRef.current;
        const targetX = getMonthX(y, m);
        const weeks = getMonthWeeks(y, m);
        const calH =
          TITLE_HEIGHT + HEADER_HEIGHT + weeks.length * DEFAULT_ROW_HEIGHT;
        const s = scaleRef.current;

        // transform is translate(ox, oy) scale(s)
        // screen pos = offset + canvasPos * scale
        // center: offset + (targetX + pageWidth/2) * s = clientWidth/2
        //   =>  offset = (clientWidth - pageWidth * s) / 2 - targetX * s
        animateToOffset(
          (clientWidth - pageWidth * s) / 2 - targetX * s,
          Math.max(40, (clientHeight - calH * s) / 2)
        );
      }
    },
    [getMonthX, pageWidth, animateToOffset]
  );

  const prevMonth = () =>
    navigateToMonth(focusedYearRef.current, focusedMonthRef.current - 1);
  const nextMonth = () =>
    navigateToMonth(focusedYearRef.current, focusedMonthRef.current + 1);
  const goToToday = () =>
    navigateToMonth(today.getFullYear(), today.getMonth());
  const centerCalendar = () =>
    navigateToMonth(focusedYearRef.current, focusedMonthRef.current);

  // ─── Canvas wheel handler (pan + pinch-zoom) ─────────────────────────

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();

      // Cancel any ongoing navigation animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom / Ctrl+scroll → zoom toward cursor
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        const currentScale = scaleRef.current;
        const currentOffset = offsetRef.current;
        const zoomFactor = 1 - e.deltaY * 0.005;
        const newScale = Math.min(
          Math.max(currentScale * zoomFactor, 0.15),
          4
        );
        const ratio = newScale / currentScale;

        setOffset({
          x: cx - (cx - currentOffset.x) * ratio,
          y: cy - (cy - currentOffset.y) * ratio,
        });
        setScale(newScale);
      } else {
        // Two-finger scroll → pan
        setOffset((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [loaded]);

  // ─── Touch handlers (mobile pan + pinch-zoom) ───────────────────────

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    let isTouchPanning = false;
    let isTouchZooming = false;

    const getTouchDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    });

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isTouchPanning = false;
        touchRef.current.startX = e.touches[0].clientX;
        touchRef.current.startY = e.touches[0].clientY;
        touchRef.current.startOffsetX = offsetRef.current.x;
        touchRef.current.startOffsetY = offsetRef.current.y;
      } else if (e.touches.length === 2) {
        e.preventDefault();
        isTouchZooming = true;
        isTouchPanning = false;
        touchRef.current.lastDist = getTouchDist(e.touches);
        touchRef.current.lastScale = scaleRef.current;
        touchRef.current.startOffsetX = offsetRef.current.x;
        touchRef.current.startOffsetY = offsetRef.current.y;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && !isTouchZooming) {
        const dx = e.touches[0].clientX - touchRef.current.startX;
        const dy = e.touches[0].clientY - touchRef.current.startY;
        // Only start panning after moving 8px (so taps still work)
        if (!isTouchPanning && Math.abs(dx) + Math.abs(dy) > 8) {
          isTouchPanning = true;
        }
        if (isTouchPanning) {
          e.preventDefault();
          setOffset({
            x: touchRef.current.startOffsetX + dx,
            y: touchRef.current.startOffsetY + dy,
          });
        }
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        const ratio = dist / touchRef.current.lastDist;
        const newScale = Math.min(4, Math.max(0.15, touchRef.current.lastScale * ratio));

        // Zoom toward the center of the two fingers
        const rect = el.getBoundingClientRect();
        const center = getTouchCenter(e.touches);
        const cx = center.x - rect.left;
        const cy = center.y - rect.top;
        const scaleRatio = newScale / touchRef.current.lastScale;

        setScale(newScale);
        setOffset({
          x: cx - (cx - touchRef.current.startOffsetX) * scaleRatio,
          y: cy - (cy - touchRef.current.startOffsetY) * scaleRatio,
        });
      }
    };

    const handleTouchEnd = () => {
      isTouchPanning = false;
      isTouchZooming = false;
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [loaded]);


  // ─── Keyboard zoom handler (Cmd+ / Cmd-) ────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const isZoomIn = (e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+");
      const isZoomOut = (e.metaKey || e.ctrlKey) && e.key === "-";
      const isZoomReset = (e.metaKey || e.ctrlKey) && e.key === "0";

      if (isZoomIn || isZoomOut || isZoomReset) {
        e.preventDefault();
        
        if (isZoomReset) {
          setScale(1);
          return;
        }

        const factor = isZoomOut ? 0.85 : 1.15;
        setScale((s) => Math.min(4, Math.max(0.15, s * factor)));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ─── Resize handlers (col + row) ─────────────────────────────────────

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const currentScale = scaleRef.current;
      if (resizing.type === "col") {
        const diff = (e.clientX - resizing.startPos) / currentScale;
        setColWidths((prev) => {
          const next = [...prev];
          next[resizing.index] = Math.max(
            MIN_COL_WIDTH,
            resizing.startSize + diff
          );
          return next;
        });
      } else {
        // Row resize
        const diff = (e.clientY - resizing.startPos) / currentScale;
        const newHeight = Math.max(
          MIN_ROW_HEIGHT,
          resizing.startSize + diff
        );
        setAllRowHeights((prev) => {
          const key = resizing.monthKey!;
          const existing = prev[key] || Array(resizing.numRows).fill(DEFAULT_ROW_HEIGHT);
          const next = [...existing];
          next[resizing.index] = newHeight;
          return { ...prev, [key]: next };
        });
      }
    };

    const handleMouseUp = () => setResizing(null);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  // ─── Drag to pan handler ─────────────────────────────────────────────

  useEffect(() => {
    if (!isDraggingCanvas) return;

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setOffset({
        x: dragStartRef.current.offsetX + dx,
        y: dragStartRef.current.offsetY + dy,
      });
    };

    const handlePointerUp = () => setIsDraggingCanvas(false);

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingCanvas]);

  // ─── Render ──────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <p className="text-neutral-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        cursor: resizing
          ? resizing.type === "col"
            ? "col-resize"
            : "row-resize"
          : undefined,
      }}
    >
      {/* ── Mobile Warning Banner ──────────────────────────────── */}
      {showMobileBanner && (
        <div className="bg-neutral-900 text-white px-4 py-2 flex items-center justify-between text-xs shrink-0">
          <span>This app works best on a larger screen.</span>
          <button onClick={() => setShowMobileBanner(false)} className="ml-3 text-neutral-400 hover:text-white shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Fixed Toolbar ────────────────────────────────────────── */}
      <header className="border-b border-neutral-200 px-2 sm:px-4 py-1.5 flex items-center justify-between shrink-0 bg-white z-30">
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <h1 className="text-sm font-semibold tracking-tight">Planner</h1>
          <div className="w-px h-4 bg-neutral-200" />
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-xs" onClick={prevMonth}>
              ←
            </Button>
            <span className="text-[13px] font-medium min-w-[100px] sm:min-w-[120px] text-center select-none">
              {MONTH_NAMES[focusedMonth]} {focusedYear}
            </span>
            <Button variant="ghost" size="icon-xs" onClick={nextMonth}>
              →
            </Button>
          </div>
          <Button variant="outline" size="xs" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2.5">
          <div className="hidden sm:flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setScale((s) => Math.max(0.15, s * 0.85))}
            >
              −
            </Button>
            <span className="text-[11px] text-neutral-500 min-w-[36px] text-center tabular-nums select-none">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setScale((s) => Math.min(4, s * 1.15))}
            >
              +
            </Button>
          </div>
          <Button variant="outline" size="xs" onClick={centerCalendar} className="hidden sm:inline-flex">
            Center
          </Button>
          <div className="hidden sm:block w-px h-4 bg-neutral-200" />
          <Button variant="outline" size="xs" onClick={() => setShowExportModal(true)} title="Export data">
            Export
          </Button>
          <Button variant="outline" size="xs" onClick={() => setShowImportModal(true)} title="Import data">
            Import
          </Button>
          <span className="hidden lg:inline text-[11px] text-neutral-400 select-none ml-1">
            Pinch to zoom · Scroll to pan ·{" "}
            <kbd className="px-1 py-0.5 bg-neutral-100 rounded text-[10px] font-mono">
              /
            </kbd>{" "}
            for commands
          </span>
        </div>
      </header>


      {/* ── Infinite Canvas ─────────────────────────────────────────── */}
      <div
        ref={canvasRef}
        className={`flex-1 overflow-hidden relative ${
          isDraggingCanvas ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          backgroundColor: "#f8f8f8",
          backgroundImage:
            "radial-gradient(circle, #e0e0e0 0.8px, transparent 0.8px)",
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
          userSelect: resizing || isDraggingCanvas ? "none" : undefined,
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          // If they click on the calendar cards, ignore (let them select text/blocks)
          const target = e.target as HTMLElement;
          if (target === canvasRef.current) {
            setIsDraggingCanvas(true);
            dragStartRef.current = {
              mouseX: e.clientX,
              mouseY: e.clientY,
              offsetX: offset.x,
              offsetY: offset.y,
            };
            // Prevent text selection while dragging
            e.preventDefault();
          }
        }}
      >
        {/* Transformed content layer */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {/* ── Month pages ────────────────────────────────────────── */}
          {monthPages.map((page) => {
            const weeks = getMonthWeeks(page.year, page.month);
            const isFocused =
              page.year === focusedYear && page.month === focusedMonth;

            return (
              <div
                key={`${page.year}-${page.month}`}
                style={{
                  position: "absolute",
                  left: page.x,
                  top: 0,
                  width: pageWidth,
                }}
              >
                {/* Month title */}
                <div
                  className="flex items-center px-1 select-none"
                  style={{ height: TITLE_HEIGHT }}
                >
                  <span
                    className={`text-sm font-semibold ${
                      isFocused ? "text-neutral-900" : "text-neutral-400"
                    }`}
                  >
                    {MONTH_NAMES[page.month]} {page.year}
                  </span>
                </div>

                {/* Calendar card */}
                <div
                  className="bg-white rounded-xl border border-neutral-200 overflow-hidden"
                  style={{
                    boxShadow: isFocused
                      ? "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)"
                      : "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  {/* Day headers */}
                  <div
                    className="flex border-b border-neutral-200"
                    style={{ height: HEADER_HEIGHT }}
                  >
                    {DAY_NAMES.map((day, i) => (
                      <div
                        key={day}
                        className="relative shrink-0 flex items-center px-3 text-[11px] font-medium text-neutral-400 uppercase tracking-widest select-none"
                        style={{ width: colWidths[i] }}
                      >
                        {day}
                        {/* Col resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-[6px] -mr-[3px] cursor-col-resize z-20 group/resize"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setResizing({
                              type: "col",
                              index: i,
                              startPos: e.clientX,
                              startSize: colWidths[i],
                            });
                          }}
                        >
                          <div className="w-[2px] h-full mx-auto bg-transparent group-hover/resize:bg-blue-400 transition-colors rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Week rows */}
                  {weeks.map((week, wi) => {
                    const isLastRow = wi === weeks.length - 1;
                    const rowMinH = getRowMinHeight(
                      page.year,
                      page.month,
                      wi
                    );
                    return (
                      <div key={wi} className="relative">
                        <div
                          className={`flex border-b border-neutral-100 ${
                            isLastRow ? "border-b-0" : ""
                          }`}
                          style={{ minHeight: rowMinH }}
                        >
                          {week.map((day, di) => {
                            if (day === null) {
                              return (
                                <div
                                  key={di}
                                  className="relative shrink-0 border-r border-neutral-100 last:border-r-0 bg-neutral-50/40"
                                  style={{ width: colWidths[di] }}
                                >
                                  {/* Col resize handle (empty cell) */}
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-[6px] -mr-[3px] cursor-col-resize z-20 group/resize"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setResizing({
                                        type: "col",
                                        index: di,
                                        startPos: e.clientX,
                                        startSize: colWidths[di],
                                      });
                                    }}
                                  >
                                    <div className="w-[2px] h-full mx-auto bg-transparent group-hover/resize:bg-blue-400 transition-colors rounded-full" />
                                  </div>
                                </div>
                              );
                            }

                            const dateStr = formatDate(
                              page.year,
                              page.month,
                              day
                            );
                            const isToday = dateStr === todayStr;

                            return (
                              <div
                                key={di}
                                className="relative shrink-0 border-r border-neutral-100 last:border-r-0 flex flex-col group/cell cursor-text"
                                style={{ width: colWidths[di] }}
                                onClick={(e) => {
                                  // If clicking empty space, focus the last editable block
                                  const target = e.target as HTMLElement;
                                  if (
                                    !target.closest("[contenteditable]") &&
                                    !target.closest('input[type="checkbox"]')
                                  ) {
                                    const editables =
                                      (e.currentTarget as HTMLElement).querySelectorAll(
                                        "[contenteditable]"
                                      );
                                    const last = editables[editables.length - 1] as HTMLElement;
                                    if (last) {
                                      last.focus();
                                      // Place cursor at end
                                      const sel = window.getSelection();
                                      const range = document.createRange();
                                      if (last.childNodes.length > 0) {
                                        range.setStartAfter(last.lastChild!);
                                      } else {
                                        range.setStart(last, 0);
                                      }
                                      range.collapse(true);
                                      sel?.removeAllRanges();
                                      sel?.addRange(range);
                                    }
                                  }
                                }}
                              >
                                {/* Cell background hover effect */}
                                <div className="absolute inset-0 bg-neutral-50/40 opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none" />

                                {/* Col resize handle (active cell) */}
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-[6px] -mr-[3px] cursor-col-resize z-20 group/resize opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setResizing({
                                      type: "col",
                                      index: di,
                                      startPos: e.clientX,
                                      startSize: colWidths[di],
                                    });
                                  }}
                                >
                                  <div className="w-[2px] h-full mx-auto bg-transparent group-hover/resize:bg-blue-400 transition-colors rounded-full" />
                                </div>

                                {/* Date number */}
                                <div className="relative px-2 pt-1.5 pb-0.5 shrink-0 z-10 pointer-events-none">
                                  <span
                                    className={`text-xs select-none ${
                                      isToday
                                        ? "text-blue-600 font-bold"
                                        : "text-neutral-500 font-medium"
                                    }`}
                                  >
                                    {day}
                                  </span>
                                </div>

                                {/* Inline editor */}
                                <div className="relative flex-1 px-2 pb-1 z-10 content-relative">
                                  <BlockEditor
                                    blocks={getBlocks(dateStr)}
                                    onChange={(blocks) =>
                                      handleBlocksChange(dateStr, blocks)
                                    }
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Row resize handle */}
                        <div
                          className="absolute left-0 bottom-0 h-[6px] -mb-[3px] cursor-row-resize z-10 group/resize"
                          style={{ width: pageWidth }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setResizing({
                              type: "row",
                              index: wi,
                              monthKey: `${page.year}-${page.month}`,
                              numRows: weeks.length,
                              startPos: e.clientY,
                              startSize: rowMinH,
                            });
                          }}
                        >
                          <div className="h-[2px] w-full bg-transparent group-hover/resize:bg-blue-400 transition-colors mt-[2px] rounded-full" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Export Modal ──────────────────────────────────────────── */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowExportModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[340px] space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-neutral-800">Export Your Data</h2>
            <p className="text-xs text-neutral-500">Choose how to save your planner data:</p>
            <div className="space-y-2">
              <button
                onClick={exportAsText}
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors text-left"
              >
                <div className="text-sm font-medium text-neutral-800">
                  {copySuccess ? "Copied!" : "Copy to Clipboard"}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Paste it into another browser to restore</div>
              </button>
              <button
                onClick={exportAsFile}
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors text-left"
              >
                <div className="text-sm font-medium text-neutral-800">Download as File</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Save a .json backup to your computer</div>
              </button>
            </div>
            <button onClick={() => setShowExportModal(false)} className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors w-full text-center pt-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Import Modal ──────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[380px] space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-neutral-800">Import Data</h2>
            <p className="text-xs text-neutral-500">Restore your planner from a backup:</p>
            <div className="space-y-3">
              <button
                onClick={importFromFile}
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors text-left"
              >
                <div className="text-sm font-medium text-neutral-800">Upload File</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Select a .json backup file</div>
              </button>
              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-200" />
                <div className="relative flex justify-center">
                  <span className="bg-white px-2 text-[10px] text-neutral-400">or paste your data</span>
                </div>
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='Paste your exported data here...'
                className="w-full h-24 px-3 py-2 text-xs border border-neutral-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300 font-mono"
              />
              <button
                onClick={importFromText}
                disabled={!importText.trim()}
                className="w-full px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Import from Text
              </button>
            </div>
            <button onClick={() => { setShowImportModal(false); setImportText(""); }} className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors w-full text-center pt-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
