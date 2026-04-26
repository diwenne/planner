# Planner

A minimal calendar planner that runs in your browser. No account needed. Your data saves automatically.

**Live version (no setup):** [plannerrrrr.vercel.app](https://plannerrrrr.vercel.app)

---

## Running Locally

### 1. Install Node.js

Download and install from [nodejs.org](https://nodejs.org) (click the LTS button).

### 2. Open a terminal

**Mac:** Open **Terminal** (Cmd + Space, type "Terminal", press Enter).

**Windows:** Open **Command Prompt** (press the Windows key, type "cmd", press Enter).

### 3. Paste these commands one at a time

```
git clone https://github.com/diwenne/planner.git
```

```
cd planner
```

```
npm install
```

```
npm run dev
```

### 4. Open in your browser

Go to [localhost:3000](http://localhost:3000).

---

## Usage

Click any day and start typing. Changes save automatically.

### Formatting

Type `/` to open the command menu (to-do, heading, quote, numbered list, etc).

You can also type these at the start of an empty line then press Space:

- `- []` for a to-do checkbox
- `1.` for a numbered list
- `#` for a heading

### Keyboard

| Shortcut | Action |
|:---------|:-------|
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |
| Cmd/Ctrl + A | Select all in cell |
| Cmd/Ctrl + Plus | Zoom in |
| Cmd/Ctrl + Minus | Zoom out |
| Cmd/Ctrl + 0 | Reset zoom |

### Pasting from Notion / Markdown

Copy tasks from Notion (or any markdown) and paste them directly. Lines starting with `- [ ]` become checkboxes automatically.

### Export / Import

Use the Export and Import buttons in the top bar to back up or restore your data. You can either copy/paste the data as text or download/upload a file.

If you clear your browser data, your notes will be erased. Export regularly.

---

## License

MIT
