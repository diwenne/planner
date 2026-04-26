# Planner

A minimal calendar planner that runs in your browser. No account needed. Your data saves automatically.

**Live version:** [plannerrrrr.vercel.app](https://plannerrrrr.vercel.app)

---

## Quick Start

If you just want to use it, open the link above. Everything saves to your browser automatically.

To back up your data or move it to another device, use the **Export** and **Import** buttons in the top bar.

---

## Running Locally

Running locally saves your data to a file on your computer so it never gets lost.

### Prerequisites

Install Node.js from [nodejs.org](https://nodejs.org) (download the LTS version).

### Setup

**Mac:** Open **Terminal** (search for it with Cmd + Space).

**Windows:** Open **Command Prompt** (search for it in the Start menu).

Then run:

```
cd path/to/planner
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000) in your browser.

---

## Usage

### Editing

Click any day cell and start typing. Changes save automatically.

### Shortcuts (type at the start of an empty line, then press Space)

| Input | Result |
|:------|:-------|
| `- []` | To-do checkbox |
| `- [x]` | Checked to-do |
| `1.` | Numbered list |
| `#` | Heading |
| `>` | Quote |
| `/` | Command menu |

### Keyboard Shortcuts

| Shortcut | Action |
|:---------|:-------|
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |
| Cmd/Ctrl + A | Select all in cell |
| Cmd/Ctrl + Plus | Zoom in |
| Cmd/Ctrl + Minus | Zoom out |
| Cmd/Ctrl + 0 | Reset zoom |

### Navigation

- Scroll or drag to pan
- Pinch to zoom
- Arrow buttons to switch months

### Pasting from Notion

Copy your Notion tasks and paste them directly. Lines starting with `- [ ]` become checkboxes automatically.

### Export / Import

- **Export > Copy to Clipboard:** Copy your data as text. Paste it into the Import box on another device.
- **Export > Download as File:** Save a `.json` backup file.
- **Import > Upload File:** Restore from a `.json` file.
- **Import > Paste:** Paste exported text to restore.

If you clear your browser data, your notes will be erased. Export regularly.

---

## License

MIT
