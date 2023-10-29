import { Preprocessor, Translator } from "afrim-js";
import { loadConfig } from "./config";

global.memory = Object({
  predicates: Array(),
  predicateId: 0,
  pageSize: 5,
  data: Object(),
  dictionary: Object(),
  translators: Object(),
});

(async function () {
  //
  var textFieldElement = document.getElementById("textfield");
  var downloadStatusElement = document.getElementById("download-status");
  var tooltipElement = document.getElementById("tooltip");
  var tooltipInputElement = document.getElementById("tooltip-input");
  var tooltipPredicatesElement = document.getElementById("tooltip-predicates");

  //
  var idle = false;

  // Clear the predicates.
  var clearPredicate = () => {
    tooltipPredicatesElement.innerHTML = "";
    global.memory.predicateId = 0;
    global.memory.predicates = Array();
  };

  // Load predicates in the memory
  var loadPredicates = (predicates) => {
    clearPredicate();
    var predicateId = 0;

    for (let predicate of predicates) {
      for (let e of predicate[2]) {
        global.memory.predicates.push([
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
  var updatePredicate = () => {
    tooltipPredicatesElement.innerHTML = "";

    var counter = 0;
    var predicates = global.memory.predicates
      .slice(global.memory.predicateId, global.memory.predicates.length)
      .concat(global.memory.predicates.slice(0, global.memory.predicateId));

    for (let predicate of predicates) {
      // Mark the selected predicate.
      var c = counter == 0 ? "✏️" : "";

      if (counter++ > global.memory.pageSize) break;

      // Config the tooltip predicate element.
      var e = document.createElement("a");
      e.classList.add("dropdown-item");
      e.innerText = `${c} ${predicate[0]}. ${predicate[3]} ~${predicate[2]}`;
      e.addEventListener(
        "click",
        () => preprocessor.commit(predicate[3]),
        false,
      );
      tooltipPredicatesElement.append(e);
    }
  };

  // We execute preprocessor commands in idle.
  var processCommand = () => {
    var cmd = preprocessor.pop_stack();

    if (cmd) {
      if (cmd.startsWith("!")) {
        if (cmd == "!backspace") {
          textFieldElement.value = textfield.value.slice(0, -1);
        } else if (cmd == "!pause") {
          idle = true;
        } else if (cmd == "!resume") {
          idle = false;
        }
      } else if (cmd == ".") {
      } else {
        textFieldElement.value += cmd;
      }
    }

    requestAnimationFrame(processCommand);
  };

  // We wait that the afrim ime engine is ready.
  textFieldElement.disabled = true;
  downloadStatusElement.hidden = false;

  // We download the datalang.
  var lang = sessionStorage.getItem("lang") || "geez";
  document.getElementById(lang).classList.toggle("is-active");
  await loadConfig(
    `https://raw.githubusercontent.com/pythonbrad/afrim-data/minimal/${lang}/${lang}.toml`,
  );

  //
  textFieldElement.disabled = false;
  downloadStatusElement.hidden = true;

  // We config the afrim ime.
  var preprocessor = Preprocessor.new(global.memory.data, 64);
  var translator = Translator.new(global.memory.dictionary, false);
  Object.entries(global.memory.translators).forEach((e) =>
    translator.register(e[0], e[1]),
  );

  // We listen keyboard events.
  textFieldElement.addEventListener(
    "keyup",
    (event) => {
      // We manage special keys.
      if (event.ctrlKey) {
        // Previous predicate.
        if (event.code == "ShiftLeft") {
          global.memory.predicateId =
            global.memory.predicateId < 1
              ? global.memory.predicates.length - 1
              : global.memory.predicateId - 1;
          updatePredicate();
        }
        // Next predicate.
        else if (event.code == "ShiftRight") {
          global.memory.predicateId =
            global.memory.predicateId >= global.memory.predicates.length - 1
              ? 0
              : global.memory.predicateId + 1;
          updatePredicate();
        }
        // Commit the predicate.
        else if (event.code == "Space") {
          var predicate = global.memory.predicates[global.memory.predicateId];

          if (predicate) preprocessor.commit(predicate[3]);
          clearPredicate();
        } else if (
          event.code == "ControlLeft" ||
          event.code == "ControlRight"
        ) {
          idle = !idle;
        }

        return;
      }

      if (event.key == "GroupPrevious" || event.key == "GroupNext") return;
      if (idle) return;

      var changed = preprocessor.process(event.key, "keydown");
      var input = preprocessor.get_input();

      // We update the predicates
      if (!changed) return;

      tooltipInputElement.innerText = "📝 " + input;

      var predicates = translator.translate(input);
      loadPredicates(predicates);
      updatePredicate();
    },
    false,
  );

  // Make the tooltip follow the mouse.
  textFieldElement.addEventListener(
    "mousemove",
    (event) => {
      tooltip.style.left = event.pageX + 10 + "px";
      tooltip.style.top = event.pageY + 10 + "px";
    },
    false,
  );

  // Make the tooltip inactive outside of the textfield.
  textFieldElement.addEventListener(
    "mouseleave",
    (event) => tooltipElement.classList.remove("is-active"),
    false,
  );

  // Make the tooltip active inside of the textfield.
  textFieldElement.addEventListener(
    "mouseover",
    (event) => tooltipElement.classList.add("is-active"),
    false,
  );

  // Make the tooltip active inside of the textfield.
  textFieldElement.addEventListener(
    "click",
    (event) => tooltipElement.classList.add("is-active"),
    false,
  );

  // We start the processor.
  requestAnimationFrame(processCommand);
})();
