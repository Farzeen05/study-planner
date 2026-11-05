// ---------- State ----------
const STORAGE_KEY = "studyPlanner.tasks";
const THEME_KEY = "studyPlanner.theme";
let tasks = load();
let filter = "all";
let searchText = "";
let sortMode = "manual";
let editingId = null;
let dragId = null;

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const form = $("taskForm"), list = $("taskList"), emptyMsg = $("empty");

// ---------- Storage ----------
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

// ---------- Helpers ----------
const PRIORITY = { 1: "High", 2: "Medium", 3: "Low" };
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isOverdue(t) { return !t.completed && t.due && t.due < todayStr(); }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ---------- Actions ----------
function addTask(name, due, category, priority) {
  tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, due, category, priority: Number(priority), completed: false });
  save(); render();
}
function toggleTask(id) { const t = tasks.find(t => t.id === id); t.completed = !t.completed; save(); render(); }
function deleteTask(id) { tasks = tasks.filter(t => t.id !== id); save(); render(); }
function renameTask(id, name) {
  name = name.trim();
  if (name) tasks.find(t => t.id === id).name = name;
  editingId = null; save(); render();
}
function moveTask(fromId, toId) {
  const from = tasks.findIndex(t => t.id === fromId);
  const [item] = tasks.splice(from, 1);
  const to = tasks.findIndex(t => t.id === toId);
  tasks.splice(to, 0, item);
  save(); render();
}

// ---------- Rendering ----------
function visibleTasks() {
  let result = tasks.filter(t =>
    (filter === "all" || (filter === "completed" ? t.completed : !t.completed)) &&
    t.name.toLowerCase().includes(searchText.toLowerCase()));
  if (sortMode === "due") {
    result = [...result].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  } else if (sortMode === "priority") {
    result = [...result].sort((a, b) => a.priority - b.priority);
  }
  return result;
}

function renderStats() {
  const done = tasks.filter(t => t.completed).length;
  $("statTotal").textContent = tasks.length;
  $("statDone").textContent = done;
  $("statPending").textContent = tasks.length - done;
}

function buildTask(t) {
  const li = el("li", `task p${t.priority}`);
  if (t.completed) li.classList.add("done");
  if (isOverdue(t)) li.classList.add("overdue");

  const check = el("input");
  check.type = "checkbox"; check.checked = t.completed;
  check.setAttribute("aria-label", "Mark completed");
  check.addEventListener("change", () => toggleTask(t.id));

  const body = el("div", "body");
  if (editingId === t.id) {
    const input = el("input", "edit-input");
    input.value = t.name; input.maxLength = 120;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") renameTask(t.id, input.value);
      if (e.key === "Escape") { editingId = null; render(); }
    });
    input.addEventListener("blur", () => { if (editingId === t.id) renameTask(t.id, input.value); });
    body.append(input);
    setTimeout(() => input.focus(), 0);
  } else {
    body.append(el("div", "name", t.name));
  }
  const meta = el("div", "meta");
  meta.append(el("span", "", t.category), el("span", "", `${PRIORITY[t.priority]} priority`));
  if (t.due) meta.append(el("span", isOverdue(t) ? "late" : "", (isOverdue(t) ? "Overdue: " : "Due ") + t.due));
  body.append(meta);

  const actions = el("div", "actions");
  const edit = el("button", "", "Edit");
  edit.addEventListener("click", () => { editingId = t.id; render(); });
  const del = el("button", "del", "Delete");
  del.addEventListener("click", () => deleteTask(t.id));
  actions.append(edit, del);

  li.append(check, body, actions);

  // Drag and drop (manual order only)
  if (sortMode === "manual") {
    li.draggable = true;
    li.classList.add("draggable");
    li.addEventListener("dragstart", (e) => {
      dragId = t.id; li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", t.id);
    });
    li.addEventListener("dragend", () => { dragId = null; li.classList.remove("dragging"); });
    li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("over"); });
    li.addEventListener("dragleave", () => li.classList.remove("over"));
    li.addEventListener("drop", (e) => {
      e.preventDefault(); li.classList.remove("over");
      if (dragId && dragId !== t.id) moveTask(dragId, t.id);
    });
  }
  return li;
}

function render() {
  const shown = visibleTasks();
  list.replaceChildren(...shown.map(buildTask));
  emptyMsg.hidden = shown.length > 0;
  renderStats();
}

// ---------- Events ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("taskName").value.trim();
  if (!name) return;
  addTask(name, $("taskDue").value, $("taskCategory").value, $("taskPriority").value);
  form.reset();
  $("taskPriority").value = "2";
});
$("search").addEventListener("input", (e) => { searchText = e.target.value; render(); });
$("sort").addEventListener("change", (e) => { sortMode = e.target.value; render(); });
document.querySelectorAll(".filters button").forEach(btn =>
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".filters button").forEach(b => b.classList.toggle("active", b === btn));
    render();
  }));

// ---------- Dark mode ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeToggle").textContent = theme === "dark" ? "Light mode" : "Dark mode";
}
const savedTheme = localStorage.getItem(THEME_KEY) ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
applyTheme(savedTheme);
$("themeToggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

render();