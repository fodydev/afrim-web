import type { Preprocessor, Translator } from "afrim";
import getCaretCoordinates from "textarea-caret";
import { AfrimConfig } from "./config";
import { loadAfrim } from "./utils";

// Element bindings and behavior; all of them have a default value.
type BaseOptions = {
  textFieldElementID: string;
  downloadStatusElementID: string;
  tooltipElementID: string;
  tooltipInputElementID: string;
  tooltipPredicatesElementID: string;
  tooltipPredicateClass: string;
  tooltipAdjustLeft: number;
  tooltipAdjustTop: number;
  ignoreTranslation: boolean;
  ignoreTranslators: boolean;
};

// Where the configuration comes from: an URL to download, or an already
// loaded configuration (which takes precedence).
type DataSource =
  | { configUrl: string; config?: AfrimConfig }
  | { configUrl?: string; config: AfrimConfig };

/** Options of an {@link AfrimInput}: a data source and optional bindings. */
export type AfrimInputOptions = Partial<BaseOptions> & DataSource;

const DEFAULT_OPTIONS: BaseOptions = {
  textFieldElementID: "textfield",
  downloadStatusElementID: "download-status",
  tooltipElementID: "tooltip",
  tooltipInputElementID: "tooltip-input",
  tooltipPredicatesElementID: "tooltip-predicates",
  tooltipPredicateClass: "dropdown-item",
  tooltipAdjustLeft: 0,
  tooltipAdjustTop: 0,
  ignoreTranslation: false,
  ignoreTranslators: false,
};

// Number of predicates shown after the selected one.
const PAGE_SIZE = 5;

// A command emitted by the afrim preprocessor (`Preprocessor.popQueue`).
type AfrimCommand =
  | "NOP"
  | "Pause"
  | "Resume"
  | { Delete: { length?: number } }
  | { CommitText: string };

// A predicate as returned by the afrim translator (`Translator.translate`).
type RawPredicate = {
  code: string;
  remaining_code: string;
  texts: string[];
  can_commit: boolean;
};

type Predicate = {
  id: number;
  code: string;
  remainingCode: string;
  text: string;
  canCommit: boolean;
};

function getElementOrThrow<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) throw new Error(`element with id ${id} not found`);
  return element as T;
}

/** Attaches the Afrim input method to a text field. */
export default class AfrimInput {
  /** Resolves when Afrim is attached to the text field, rejects if it fails. */
  readonly ready: Promise<void>;

  private readonly options: BaseOptions;

  // Bindings.
  private readonly textFieldElement: HTMLInputElement;
  private readonly downloadStatusElement: HTMLElement;
  private readonly tooltipElement: HTMLElement;
  private readonly tooltipInputElement: HTMLElement;
  private readonly tooltipPredicatesElement: HTMLElement;

  // Afrim engine, available once `ready` resolves.
  private preprocessor?: Preprocessor;
  private translator?: Translator;

  private state = {
    predicates: [] as Predicate[],
    selectedPredicate: 0,
    isIdle: false,
    isBackspacePressed: false,
    cursorPos: 0,
  };

  /**
   * Binds Afrim to the text field and loads its configuration.
   * Wait for {@link AfrimInput.ready} before using the text field.
   */
  constructor(options: AfrimInputOptions) {
    const { config, configUrl, ...bindings } = options;
    this.options = { ...DEFAULT_OPTIONS, ...bindings };

    if (!config && !configUrl) {
      throw new Error("AfrimInput needs either a `configUrl` or a `config`.");
    }

    this.textFieldElement = getElementOrThrow(this.options.textFieldElementID);
    this.downloadStatusElement = getElementOrThrow(
      this.options.downloadStatusElementID,
    );
    this.tooltipElement = getElementOrThrow(this.options.tooltipElementID);
    this.tooltipInputElement = getElementOrThrow(
      this.options.tooltipInputElementID,
    );
    this.tooltipPredicatesElement = getElementOrThrow(
      this.options.tooltipPredicatesElementID,
    );

    // Prevent another afrim instance.
    if (this.textFieldElement.dataset.lock) {
      throw new Error("An afrim instance is already linked to this element.");
    }
    this.textFieldElement.dataset.lock = "true";

    // The text field is busy until the afrim engine is ready.
    this.textFieldElement.disabled = true;
    this.downloadStatusElement.hidden = false;

    const loadedConfig = config
      ? Promise.resolve(config)
      : this.loadConfigFromUrl(configUrl!);

    this.ready = loadedConfig
      .then(async (config) => {
        await this.initAfrim(config);
        this.listenKeyboard();
        this.listenCaret();
        this.listenTextFieldState();
      })
      .catch((err) => {
        // We release the text field for another instance.
        delete this.textFieldElement.dataset.lock;
        throw err;
      })
      .finally(() => {
        this.textFieldElement.disabled = false;
        this.downloadStatusElement.hidden = true;
      });
  }

  /** Detaches Afrim from the text field and frees the engine. */
  kill(): void {
    delete this.textFieldElement.dataset.lock;
    this.textFieldElement.replaceWith(this.textFieldElement.cloneNode(true));

    this.translator?.free();
    this.preprocessor?.free();
  }

  private async loadConfigFromUrl(configUrl: string): Promise<AfrimConfig> {
    const config = new AfrimConfig();
    await config.loadFromUrl(
      configUrl,
      this.downloadStatusElement,
      this.options.ignoreTranslation,
      this.options.ignoreTranslators,
    );
    return config;
  }

  private async initAfrim(config: AfrimConfig): Promise<void> {
    const afrim = await loadAfrim();

    this.preprocessor = new afrim.Preprocessor(config.data, 64);
    this.translator = new afrim.Translator(config.translation, false, 0.7);

    for (const [name, script] of Object.entries(config.translators)) {
      this.translator.register(name, script);
    }
  }

  // --- Predicates ---

  private clearPredicates(): void {
    this.tooltipPredicatesElement.replaceChildren();
    this.state.selectedPredicate = 0;
    this.state.predicates = [];
  }

  // Flattens the translator output: one predicate per text.
  private loadPredicates(rawPredicates: RawPredicate[]): void {
    this.clearPredicates();

    let id = 0;
    for (const predicate of rawPredicates) {
      for (const text of predicate.texts) {
        this.state.predicates.push({
          id: ++id,
          code: predicate.code,
          remainingCode: predicate.remaining_code,
          text,
          canCommit: predicate.can_commit,
        });
      }
    }
  }

  // Moves the selection by `offset`, wrapping around.
  private selectPredicate(offset: number): void {
    const count = this.state.predicates.length;
    if (!count) return;

    this.state.selectedPredicate =
      (((this.state.selectedPredicate + offset) % count) + count) % count;
    this.renderPredicates();
  }

  private commitPredicate(text: string): void {
    this.preprocessor?.commit(text);
    this.clearPredicates();
  }

  // Shows the selected predicate and the next ones, wrapping around,
  // without copying the whole predicate list.
  private renderPredicates(): void {
    const { predicates, selectedPredicate } = this.state;
    const count = Math.min(predicates.length, PAGE_SIZE + 1);
    const elements: HTMLElement[] = [];

    for (let i = 0; i < count; i++) {
      const predicate = predicates[(selectedPredicate + i) % predicates.length];
      const marker = i === 0 ? "✏️" : "";
      const element = document.createElement("a");

      element.classList.add(this.options.tooltipPredicateClass);
      element.innerText = `${marker} ${predicate.id}. ${predicate.text} ~${predicate.remainingCode}`;
      for (const eventName of ["pointerdown", "click"]) {
        element.addEventListener(eventName, () => {
          this.preprocessor?.commit(predicate.text);
          this.processCommands();
          this.preprocessor?.process("", "keydown");
          this.clearPredicates();
        });
      }
      elements.push(element);
    }
    this.tooltipPredicatesElement.replaceChildren(...elements);
  }

  // --- Text field edition ---

  private restoreCursorPosition(): void {
    this.textFieldElement.focus();
    this.textFieldElement.setSelectionRange(
      this.state.cursorPos,
      this.state.cursorPos,
    );
  }

  private deleteBeforeCursor(count: number): void {
    const { value } = this.textFieldElement;
    const cursorPos = this.state.cursorPos;

    this.textFieldElement.value =
      value.substring(0, cursorPos - count) + value.substring(cursorPos);
    this.state.cursorPos -= count;
    this.restoreCursorPosition();
  }

  private insertAtCursor(text: string): void {
    const { value } = this.textFieldElement;
    const cursorPos = this.state.cursorPos;

    this.textFieldElement.value =
      value.substring(0, cursorPos) + text + value.substring(cursorPos);
    this.state.cursorPos += text.length;
    this.restoreCursorPosition();
  }

  // Executes the pending preprocessor commands.
  private processCommands(): void {
    if (!this.preprocessor) return;

    let command: AfrimCommand;
    while ((command = this.preprocessor.popQueue()) !== "NOP") {
      this.state.cursorPos = Math.max(0, this.state.cursorPos);

      if (command === "Pause") {
        this.state.isIdle = true;
      } else if (command === "Resume") {
        this.state.isIdle = false;
      } else if (typeof command === "object" && "Delete" in command) {
        // The browser already deleted one character on backspace.
        const count =
          (command.Delete.length ?? 1) -
          (this.state.isBackspacePressed ? 1 : 0);
        this.state.isBackspacePressed = false;
        this.deleteBeforeCursor(count);
      } else if (typeof command === "object" && "CommitText" in command) {
        this.insertAtCursor(command.CommitText);
      } else if (process.env.NODE_ENV !== "production") {
        console.error(`afrim command "${command}" unsupported.`);
      }
    }
  }

  // --- Event listeners ---

  // Handles the Ctrl shortcuts.
  private handleShortcut(event: KeyboardEvent): void {
    if (!event.ctrlKey) return;

    switch (event.code) {
      case "ShiftLeft":
        this.selectPredicate(-1);
        break;
      case "ShiftRight":
        this.selectPredicate(1);
        break;
      case "Space": {
        const predicate = this.state.predicates[this.state.selectedPredicate];
        if (predicate) this.commitPredicate(predicate.text);
        else this.clearPredicates();
        break;
      }
      case "ControlLeft":
      case "ControlRight":
        this.state.isIdle = !this.state.isIdle;
        break;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.state.cursorPos = this.textFieldElement.selectionEnd ?? 0;
    this.handleShortcut(event);

    if (event.key === "GroupPrevious" || event.key === "GroupNext") return;
    if (this.state.isIdle || !this.preprocessor) return;

    if (event.key === "Backspace") {
      this.state.isBackspacePressed = true;
    }

    const changed = this.preprocessor.process(event.key, "keydown");
    const input = this.preprocessor.getInput();

    this.processCommands();

    // We update the predicates if the input changed.
    if (!changed) return;

    this.tooltipInputElement.innerText = "📝 " + input;
    const predicates: RawPredicate[] = this.translator?.translate(input) ?? [];
    this.loadPredicates(predicates);
    this.renderPredicates();
  }

  private listenKeyboard(): void {
    this.textFieldElement.addEventListener("keyup", (event) =>
      this.handleKeyUp(event),
    );
  }

  // Makes the tooltip follow the caret.
  private listenCaret(): void {
    this.textFieldElement.addEventListener("keyup", () => {
      // No need to compute the caret position (it forces a layout)
      // while the tooltip is hidden.
      if (!this.tooltipElement.classList.contains("is-active")) return;

      const field = this.textFieldElement;
      const caret = getCaretCoordinates(field, field.selectionEnd ?? 0);
      const { style } = this.tooltipElement;

      style.top = `${this.options.tooltipAdjustTop + field.offsetTop - field.scrollTop + caret.top}px`;
      style.left = `${this.options.tooltipAdjustLeft + field.offsetLeft - field.scrollLeft + caret.left}px`;
    });
  }

  // Shows the tooltip while the text field is in use.
  private listenTextFieldState(): void {
    for (const eventName of ["click", "touchstart"]) {
      this.textFieldElement.addEventListener(eventName, () => {
        this.tooltipElement.classList.add("is-active");
        this.preprocessor?.process("", "keydown");
        this.clearPredicates();
      });
    }

    this.textFieldElement.addEventListener("blur", () => {
      this.tooltipElement.classList.remove("is-active");
    });
  }
}
