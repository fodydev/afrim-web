// Typing trainer for the Afrim input method.
// `AfrimInput`, `AfrimConfig` and `preloadAfrim` come from afrim_input.js.

const DRILL_WORDS = 12;
const params = new URL(window.location).searchParams;

// --- Data source ---
// The datasets come from an afrim-data site (see its README "Web access"):
// `?dataUrl=` overrides the one chosen at build time (AFRIM_DATA_URL).
const dataUrl = new URL(
  (params.get("dataUrl") || process.env.AFRIM_DATA_URL).replace(/\/?$/, "/"),
  window.location,
);
// A custom configuration URL bypasses the dataset list.
const customConfigUrl = params.get("configUrl");

// --- Settings ---
// A setting comes from the URL first, then from the saved preference.
function readFlag(param, storageKey, fallback = true) {
  const value = params.get(param);
  if (value !== null) return /^(on|yes|1|true)$/.test(value);
  const saved = localStorage.getItem(storageKey);
  return saved === null ? fallback : saved === "true";
}

const settings = {
  ime: readFlag("ime", "afrim_ime"),
  // The dictionary can be big, so it is only loaded on demand.
  dict: readFlag("dict", "afrim_dict", false),
  pdict: readFlag("pdict", "afrim_translator"),
};
localStorage.setItem("afrim_ime", settings.ime);
localStorage.setItem("afrim_dict", settings.dict);
localStorage.setItem("afrim_translator", settings.pdict);

// Reload the page with changed URL parameters (the dataset must be
// reloaded). A `null` value removes the parameter.
function reloadWith(changes) {
  const url = new URL(window.location);
  for (const [param, value] of Object.entries(changes)) {
    if (value === null) url.searchParams.delete(param);
    else url.searchParams.set(param, value);
  }
  window.location = url.href;
}

// --- Elements ---
const byId = (id) => document.getElementById(id);
const el = {
  status: byId("download-status"),
  textarea: byId("textfield"),
  target: byId("target"),
  hint: byId("hint"),
  results: byId("results"),
  resultText: byId("result-text"),
  langSelect: byId("lang-select"),
  exerciseSelect: byId("exercise-select"),
  customPanel: byId("custom-panel"),
  customText: byId("custom-text"),
  progress: byId("progress"),
  wpm: byId("stat-wpm"),
  accuracy: byId("stat-accuracy"),
  time: byId("stat-time"),
};

function showError(message) {
  el.status.classList.replace("is-info", "is-danger");
  el.status.textContent = message;
  el.status.hidden = false;
}

// --- State ---
let lang = null; // Directory of the selected dataset, null when custom.
let charset = []; // Characters of the dataset, used for random drills.
const hints = {}; // Character => shortest Afrim code producing it.
let updateScheduled = false;

// The current round, reset by `newRound`.
const round = {
  target: [], // Characters to type.
  spans: [], // One span per target character, built once per round.
  renderedTyped: [], // Typed characters the spans currently reflect.
  startTime: null,
  finished: false,
  lastValue: null, // Text field value of the last update.
  counts: { typedLength: 0, correct: 0 }, // From the last update.
};

// --- Datasets ---
// Datasets published by afrim-data: [{ name, description, dir, config }].
async function fetchDatasets() {
  const url = new URL("datasets.json", dataUrl);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.statusText}`);
  return response.json();
}

// The dataset asked in the URL, else the last used one, else the first one.
function chooseDataset(datasets) {
  const wanted = params.get("lang") || sessionStorage.getItem("lang");
  return datasets.find((dataset) => dataset.dir === wanted) ?? datasets[0];
}

function renderLanguageOptions(datasets) {
  if (customConfigUrl) {
    el.langSelect.add(new Option("Custom dataset", "", true, true));
  }
  for (const { name, description, dir } of datasets) {
    const option = new Option(name, dir, false, dir === lang);
    option.title = description;
    el.langSelect.add(option);
  }
}

// Load the configuration and index its characters for drills and hints.
async function loadDataset(configUrl) {
  el.status.hidden = false;

  const config = new AfrimConfig();
  try {
    await config.loadFromUrl(
      configUrl,
      el.status,
      !(settings.ime && settings.dict),
      !(settings.ime && settings.pdict),
    );
  } catch (err) {
    console.error(err);
    showError(
      `Could not load the dataset (${configUrl}). You can still practice your own text with your own keyboard.`,
    );
    return null;
  }
  el.status.hidden = true;

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
  if (el.exerciseSelect.value === "custom") return el.customText.value.trim();
  return charset.length ? randomDrill() : "";
}

// --- Round ---
function newRound(text = pickText()) {
  el.customPanel.hidden = el.exerciseSelect.value !== "custom";

  Object.assign(round, {
    target: Array.from(text.replace(/\s+/g, " ").normalize("NFC")),
    renderedTyped: [],
    startTime: null,
    finished: false,
    lastValue: null,
    counts: { typedLength: 0, correct: 0 },
  });
  buildTarget();

  el.textarea.value = "";
  el.textarea.readOnly = false;
  el.results.hidden = true;
  // Reset the Afrim input buffer.
  el.textarea.dispatchEvent(new Event("click"));
  el.textarea.focus();
  update();
}

function countCorrect(typed) {
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === round.target[i]) correct++;
  }
  return correct;
}

// Index of the first character not typed correctly.
function firstMismatch(typed) {
  let i = 0;
  while (i < typed.length && typed[i] === round.target[i]) i++;
  return i;
}

function computeStats({ typedLength, correct }) {
  const seconds = round.startTime ? (Date.now() - round.startTime) / 1000 : 0;
  const charsPerMinute = seconds ? (correct / seconds) * 60 : 0;
  return {
    typedLength,
    seconds,
    wpm: Math.round(charsPerMinute / 5),
    accuracy: typedLength ? Math.round((correct / typedLength) * 100) : 100,
  };
}

// --- Rendering ---
// Create the target spans once per round.
function buildTarget() {
  round.spans = round.target.map((c, i) => {
    const span = document.createElement("span");
    span.textContent = c;
    if (i === 0) span.className = "current";
    return span;
  });
  el.target.replaceChildren(...round.spans);

  if (!round.target.length) {
    el.target.textContent =
      el.exerciseSelect.value === "custom"
        ? "Paste or write your text above, then press “Use this text”."
        : "No letters found in this dataset. Try “My own text”.";
  }
}

function spanClass(typed, i) {
  if (i < typed.length) return typed[i] === round.target[i] ? "ok" : "bad";
  return i === typed.length ? "current" : "";
}

function renderTarget(typed) {
  if (!round.target.length) return;

  // Only the spans from the first changed character up to the end of the
  // longer text (old or new, including the cursor) can have changed.
  const previous = round.renderedTyped;
  const common = Math.min(typed.length, previous.length);
  let from = 0;
  while (from < common && typed[from] === previous[from]) from++;
  const to = Math.min(
    Math.max(typed.length, previous.length),
    round.target.length - 1,
  );
  for (let i = from; i <= to; i++) {
    round.spans[i].className = spanClass(typed, i);
  }
  round.renderedTyped = typed;

  renderHint(round.target[firstMismatch(typed)]);
}

// Hint for the next character to type.
function renderHint(char) {
  if (char === undefined) {
    el.hint.innerHTML = "&nbsp;";
  } else if (char === " ") {
    el.hint.innerHTML = "Next: <kbd>Space</kbd>";
  } else if (settings.ime && hints[char]) {
    el.hint.innerHTML = `Next: <span class="hint-char"></span> → type <kbd></kbd>`;
    el.hint.querySelector(".hint-char").textContent = char;
    el.hint.querySelector("kbd").textContent = hints[char];
  } else {
    el.hint.innerHTML = `Next: <span class="hint-char"></span>`;
    el.hint.querySelector(".hint-char").textContent = char;
  }
}

function renderStats(stats) {
  el.wpm.textContent = stats.wpm;
  el.accuracy.textContent = `${stats.accuracy}%`;
  el.time.textContent = `${Math.floor(stats.seconds)}s`;
  const { length } = round.target;
  el.progress.value = length
    ? Math.round((Math.min(stats.typedLength, length) / length) * 100)
    : 0;
}

// --- Updates ---
function update() {
  if (round.finished) return;
  const { value } = el.textarea;
  if (value && !round.startTime) round.startTime = Date.now();
  if (value === round.lastValue) return;
  round.lastValue = value;

  const typed = Array.from(value.normalize("NFC"));
  round.counts = { typedLength: typed.length, correct: countCorrect(typed) };

  renderTarget(typed);
  const stats = computeStats(round.counts);
  renderStats(stats);

  // Done when the whole text is typed and the last character is right.
  const last = round.target.length - 1;
  if (last >= 0 && typed.length > last && typed[last] === round.target[last]) {
    finish(stats);
  }
}

// Run update at most once per frame, after Afrim has edited the text field.
function scheduleUpdate() {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(() => {
    updateScheduled = false;
    update();
  });
}

// Keep the timer and WPM live while a round is running.
function tick() {
  if (!round.startTime || round.finished) return;
  renderStats(computeStats(round.counts));
}

function finish(stats) {
  round.finished = true;
  el.textarea.readOnly = true;

  const bestKey = `afrim_best_${lang ?? "custom"}`;
  const best = Math.max(stats.wpm, Number(localStorage.getItem(bestKey)) || 0);
  localStorage.setItem(bestKey, best);

  el.resultText.textContent =
    `${stats.wpm} WPM · ${stats.accuracy}% accuracy · ${Math.round(stats.seconds)}s` +
    (stats.wpm >= best ? " — new personal best! 🎉" : ` (best: ${best} WPM)`);
  el.results.hidden = false;
  byId("btn-next").focus();
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
  byId("btn-theme").querySelector("i").className = `fas ${icon}`;
}

function setupTheme() {
  renderThemeButton();
  byId("btn-theme").addEventListener("click", () => {
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
  document.querySelectorAll(".navbar-burger").forEach((burger) => {
    burger.addEventListener("click", () => {
      const active = burger.classList.toggle("is-active");
      burger.setAttribute("aria-expanded", active);
      byId(burger.dataset.target).classList.toggle("is-active");
    });
  });

  // Language
  el.langSelect.addEventListener("change", (e) => {
    reloadWith({ configUrl: null, lang: e.target.value });
  });

  // Afrim toggles
  const toggles = {
    ime: "toggle-ime",
    dict: "toggle-dict",
    pdict: "toggle-pdict",
  };
  for (const [param, id] of Object.entries(toggles)) {
    const toggle = byId(id);
    toggle.checked = settings[param];
    toggle.addEventListener("change", () => {
      if (
        param === "dict" &&
        toggle.checked &&
        !confirm(
          "Some languages have a big dictionary, it can take some time to download.\n\nLoad the dictionary?",
        )
      ) {
        toggle.checked = false;
        return;
      }
      reloadWith({ [param]: toggle.checked });
    });
  }
  byId("ime-options").hidden = !settings.ime;
  byId("shortcuts").hidden = !settings.ime;

  // Exercise
  el.exerciseSelect.addEventListener("change", () => newRound());
  el.customText.value = localStorage.getItem("afrim_custom_text") || "";
  byId("btn-custom").addEventListener("click", () => {
    localStorage.setItem("afrim_custom_text", el.customText.value);
    newRound();
  });

  // Round
  // Restart keeps the same text, even for random drills.
  byId("btn-restart").addEventListener("click", () =>
    newRound(round.target.join("")),
  );
  byId("btn-next").addEventListener("click", () => newRound());

  // Typing
  el.textarea.addEventListener("keydown", (e) => {
    // The text is a single line.
    if (e.key === "Enter") e.preventDefault();
  });
  // Afrim edits the text field on keyup, so we read it right after.
  for (const eventName of ["input", "keyup"]) {
    el.textarea.addEventListener(eventName, scheduleUpdate);
  }
  setInterval(tick, 250);
}

// The configuration to load: the custom one, or the chosen dataset's.
async function resolveConfigUrl(datasetsRequest) {
  if (customConfigUrl) return customConfigUrl;

  const dataset = chooseDataset(await datasetsRequest);
  if (!dataset) throw new Error(`${dataUrl}datasets.json is empty`);

  lang = dataset.dir;
  sessionStorage.setItem("lang", lang);
  return new URL(dataset.config, dataUrl).href;
}

async function startAfrim(configUrl, config) {
  const afrimInput = new AfrimInput({
    textFieldElementID: "textfield",
    downloadStatusElementID: "download-status",
    tooltipElementID: "tooltip",
    tooltipInputElementID: "tooltip-input",
    tooltipPredicatesElementID: "tooltip-predicates",
    tooltipAdjustLeft: 0,
    tooltipAdjustTop: 36,
    configUrl,
    config,
    ignoreTranslation: !settings.dict,
    ignoreTranslators: !settings.pdict,
  });
  try {
    await afrimInput.ready;
  } catch (err) {
    console.error("Error initializing Afrim input:", err);
    showError(
      "Afrim couldn't start. You can still practice with your own keyboard.",
    );
  }
}

async function main() {
  setupControls();
  // Download the engine (also used to parse the dataset) while we find out
  // which dataset to load.
  preloadAfrim();

  const datasetsRequest = fetchDatasets();
  let config = null;
  try {
    const configUrl = await resolveConfigUrl(datasetsRequest);
    // The language list is not needed to start typing.
    datasetsRequest.then(renderLanguageOptions, () => {});

    config = await loadDataset(configUrl);
    if (config && settings.ime) await startAfrim(configUrl, config);
  } catch (err) {
    console.error(err);
    showError(
      `Could not load the dataset list (${dataUrl}datasets.json). You can still practice your own text with your own keyboard.`,
    );
  }

  if (!charset.length) el.exerciseSelect.value = "custom";
  newRound();
}

main().catch((err) => console.error(err));
