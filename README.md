# 📅 Planner

A clean, minimal planner that works right in your browser. No account needed, no sign-up, no cloud — your data stays on your computer.

## 🚀 Try It Now (No Setup Required)

**Just open this link:** [plannerrrrr.vercel.app](https://plannerrrrr.vercel.app)

- Your data saves automatically to your browser
- It stays even if you close the tab or restart your computer
- Use the **Export** button to back up your notes as a file
- Use the **Import** button to restore from a backup

> **⚠️ Heads up:** If you clear your browser data/cookies, your notes will be erased. Use the Export button regularly to keep a backup!

---

## 🖥️ Run It Locally (Optional)

If you want to run it on your own computer for faster performance or to keep a local copy of your data, follow these steps:

### Step 1: Install Node.js

You need Node.js installed. If you don't have it:

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the big green button)
3. Open the installer and follow the steps

### Step 2: Download the Planner

1. Go to [github.com/diwenne/planner](https://github.com/diwenne/planner)
2. Click the green **Code** button → **Download ZIP**
3. Unzip the folder somewhere you can find it (like your Desktop)

### Step 3: Open a Terminal

**On Mac:**
1. Open the app called **Terminal** (search for it in Spotlight with `Cmd + Space`)
2. Type `cd ` (with a space after it), then drag the unzipped planner folder into the Terminal window and press Enter

**On Windows:**
1. Open the app called **Command Prompt** (search for it in the Start menu)
2. Type `cd ` (with a space after it), then paste the path to your unzipped planner folder and press Enter

### Step 4: Install & Run

Type these two commands, one at a time:

```
npm install
```

```
npm run dev
```

You'll see a message like:

```
▲ Next.js 16.x.x
- Local: http://localhost:3000
```

Open [localhost:3000](http://localhost:3000) in your browser — that's your planner!

> **💡 Tip:** When you run locally, your data saves to a file on your computer (`data/planner.json`), so you'll never lose it.

---

## ✏️ How to Use

### Typing
Just click on any day and start typing. Your changes save automatically.

### Shortcuts
Type these at the start of an empty line, then press **Space**:

| What you type | What it becomes |
|:---|:---|
| `- []` | ☐ To-do checkbox |
| `- [x]` | ☑ Checked to-do |
| `1.` | Numbered list |
| `#` | Big heading |
| `>` | Quote block |
| `/` | Opens command menu |

### Keyboard Shortcuts

| Shortcut | What it does |
|:---|:---|
| `Cmd + Z` | Undo |
| `Cmd + Shift + Z` | Redo |
| `Cmd + A` | Select all in a cell |
| `Cmd + +` | Zoom in |
| `Cmd + -` | Zoom out |
| `Cmd + 0` | Reset zoom |

### Navigation
- **Scroll** or **drag** to pan around the calendar
- **Pinch** or use `Cmd +/-` to zoom
- Click **Today** to jump to the current date
- Use **← →** arrows to switch months

### Pasting from Notion
Copy your Notion todos and paste them directly — the planner will automatically convert `- [ ]` lines into checkboxes!

### Backing Up Your Data
- Click **Export** in the top bar to download your notes as a `.json` file
- Click **Import** to restore from a backup file

---

## 📄 License

MIT
