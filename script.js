// ---------- Simple Markdown to HTML ----------
function escapeHtml(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(t) {
  t = t.replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2">');
  t = t.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
  t = t.replace(/`(.+?)`/g, "<code>$1</code>");
  return t;
}

function markdownToHtml(md) {
  const lines = escapeHtml(md).split("\n");
  let html = "", inList = false, inCode = false;

  function closeList() { if (inList) { html += "</ul>"; inList = false; } }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {          // code block
      closeList();
      html += inCode ? "</code></pre>" : "<pre><code>";
      inCode = !inCode;
      continue;
    }
    if (inCode) { html += line + "\n"; continue; }

    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)/))) {   // headings
      closeList();
      html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;
    } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { // list
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^&gt;\s?(.*)/))) {   // quote
      closeList();
      html += `<blockquote>${inline(m[1])}</blockquote>`;
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

// ---------- Storage ----------
const KEY = "mdSlides";
const SAMPLE = `# Welcome
## This is Slide 01
Write your **content** here.

---

# Slide 02
- Point one
- Point two
- Point three

---

# Slide 03
> Thank you!
`;

function loadSaved() { return localStorage.getItem(KEY); }
function save(text) { localStorage.setItem(KEY, text); }

// ---------- Viewer (used in editor + present) ----------
function createViewer(holder) {
  const node = document.getElementById("viewerTpl").content.cloneNode(true);
  holder.appendChild(node);
  const root = holder.querySelector(".viewer");
  const slideEl = root.querySelector(".slide");
  const prev = root.querySelector(".prev");
  const next = root.querySelector(".next");
  const fs = root.querySelector(".fs");
  const count = root.querySelector(".count");

  const v = { root, slides: [], index: 0 };

  v.setMarkdown = function (text) {
    v.slides = text.split(/^---\s*$/m).map(s => s.trim()).filter(s => s !== "");
    if (v.slides.length === 0) v.slides = [""];
    if (v.index > v.slides.length - 1) v.index = v.slides.length - 1;
    v.render();
  };

  v.render = function () {
    slideEl.innerHTML = markdownToHtml(v.slides[v.index]);
    count.textContent = (v.index + 1) + " / " + v.slides.length;
    prev.disabled = v.index === 0;
    next.disabled = v.index === v.slides.length - 1;
  };

  v.go = function (step) {
    const n = v.index + step;
    if (n < 0 || n >= v.slides.length) return;
    v.index = n;
    v.render();
  };

  v.toggleFullscreen = function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.requestFullscreen();
  };

  prev.onclick = () => v.go(-1);
  next.onclick = () => v.go(1);
  fs.onclick = v.toggleFullscreen;

  v.updateFsButton = function () {
    fs.innerHTML = document.fullscreenElement === root
      ? "&#x2715; Exit Full Screen" : "&#x26F6; Full Screen";
  };
  return v;
}

// ---------- App ----------
const screens = { home: "home", editor: "editor", present: "present" };
let current = "home";

const input = document.getElementById("mdInput");
const status = document.getElementById("status");
const editorViewer = createViewer(document.getElementById("editorViewer"));
const presentViewer = createViewer(document.getElementById("presentViewer"));

function show(name) {
  current = name;
  for (const id in screens) {
    document.getElementById(id).classList.toggle("hidden", id !== name);
  }
}

function openEditor(text) {
  input.value = text;
  editorViewer.index = 0;
  editorViewer.setMarkdown(text);
  show("editor");
}

function openPresent(text) {
  presentViewer.index = 0;
  presentViewer.setMarkdown(text);
  show("present");
}

function saveNow() {
  save(input.value);
  status.textContent = "Saved ✓";
  setTimeout(() => (status.textContent = ""), 1500);
}

// Home buttons
document.getElementById("btnNew").onclick = () => {
  if (loadSaved() && !confirm("This will start a new presentation. Saved slides stay until you press Save. Continue?")) return;
  openEditor(SAMPLE);
};
document.getElementById("btnEdit").onclick = () => openEditor(loadSaved() || SAMPLE);
document.getElementById("btnPresent").onclick = () => {
  const saved = loadSaved();
  if (!saved) { alert("No saved slides yet. Create and save first."); return; }
  openPresent(saved);
};

// Editor buttons
document.getElementById("edHome").onclick = () => show("home");
document.getElementById("edSave").onclick = saveNow;
document.getElementById("edPresent").onclick = () => { saveNow(); openPresent(input.value); };
document.getElementById("prHome").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  show("home");
};

// Live preview
input.addEventListener("input", () => editorViewer.setMarkdown(input.value));

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const viewer = current === "editor" ? editorViewer : current === "present" ? presentViewer : null;

  if (e.ctrlKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (current === "editor") saveNow();
    return;
  }
  if (e.key === "F11") {
    e.preventDefault();
    if (viewer) viewer.toggleFullscreen();
    return;
  }
  if (!viewer) return;
  // Do not steal arrow keys while typing in the editor
  if (e.target === input) return;
  if (e.key === "ArrowRight") viewer.go(1);
  if (e.key === "ArrowLeft") viewer.go(-1);
});

document.addEventListener("fullscreenchange", () => {
  editorViewer.updateFsButton();
  presentViewer.updateFsButton();
});
