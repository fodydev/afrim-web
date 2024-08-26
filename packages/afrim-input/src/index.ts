"use strict";

import type { Preprocessor, Translator } from "afrim-js";
import { AfrimConfig } from "./config";

type Option = {
  textFieldElementID: string;
  downloadStatusElementID: string;
  tooltipElementID: string;
  tooltipInputElementID: string;
  tooltipPredicatesElementID: string;
  tooltipPredicateClass: string;
  tooltipAdjustLeft: number;
  tooltipAdjustTop: number;
  configUrl: string;
};

type Predicate = {
  id: number;
  code: string;
  remainingCode: string;
  texts: string[];
  canCommit: boolean;
};

// Afrim Input library.
export default class AfrimInput {
  // For bindings.
  private textFieldElement: HTMLInputElement;
  private downloadStatusElement: HTMLElement;
  private tooltipElement: HTMLElement;
  private tooltipInputElement: HTMLElement;
  private tooltipPredicatesElement: HTMLElement;

  // Afrim library.
  private preprocessor?: Preprocessor;
  private translator?: Translator;

  // Data
  private data: {
    predicates: Predicate[];
    predicateId: number;
    pageSize: number;
    isIdle: boolean;
    cursorPos: number;
    options: Option;
  };

  private animation: number = 0;

  // Initialize the Afrim Input instance.
  constructor(options: Option) {
    let defaultOptions: Option = {
      textFieldElementID: "textfield",
      downloadStatusElementID: "download-status",
      tooltipElementID: "tooltip",
      tooltipInputElementID: "tooltip-input",
      tooltipPredicatesElementID: "tooltip-predicates",
      tooltipPredicateClass: "dropdown-item",
      tooltipAdjustLeft: 0,
      tooltipAdjustTop: 0,
      configUrl:
        "https://raw.githubusercontent.com/pythonbrad/afrim-data/4b177197bb37c9742cd90627b1ad543c32ec791b/gez/gez.toml",
    };

    // merge the options passed in with our default options
    // properties that exist in the incoming options object will overwrite that in the defaultOptions
    options = { ...defaultOptions, ...options };

    // Binding
    var _ = document.getElementById(options.textFieldElementID);
    if (_) {
      this.textFieldElement = _ as HTMLInputElement;
    } else {
      throw new Error(
        `element with id ${options.textFieldElementID} not found`,
      );
    }

    var _ = document.getElementById(options.downloadStatusElementID);
    if (_) {
      this.downloadStatusElement = _ as HTMLElement;
    } else {
      throw new Error(`element with id ${options.downloadStatusElementID}`);
    }

    var _ = document.getElementById(options.tooltipElementID);
    if (_) {
      this.tooltipElement = _ as HTMLElement;
    } else {
      throw new Error(`element with id ${options.tooltipElementID}`);
    }

    var _ = document.getElementById(options.tooltipInputElementID);
    if (_) {
      this.tooltipInputElement = _ as HTMLElement;
    } else {
      throw new Error(`element with id ${options.tooltipInputElementID}`);
    }

    var _ = document.getElementById(options.tooltipPredicatesElementID);
    if (_) {
      this.tooltipPredicatesElement = _ as HTMLElement;
    } else {
      throw new Error(`element with id ${options.tooltipPredicatesElementID}`);
    }

    // Save options
    this.data = {
      predicates: Array(),
      predicateId: 0,
      pageSize: 5,
      isIdle: false,
      cursorPos: 0,
      options: options,
    };

    // Prevent another afrim instance.
    if (this.textFieldElement.dataset.lock) {
      throw new Error("An afrim instance is already linked to this element.");
    }

    this.textFieldElement.dataset.lock = "true";

    // We wait that the afrim ime engine is ready.
    // We mark the text field busy.
    this.textFieldElement.disabled = true;
    this.downloadStatusElement.hidden = false;

    this.loadConfigFromUrl(options.configUrl).then(
      async (config: AfrimConfig) => {
        await this.initAfrim(config);
        this.listenKeyboard();
        this.listenMouse();
        this.listenTextFieldState();

        // We start the processor.
        this.processCommand();

        // We mark the text field available.
        this.textFieldElement.disabled = false;
        this.downloadStatusElement.hidden = true;
      },
      (err) => {
        alert(`Error downloading configuration file: ${err}`);
      },
    );
  }

  // Clear the predicates.
  private clearPredicate() {
    this.tooltipPredicatesElement.innerHTML = "";

    this.data.predicateId = 0;
    this.data.predicates = Array();
  }

  // Load predicates in the memory
  private loadPredicates(predicates: Predicate[]) {
    this.clearPredicate();
    var predicateId = 0;

    for (const predicate of predicates) {
      for (const text of predicate.texts) {
        this.data.predicates.push({
          id: ++predicateId,
          code: predicate.code,
          remainingCode: predicate.remainingCode,
          texts: [text],
          canCommit: predicate.canCommit,
        });
      }
    }
  }

  // Update the predicates.
  private updatePredicate() {
    this.tooltipPredicatesElement.innerHTML = "";

    // We get the current the page
    const predicates = this.data.predicates
      .slice(this.data.predicateId, this.data.predicates.length)
      .concat(this.data.predicates.slice(0, this.data.predicateId));

    let forloopCounter = 0;
    for (const predicate of predicates) {
      // Mark the selected predicate.
      const icon = forloopCounter == 0 ? "✏️" : "";

      if (forloopCounter++ > this.data.pageSize) break;

      // Config the tooltip predicate element.
      const predicateElement = document.createElement("a");
      predicateElement.classList.add(this.data.options.tooltipPredicateClass);
      predicateElement.innerText = `${icon} ${predicate.id}. ${predicate.texts[0]} ~${predicate.remainingCode}`;
      for (let event of ["pointerdown", "click"]) {
        predicateElement.addEventListener(
          event,
          () => {
            this.preprocessor?.commit(predicate.texts[0]);
            this.preprocessor?.process("", "keydown");
            this.clearPredicate();
          },
          false,
        );
      }
      this.tooltipPredicatesElement.append(predicateElement);
    }
  }

  // Restore cursor position.
  private restoreCursorPosition() {
    this.textFieldElement.focus();
    this.textFieldElement.setSelectionRange(
      this.data.cursorPos,
      this.data.cursorPos,
    );
  }

  // We execute preprocessor commands in IDLE.
  private processCommand() {
    const cmd = this.preprocessor?.popQueue();
    const textValue = this.textFieldElement.value;

    this.data.cursorPos = this.data.cursorPos < 0 ? 0 : this.data.cursorPos;

    if (cmd) {
      if (cmd == "Delete") {
        this.textFieldElement.value =
          textValue.substring(0, this.data.cursorPos - 1) +
          textValue.substring(this.data.cursorPos, textValue.length);
        this.data.cursorPos--;
        this.restoreCursorPosition();
      } else if (cmd == "Pause") {
        this.data.isIdle = true;
      } else if (cmd == "Resume") {
        this.data.isIdle = false;
      } else if (cmd == "NOP") {
      } else if (cmd.CommitText) {
        this.textFieldElement.value =
          textValue.substring(0, this.data.cursorPos) +
          cmd.CommitText +
          textValue.substring(this.data.cursorPos, textValue.length);
        this.data.cursorPos += cmd.CommitText.length;
        this.restoreCursorPosition();
      } else {
        if (process.env.NODE_ENV !== "production") {
          console.error(`afrim command "${cmd}" unsupported.`);
        }
      }
    }

    this.animation = requestAnimationFrame(() => this.processCommand());
  }

  private async loadConfigFromUrl(configUrl: string) {
    // We download the datalang.
    let afrimConfig = new AfrimConfig();
    await afrimConfig.loadFromUrl(configUrl);

    return afrimConfig;
  }

  // We config the afrim ime.
  private async initAfrim(config: AfrimConfig) {
    const afrim = await require("afrim-js");

    this.preprocessor = new afrim.Preprocessor(config.data, 64);
    this.translator = new afrim.Translator(config.translation, false);

    for (let e of Object.entries(config.translators)) {
      this.translator?.register(e[0], e[1]);
    }
  }

  private listenKeyboard() {
    // We listen keyboard events.
    this.textFieldElement.addEventListener(
      "keyup",
      (event) => {
        this.data.cursorPos = this.textFieldElement.selectionEnd ?? 0;

        // We manage special keys.
        if (event.ctrlKey) {
          // Previous predicate.
          if (event.code == "ShiftLeft") {
            this.data.predicateId =
              this.data.predicateId < 1
                ? this.data.predicates.length - 1
                : this.data.predicateId - 1;
            this.updatePredicate();
          }
          // Next predicate.
          else if (event.code == "ShiftRight") {
            this.data.predicateId =
              this.data.predicateId >= this.data.predicates.length - 1
                ? 0
                : this.data.predicateId + 1;
            this.updatePredicate();
          }
          // Commit the predicate.
          else if (event.code == "Space") {
            var predicate = this.data.predicates[this.data.predicateId];

            if (predicate) this.preprocessor?.commit(predicate.texts[0]);
            this.clearPredicate();
          } else if (
            event.code == "ControlLeft" ||
            event.code == "ControlRight"
          ) {
            this.data.isIdle = !this.data.isIdle;
          }

          return;
        }

        if (event.key == "GroupPrevious" || event.key == "GroupNext") return;
        if (this.data.isIdle) return;

        const changed = this.preprocessor?.process(event.key, "keydown");
        const input = this.preprocessor?.getInput() || "";

        // We update the predicates if input changed.
        if (!changed) return;

        this.tooltipInputElement.innerText = "📝 " + input;

        const predicates = this.translator?.translate(input);
        this.loadPredicates(predicates);
        this.updatePredicate();
      },
      false,
    );
  }

  private listenMouse() {
    // Make the tooltip follow the mouse.
    this.textFieldElement.addEventListener(
      "keyup",
      (event) => {
        const getCaretCoordinates = require("textarea-caret");
        const caret = getCaretCoordinates(
          this.textFieldElement,
          this.textFieldElement.selectionEnd,
        );

        this.tooltipElement.style.top =
          this.data.options.tooltipAdjustTop +
          this.textFieldElement.offsetTop -
          this.textFieldElement.scrollTop +
          caret.top +
          "px";
        this.tooltipElement.style.left =
          this.data.options.tooltipAdjustLeft +
          this.textFieldElement.offsetLeft -
          this.textFieldElement.scrollLeft +
          caret.left +
          "px";
      },
      false,
    );
  }

  private listenTextFieldState() {
    // Make the tooltip active inside of the textfield.
    for (let event of ["click", "touchstart"]) {
      this.textFieldElement.addEventListener(
        event,
        () => {
          this.tooltipElement.classList.add("is-active");
          this.preprocessor?.process("", "keydown");
          this.clearPredicate();
        },
        false,
      );
    }

    // Hide the tooltip if not typing
    this.textFieldElement.addEventListener("blur", (e) => {
      this.tooltipElement.classList.remove("is-active");
    });
  }

  // Interrupt the Afrim has detach it from the linked textfield.
  kill() {
    cancelAnimationFrame(this.animation);

    this.textFieldElement.replaceWith(this.textFieldElement.cloneNode(true));
    this.translator?.free();
    this.preprocessor?.free();

    delete this.textFieldElement.dataset.lock;
  }
}
