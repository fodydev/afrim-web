"use strict";

import { Preprocessor, Translator } from "afrim-js";
import { AfrimConfig } from "./config";

// TODO: implement cancelAnimationFrame
export default class Afrim {
  // For bindings.
  #textFieldElement;
  #downloadStatusElement;
  #tooltipElement;
  #tooltipInputElement;
  #tooltipPredicatesElement;

  // Afrim lib.
  #preprocessor;
  #translator;

  // Data
  #data = Object({
    predicates: Array(),
    predicateId: 0,
    pageSize: 5,
    isIdle: false,
    cursorPos: 0,
    options: Object(),
  });

  #animation;

  constructor(options) {
    let defaultOptions = {
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
    this.#textFieldElement = document.getElementById(
      options.textFieldElementID,
    );
    this.#downloadStatusElement = document.getElementById(
      options.downloadStatusElementID,
    );
    this.#tooltipElement = document.getElementById(options.tooltipElementID);
    this.#tooltipInputElement = document.getElementById(
      options.tooltipInputElementID,
    );
    this.#tooltipPredicatesElement = document.getElementById(
      options.tooltipPredicatesElementID,
    );

    // Save options
    this.#data.options = options;

    // Prevent another afrim instance.
    if (this.#textFieldElement.dataset.lock) {
      throw new Error("An afrim instance is already linked to this element.");
    }

    this.#textFieldElement.dataset.lock = true;

    // We wait that the afrim ime engine is ready.
    // We mark the text field busy.
    this.#textFieldElement.disabled = true;
    this.#downloadStatusElement.hidden = false;

    this.#loadConfigFromUrl(options.configUrl).then(
      (config) => {
        this.#initAfrim(config);
        this.#listenKeyboard();
        this.#listenMouse();
        this.#listenTextFieldState();

        // We start the processor.
        this.#processCommand();

        // We mark the text field available.
        this.#textFieldElement.disabled = false;
        this.#downloadStatusElement.hidden = true;
      },
      (err) => {
        alert(`Error downloading configuration file: ${err}`);
      },
    );
  }

  // Clear the predicates.
  #clearPredicate() {
    this.#tooltipPredicatesElement.innerHTML = "";

    this.#data.predicateId = 0;
    this.#data.predicates = Array();
  }

  // Load predicates in the memory
  #loadPredicates(predicates) {
    this.#clearPredicate();
    var predicateId = 0;

    for (const predicate of predicates) {
      for (const text of predicate.texts) {
        this.#data.predicates.push([
          ++predicateId,
          predicate.code,
          predicate.remaining_code,
          text,
          predicate.can_commit,
        ]);
      }
    }
  }

  // Update the predicates.
  #updatePredicate() {
    this.#tooltipPredicatesElement.innerHTML = "";

    let counter = 0;
    // We get the current the page
    const predicates = this.#data.predicates
      .slice(this.#data.predicateId, this.#data.predicates.length)
      .concat(this.#data.predicates.slice(0, this.#data.predicateId));

    for (const predicate of predicates) {
      // Mark the selected predicate.
      const c = counter == 0 ? "✏️" : "";

      if (counter++ > this.#data.pageSize) break;

      // Config the tooltip predicate element.
      const el = document.createElement("a");
      el.classList.add(this.#data.options.tooltipPredicateClass);
      el.innerText = `${c} ${predicate[0]}. ${predicate[3]} ~${predicate[2]}`;
      for (let e of ["pointerdown", "click"]) {
        el.addEventListener(
          e,
          () => {
            this.#preprocessor.commit(predicate[3]);
            this.#preprocessor.process("", "keydown");
            this.#clearPredicate();
          },
          false,
        );
      }
      this.#tooltipPredicatesElement.append(el);
    }
  }

  // Restore cursor position.
  #restoreCursorPosition() {
    this.#textFieldElement.focus();
    this.#textFieldElement.setSelectionRange(
      this.#data.cursorPos,
      this.#data.cursorPos,
    );
  }

  // We execute preprocessor commands in idle.
  #processCommand() {
    const cmd = this.#preprocessor.popQueue();
    const textValue = this.#textFieldElement.value;

    this.#data.cursorPos = this.#data.cursorPos < 0 ? 0 : this.#data.cursorPos;

    if (cmd) {
      if (cmd == "Delete") {
        this.#textFieldElement.value =
          textValue.substring(0, this.#data.cursorPos - 1) +
          textValue.substring(this.#data.cursorPos, textValue.length);
        this.#data.cursorPos--;
        this.#restoreCursorPosition();
      } else if (cmd == "Pause") {
        this.#data.isIdle = true;
      } else if (cmd == "Resume") {
        this.#data.isIdle = false;
      } else if (cmd == "NOP") {
      } else if (cmd.CommitText) {
        this.#textFieldElement.value =
          textValue.substring(0, this.#data.cursorPos) +
          cmd.CommitText +
          textValue.substring(this.#data.cursorPos, textValue.length);
        this.#data.cursorPos += cmd.CommitText.length;
        this.#restoreCursorPosition();
      } else {
        console.error(`afrim command "${cmd}" unsupported.`);
      }
    }

    this.#animation = requestAnimationFrame(() => this.#processCommand());
  }

  async #loadConfigFromUrl(configUrl) {
    // We download the datalang.
    let afrimConfig = new AfrimConfig();
    await afrimConfig.loadFromUrl(configUrl);

    return afrimConfig.config;
  }

  // We config the afrim ime.
  #initAfrim(config) {
    this.#preprocessor = new Preprocessor(config.data, 64);
    this.#translator = new Translator(config.dictionary, false);

    for (let e of Object.entries(config.translators)) {
      this.#translator.register(e[0], e[1]);
    }
  }

  #listenKeyboard() {
    // We listen keyboard events.
    this.#textFieldElement.addEventListener(
      "keyup",
      (event) => {
        this.#data.cursorPos = this.#textFieldElement.selectionEnd;

        // We manage special keys.
        if (event.ctrlKey) {
          // Previous predicate.
          if (event.code == "ShiftLeft") {
            this.#data.predicateId =
              this.#data.predicateId < 1
                ? this.#data.predicates.length - 1
                : this.#data.predicateId - 1;
            this.#updatePredicate();
          }
          // Next predicate.
          else if (event.code == "ShiftRight") {
            this.#data.predicateId =
              this.#data.predicateId >= this.#data.predicates.length - 1
                ? 0
                : this.#data.predicateId + 1;
            this.#updatePredicate();
          }
          // Commit the predicate.
          else if (event.code == "Space") {
            var predicate = this.#data.predicates[this.#data.predicateId];

            if (predicate) this.#preprocessor.commit(predicate[3]);
            this.#clearPredicate();
          } else if (
            event.code == "ControlLeft" ||
            event.code == "ControlRight"
          ) {
            this.#data.isIdle = !this.#data.idle;
          }

          return;
        }

        if (event.key == "GroupPrevious" || event.key == "GroupNext") return;
        if (this.#data.isIdle) return;

        const changed = this.#preprocessor.process(event.key, "keydown");
        const input = this.#preprocessor.getInput();

        // We update the predicates
        if (!changed) return;

        this.#tooltipInputElement.innerText = "📝 " + input;

        const predicates = this.#translator.translate(input);
        this.#loadPredicates(predicates);
        this.#updatePredicate();
      },
      false,
    );
  }

  #listenMouse() {
    // Make the tooltip follow the mouse.
    this.#textFieldElement.addEventListener(
      "keyup",
      (event) => {
        const getCaretCoordinates = require("textarea-caret");
        const caret = getCaretCoordinates(
          this.#textFieldElement,
          this.#textFieldElement.selectionEnd,
        );

        this.#tooltipElement.style.top =
          this.#data.options.tooltipAdjustTop +
          this.#textFieldElement.offsetTop -
          this.#textFieldElement.scrollTop +
          caret.top +
          "px";
        this.#tooltipElement.style.left =
          this.#data.options.tooltipAdjustLeft +
          this.#textFieldElement.offsetLeft -
          this.#textFieldElement.scrollLeft +
          caret.left +
          "px";
      },
      false,
    );
  }

  #listenTextFieldState() {
    // Make the tooltip active inside of the textfield.
    for (let e of ["click", "touchstart"]) {
      this.#textFieldElement.addEventListener(
        e,
        () => {
          this.#tooltipElement.classList.add("is-active");
          this.#preprocessor.process("", "keydown");
          this.#clearPredicate();
        },
        false,
      );
    }

    // Hide the tooltip if not typing
    this.#textFieldElement.addEventListener("blur", (e) => {
      this.#tooltipElement.classList.remove("is-active");
    });
  }

  kill() {
    cancelAnimationFrame(this.#animation);

    this.#textFieldElement.replaceWith(this.#textFieldElement.cloneNode(true));
    this.#translator.free();
    this.#preprocessor.free();

    delete this.#textFieldElement.dataset.lock;
  }
}
