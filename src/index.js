"use strict";

import { Preprocessor, Translator } from "afrim-js";
import { loadConfig } from "./config";

// Afrim
global.afrim = Object({
  predicates: Array(),
  predicateId: 0,
  pageSize: 5,
  isIdle: false,
  cursorPos: 0,
  data: Object(),
  dictionary: Object(),
  translators: Object(),
});

(async function () {
  // Binding
  const textFieldElement = document.getElementById("textfield");
  const downloadStatusElement = document.getElementById("download-status");
  const tooltipElement = document.getElementById("tooltip");
  const tooltipInputElement = document.getElementById("tooltip-input");
  const tooltipPredicatesElement =
    document.getElementById("tooltip-predicates");

  // Clear the predicates.
  const clearPredicate = () => {
    tooltipPredicatesElement.innerHTML = "";
    global.afrim.predicateId = 0;
    global.afrim.predicates = Array();
  };

  // Load predicates in the memory
  const loadPredicates = (predicates) => {
    clearPredicate();
    var predicateId = 0;

    for (const predicate of predicates) {
      for (const e of predicate[2]) {
        global.afrim.predicates.push([
          ++predicateId,
          predicate[0],
          predicate[1],
          e,
          predicate[3],
        ]);
      }
    }
  };

  // Update the predicates.
  const updatePredicate = () => {
    tooltipPredicatesElement.innerHTML = "";

    let counter = 0;
    // We get the current the page
    const predicates = global.afrim.predicates
      .slice(global.afrim.predicateId, global.afrim.predicates.length)
      .concat(global.afrim.predicates.slice(0, global.afrim.predicateId));

    for (const predicate of predicates) {
      // Mark the selected predicate.
      const c = counter == 0 ? "✏️" : "";

      if (counter++ > global.afrim.pageSize) break;

      // Config the tooltip predicate element.
      const el = document.createElement("a");
      el.classList.add("dropdown-item");
      el.innerText = `${c} ${predicate[0]}. ${predicate[3]} ~${predicate[2]}`;
      ["pointerdown", "click"].forEach((e) => {
        el.addEventListener(
          e,
          () => {
            preprocessor.commit(predicate[3]);
            preprocessor.process("", "keydown");
            clearPredicate();
          },
          false,
        );
      });
      tooltipPredicatesElement.append(el);
    }
  };

  // Restore cursor position.
  const restoreCursorPosition = () => {
    textFieldElement.focus();
    textFieldElement.setSelectionRange(
      global.afrim.cursorPos,
      global.afrim.cursorPos,
    );
  };

  // We execute preprocessor commands in idle.
  const processCommand = () => {
    const cmd = JSON.parse(preprocessor.popQueue());
    const textValue = textFieldElement.value;

    global.afrim.cursorPos =
      global.afrim.cursorPos < 0 ? 0 : global.afrim.cursorPos;

    if (cmd) {
      if (cmd == "Delete") {
        textFieldElement.value =
          textValue.substring(0, global.afrim.cursorPos - 1) +
          textValue.substring(global.afrim.cursorPos, textValue.length);
        global.afrim.cursorPos--;
        restoreCursorPosition();
      } else if (cmd == "Pause") {
        global.afrim.isIdle = true;
      } else if (cmd == "Resume") {
        global.afrim.isIdle = false;
      } else if (cmd == "NOP") {
      } else if (cmd.CommitText) {
        textFieldElement.value =
          textValue.substring(0, global.afrim.cursorPos) +
          cmd.CommitText +
          textValue.substring(global.afrim.cursorPos, textValue.length);
        global.afrim.cursorPos += cmd.CommitText.length;
        restoreCursorPosition();
      } else {
        console.error(`afrim command "${cmd}" unsupported.`);
      }
    }

    requestAnimationFrame(processCommand);
  };

  // We wait that the afrim ime engine is ready.
  textFieldElement.disabled = true;
  downloadStatusElement.hidden = false;

  // We download the datalang.
  const lang = sessionStorage.getItem("lang") || "gez";
  document.getElementById(lang).classList.toggle("is-active");
  await loadConfig(
    `https://raw.githubusercontent.com/pythonbrad/afrim-data/fa8a5560e63a23ff7032e7c56fe5dbde2963b9fa/${lang}/${lang}.toml`,
  );

  // We mark the text field busy.
  textFieldElement.disabled = false;
  downloadStatusElement.hidden = true;

  // We config the afrim ime.
  const preprocessor = new Preprocessor(global.afrim.data, 64);
  const translator = new Translator(global.afrim.dictionary, false);
  global.afrim.toto = preprocessor;
  Object.entries(global.afrim.translators).forEach((e) =>
    translator.register(e[0], e[1]),
  );

  // We listen keyboard events.
  textFieldElement.addEventListener(
    "keyup",
    (event) => {
      global.afrim.cursorPos = textFieldElement.selectionEnd;

      // We manage special keys.
      if (event.ctrlKey) {
        // Previous predicate.
        if (event.code == "ShiftLeft") {
          global.afrim.predicateId =
            global.afrim.predicateId < 1
              ? global.afrim.predicates.length - 1
              : global.afrim.predicateId - 1;
          updatePredicate();
        }
        // Next predicate.
        else if (event.code == "ShiftRight") {
          global.afrim.predicateId =
            global.afrim.predicateId >= global.afrim.predicates.length - 1
              ? 0
              : global.afrim.predicateId + 1;
          updatePredicate();
        }
        // Commit the predicate.
        else if (event.code == "Space") {
          var predicate = global.afrim.predicates[global.afrim.predicateId];

          if (predicate) preprocessor.commit(predicate[3]);
          clearPredicate();
        } else if (
          event.code == "ControlLeft" ||
          event.code == "ControlRight"
        ) {
          global.afrim.isIdle = !global.afrim.idle;
        }

        return;
      }

      if (event.key == "GroupPrevious" || event.key == "GroupNext") return;
      if (global.afrim.isIdle) return;

      const changed = preprocessor.process(event.key, "keydown");
      const input = preprocessor.getInput();

      // We update the predicates
      if (!changed) return;

      tooltipInputElement.innerText = "📝 " + input;

      const predicates = translator.translate(input);
      loadPredicates(predicates);
      updatePredicate();
    },
    false,
  );

  // Make the tooltip follow the mouse.
  textFieldElement.addEventListener(
    "keyup",
    (event) => {
      const getCaretCoordinates = require("textarea-caret");
      const caret = getCaretCoordinates(
        textFieldElement,
        textFieldElement.selectionEnd,
      );

      tooltip.style.top =
        125 +
        textFieldElement.offsetTop -
        textFieldElement.scrollTop +
        caret.top +
        "px";
      tooltip.style.left =
        50 +
        textFieldElement.offsetLeft -
        textFieldElement.scrollLeft +
        caret.left +
        "px";
    },
    false,
  );

  // Make the tooltip active inside of the textfield.
  ["click", "touchstart"].forEach((e) => {
    textFieldElement.addEventListener(
      e,
      () => {
        tooltipElement.classList.add("is-active");
        preprocessor.process("", "keydown");
        clearPredicate();
      },
      false,
    );
  });

  // Hide the tooltip if not typing
  textFieldElement.addEventListener("blur", (e) => {
    tooltipElement.classList.remove("is-active");
  });

  // We start the processor.
  requestAnimationFrame(processCommand);
})();
