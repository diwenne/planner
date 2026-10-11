// Keeps canvas cards (month calendars and documents) from overlapping.

export interface LayoutItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

// Cards must end up at least this far apart; nudged cards are placed exactly this far away.
export const CARD_GAP = 24;
// Slack so sub-pixel size differences between browsers can't make a layout flip-flop.
const EPS = 2;

function collides(a: LayoutItem, b: LayoutItem): boolean {
  return (
    a.x < b.x + b.w + CARD_GAP - EPS &&
    b.x < a.x + a.w + CARD_GAP - EPS &&
    a.y < b.y + b.h + CARD_GAP - EPS &&
    b.y < a.y + a.h + CARD_GAP - EPS
  );
}

// Closest position to the item's own that is clear of every placed card.
// An optimal spot always lines up with the item's current x/y or with an edge of a placed
// card, so those are the only candidates worth trying.
function nearestFreeSpot(item: LayoutItem, placed: LayoutItem[]): Point {
  const xs = [item.x];
  const ys = [item.y];
  for (const p of placed) {
    xs.push(p.x + p.w + CARD_GAP, p.x - item.w - CARD_GAP);
    ys.push(p.y + p.h + CARD_GAP, p.y - item.h - CARD_GAP);
  }

  let best: Point = { x: item.x, y: Math.max(...placed.map((p) => p.y + p.h)) + CARD_GAP };
  let bestDist = Infinity;
  for (const x of xs) {
    for (const y of ys) {
      const dist = (x - item.x) ** 2 + (y - item.y) ** 2;
      if (dist >= bestDist) continue;
      const candidate = { ...item, x, y };
      if (!placed.some((p) => collides(candidate, p))) {
        best = { x, y };
        bestDist = dist;
      }
    }
  }
  return best;
}

const MONTH_GAP = 80; // between neighbouring months in the row
const NOTE_GAP = 40; // between notes, both across and down
const SHELF_GAP = 80; // between the notes grid and the months row
const NOTE_COLUMNS = 5;

export interface OrganizeInput {
  // Month cards, with `idx` the month's chronological index
  months: { id: string; idx: number }[];
  // Document cards, with `order` their creation order
  notes: { id: string; order: number; w: number; h: number }[];
  monthWidth: number;
  // The month the notes grid is lined up above
  anchorMonthId: string;
}

// A tidy canvas: months in one row in date order, notes in a neat grid just above the
// anchor month, oldest first. Returns a position for every month and note.
export function organizeLayout({
  months,
  notes,
  monthWidth,
  anchorMonthId,
}: OrganizeInput): Record<string, Point> {
  const out: Record<string, Point> = {};

  const stride = monthWidth + MONTH_GAP;
  [...months]
    .sort((a, b) => a.idx - b.idx)
    .forEach((m, i) => {
      out[m.id] = { x: i * stride, y: 0 };
    });

  const shelfX = out[anchorMonthId]?.x ?? 0;
  const ordered = [...notes].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  const rows: (typeof ordered)[] = [];
  for (let i = 0; i < ordered.length; i += NOTE_COLUMNS) {
    rows.push(ordered.slice(i, i + NOTE_COLUMNS));
  }

  const rowHeights = rows.map((row) => Math.max(...row.map((n) => n.h)));
  const shelfHeight = rowHeights.reduce((sum, h) => sum + h, 0) + NOTE_GAP * Math.max(0, rows.length - 1);
  let y = -(shelfHeight + SHELF_GAP);
  rows.forEach((row, r) => {
    let x = shelfX;
    for (const note of row) {
      out[note.id] = { x, y };
      x += note.w + NOTE_GAP;
    }
    y += rowHeights[r] + NOTE_GAP;
  });

  for (const id of Object.keys(out)) {
    out[id] = { x: Math.round(out[id].x), y: Math.round(out[id].y) };
  }
  return out;
}

// `items` must be ordered by priority: earlier cards keep their spot, later ones get moved
// aside when they collide. Returns only the cards that had to move.
export function resolveLayout(items: LayoutItem[]): Record<string, Point> {
  const placed: LayoutItem[] = [];
  const moved: Record<string, Point> = {};

  for (const item of items) {
    let current = item;
    if (placed.some((p) => collides(item, p))) {
      const pos = nearestFreeSpot(item, placed);
      moved[item.id] = pos;
      current = { ...item, ...pos };
    }
    placed.push(current);
  }

  return moved;
}
