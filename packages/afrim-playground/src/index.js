"use strict";

const DATA_URL =
  "https://raw.githubusercontent.com/fodydev/afrim-data/68910ab450d652f17068ab3b5b006295b5d4bda4";
const DRILL_WORDS = 12;

// Supported languages: dataset folder in https://github.com/fodydev/afrim-data => name.
const LANGUAGES = {
  gez: "Ge'ez",
  geezime: "Ge'ez (GeezIME)",
  am: "Amharic",
  ethiopic: "Ethiopic",
  bax: "Bamum",
  byv: "Medumba",
  fmp: "Nufi",
  ewo: "Ewondo",
  clafrica: "Clafrica",
  vie: "Vietnamese (telex & vni)",
  telex: "Vietnamese (telex)",
  vni: "Vietnamese (vni)",
};

const params = new URL(window.location).searchParams;

// --- Settings ---
// A setting comes from the URL first, then from the saved preference.
function readFlag(param, storageKey, fallback = true) {
  const value = params.get(param);
  if (value !== null) return /^(on|yes|1|true)$/.test(value);
  const saved = localStorage.getItem(storageKey);
  return saved === null ? fallback : saved === "true";
}

// Reload the page with a new URL parameter (the dataset must be reloaded).
function reloadWith(param, value) {
  const loc = new URL(window.location);
  loc.searchParams.set(param, value);
  window.location = loc.href;
}

const configUrlParam = params.get("configUrl");
const lang = params.get("lang") || sessionStorage.getItem("lang") || "gez";
const configUrl = configUrlParam || `${DATA_URL}/${lang}/${lang}.toml`;
const settings = {
  ime: readFlag("ime", "afrim_ime"),
  // The dictionary can be big, so it is only loaded on demand.
  dict: readFlag("dict", "afrim_dict", false),
  pdict: readFlag("pdict", "afrim_translator"),
};
sessionStorage.setItem("lang", lang);
localStorage.setItem("afrim_ime", settings.ime);
localStorage.setItem("afrim_dict", settings.dict);
localStorage.setItem("afrim_translator", settings.pdict);

// --- Elements ---
const textarea = document.getElementById("textfield");
const targetBox = document.getElementById("target");
const hintBox = document.getElementById("hint");
const resultsBox = document.getElementById("results");
const langSelect = document.getElementById("lang-select");
const exerciseSelect = document.getElementById("exercise-select");
const customPanel = document.getElementById("custom-panel");
const customText = document.getElementById("custom-text");

// --- State ---
let charset = []; // Characters of the dataset, used for random drills.
let hints = {}; // Character => shortest Afrim code producing it.
let target = [];
let startTime = null;
let finished = false;
let lastValue = null;

// --- Dataset ---
async function loadDataset() {
  const status = document.getElementById("download-status");
  status.hidden = false;

  const config = new AfrimConfig();
  try {
    await config.loadFromUrl(
      configUrl,
      status,
      !(settings.ime && settings.dict),
      !(settings.ime && settings.pdict),
    );
  } catch (err) {
    console.error(err);
    status.classList.replace("is-info", "is-danger");
    status.textContent = `Could not load the dataset (${configUrl}). You can still practice your own text with your own keyboard.`;
    return null;
  }
  status.hidden = true;

  for (const [code, value] of Object.entries(config.data)) {
    const char = value.normalize("NFC");
    if (!/[^\x00-\x7F]/.test(char)) continue;
    if (!hints[char] || code.length < hints[char].length) hints[char] = code;
  }
  charset = Object.keys(hints).filter(
    (c) =>
      Array.from(c).length === 1 && /\p{L}/u.test(c) && c === c.toLowerCase(),
  );

  return config;
}

// --- Exercises ---
function randomDrill() {
  const pick = () => charset[Math.floor(Math.random() * charset.length)];
  const words = [];
  for (let i = 0; i < DRILL_WORDS; i++) {
    const length = 2 + Math.floor(Math.random() * 3);
    words.push(Array.from({ length }, pick).join(""));
  }
  return words.join(" ");
}

function pickText() {
  if (exerciseSelect.value === "custom") return customText.value.trim();
  return charset.length ? randomDrill() : "";
}

// --- Round ---
function newRound(text = pickText()) {
  customPanel.hidden = exerciseSelect.value !== "custom";
  target = Array.from(text.replace(/\s+/g, " ").normalize("NFC"));

  startTime = null;
  finished = false;
  lastValue = null;
  textarea.value = "";
  textarea.readOnly = false;
  resultsBox.hidden = true;
  // Reset the Afrim input buffer.
  textarea.dispatchEvent(new Event("click"));
  textarea.focus();
  update();
}

function stats() {
  const typed = Array.from(textarea.value.normalize("NFC"));
  const correct = typed.filter((c, i) => c === target[i]).length;
  const seconds = startTime ? (Date.now() - startTime) / 1000 : 0;
  const cpm = seconds ? (correct / seconds) * 60 : 0;
  return {
    typed,
    seconds,
    wpm: Math.round(cpm / 5),
    accuracy: typed.length ? Math.round((correct / typed.length) * 100) : 100,
  };
}

function renderTarget(typed) {
  targetBox.innerHTML = "";
  if (!target.length) {
    targetBox.textContent =
      exerciseSelect.value === "custom"
        ? "Paste or write your text above, then press “Use this text”."
        : "No letters found in this dataset. Try “My own text”.";
    return;
  }

  let next = typed.length;
  target.forEach((c, i) => {
    const span = document.createElement("span");
    span.textContent = c;
    if (i < typed.length) {
      span.className = typed[i] === c ? "ok" : "bad";
      if (typed[i] !== c && next === typed.length) next = i;
    } else if (i === typed.length) {
      span.className = "current";
    }
    targetBox.append(span);
  });

  // Hint for the first character not yet typed correctly.
  const c = target[next];
  if (c === undefined) {
    hintBox.innerHTML = "&nbsp;";
  } else if (c === " ") {
    hintBox.innerHTML = "Next: <kbd>Space</kbd>";
  } else if (settings.ime && hints[c]) {
    hintBox.innerHTML = `Next: <span class="hint-char"></span> → type <kbd></kbd>`;
    hintBox.querySelector(".hint-char").textContent = c;
    hintBox.querySelector("kbd").textContent = hints[c];
  } else {
    hintBox.innerHTML = `Next: <span class="hint-char"></span>`;
    hintBox.querySelector(".hint-char").textContent = c;
  }
}

function renderStats(s) {
  document.getElementById("stat-wpm").textContent = s.wpm;
  document.getElementById("stat-accuracy").textContent = `${s.accuracy}%`;
  document.getElementById("stat-time").textContent =
    `${Math.floor(s.seconds)}s`;
  const progress = target.length
    ? Math.round(
        (Math.min(s.typed.length, target.length) / target.length) * 100,
      )
    : 0;
  document.getElementById("progress").value = progress;
}

function update() {
  if (finished) return;
  if (textarea.value && !startTime) startTime = Date.now();

  const s = stats();
  if (textarea.value !== lastValue) {
    lastValue = textarea.value;
    renderTarget(s.typed);
  }
  renderStats(s);

  // Done when the whole text is typed and the last character is right.
  const last = target.length - 1;
  if (last >= 0 && s.typed.length > last && s.typed[last] === target[last]) {
    finish(s);
  }
}

function finish(s) {
  finished = true;
  textarea.readOnly = true;

  const bestKey = `afrim_best_${lang}`;
  const best = Math.max(s.wpm, Number(localStorage.getItem(bestKey)) || 0);
  localStorage.setItem(bestKey, best);

  document.getElementById("result-text").textContent =
    `${s.wpm} WPM · ${s.accuracy}% accuracy · ${Math.round(s.seconds)}s` +
    (s.wpm >= best ? " — new personal best! 🎉" : ` (best: ${best} WPM)`);
  resultsBox.hidden = false;
  document.getElementById("btn-next").focus();
}

// --- Theme ---
// No saved choice means following the system preference.
function currentTheme() {
  const saved = document.documentElement.dataset.theme;
  if (saved) return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function renderThemeButton() {
  const icon = currentTheme() === "dark" ? "fa-sun" : "fa-moon";
  document.getElementById("btn-theme").querySelector("i").className =
    `fas ${icon}`;
}

function setupTheme() {
  renderThemeButton();
  document.getElementById("btn-theme").addEventListener("click", () => {
    const theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("afrim_theme", theme);
    renderThemeButton();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener(
    "change",
    renderThemeButton,
  );
}

// --- Wiring ---
function setupControls() {
  setupTheme();

  // Navbar burger
  document.querySelectorAll(".navbar-burger").forEach((el) => {
    el.addEventListener("click", () => {
      const active = el.classList.toggle("is-active");
      el.setAttribute("aria-expanded", active);
      document.getElementById(el.dataset.target).classList.toggle("is-active");
    });
  });

  // Language
  if (configUrlParam) {
    langSelect.add(new Option("Custom dataset", "", true, true));
  }
  for (const [code, name] of Object.entries(LANGUAGES)) {
    langSelect.add(new Option(name, code, false, code === lang));
  }
  langSelect.addEventListener("change", (e) => {
    const loc = new URL(window.location);
    loc.searchParams.delete("configUrl");
    loc.searchParams.set("lang", e.target.value);
    window.location = loc.href;
  });

  // Afrim toggles
  const toggles = {
    ime: "toggle-ime",
    dict: "toggle-dict",
    pdict: "toggle-pdict",
  };
  for (const [param, id] of Object.entries(toggles)) {
    document.getElementById(id).checked = settings[param];
    document.getElementById(id).addEventListener("change", (e) => {
      if (
        param === "dict" &&
        e.target.checked &&
        !confirm(
          "Some languages have a big dictionary, it can take some time to download.\n\nLoad the dictionary?",
        )
      ) {
        e.target.checked = false;
        return;
      }
      reloadWith(param, e.target.checked);
    });
  }
  document.getElementById("ime-options").hidden = !settings.ime;
  document.getElementById("shortcuts").hidden = !settings.ime;

  // Exercise
  exerciseSelect.addEventListener("change", () => newRound());
  customText.value = localStorage.getItem("afrim_custom_text") || "";
  document.getElementById("btn-custom").addEventListener("click", () => {
    localStorage.setItem("afrim_custom_text", customText.value);
    newRound();
  });

  // Round
  // Restart keeps the same text, even for random drills.
  document
    .getElementById("btn-restart")
    .addEventListener("click", () => newRound(target.join("")));
  document
    .getElementById("btn-next")
    .addEventListener("click", () => newRound());

  // Typing
  textarea.addEventListener("keydown", (e) => {
    // The text is a single line.
    if (e.key === "Enter") e.preventDefault();
  });
  // Afrim edits the text field on keyup, so we read it right after.
  for (const event of ["input", "keyup"]) {
    textarea.addEventListener(event, () => setTimeout(update, 0));
  }
  setInterval(update, 250);
}

async function main() {
  setupControls();
  const config = await loadDataset();
  if (!charset.length) exerciseSelect.value = "custom";

  if (config && settings.ime) {
    new AfrimInput({
      textFieldElementID: "textfield",
      downloadStatusElementID: "download-status",
      tooltipElementID: "tooltip",
      tooltipInputElementID: "tooltip-input",
      tooltipPredicatesElementID: "tooltip-predicates",
      tooltipAdjustLeft: 0,
      tooltipAdjustTop: 36,
      configUrl: configUrl,
      config: config,
      ignoreTranslation: !settings.dict,
      ignoreTranslators: !settings.pdict,
    });
    // Let Afrim attach itself to the text field first.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  newRound();
}

main().catch((err) => console.error(err));
