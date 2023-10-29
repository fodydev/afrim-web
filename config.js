import { httpGet, tomlToJson } from "./utils";

// Load the afrim configuration through an URL.
export async function loadConfig(path) {
  var content = await httpGet(path).then((data) => tomlToJson(data));
  var auto_capitalize = false;

  if (content.core) {
    auto_capitalize = content.core.auto_capitalize || false;
  }

  if (typeof content.translation == "object") {
    var items = await Object.entries(content.translation);

    for (let item of items) {
      var key = item[0];
      var value = item[1];

      // We extract the translation.
      if (typeof value == "object") {
        if (value.path) {
          await loadConfig(new URL(value.path, path).href);
        } else if (value.alias) {
          var _ = null;

          if (value.values) {
            _ = value.values;
          } else {
            _ = [value.value];
          }

          for (let e of value.alias) {
            global.memory.dictionary[e] = _;
          }
          global.memory.dictionary[key] = _;
        }
      } else {
        global.memory.dictionary[key] = [value];
      }
    }
  }

  // We extract the data.
  if (typeof content.data == "object") {
    var items = await Object.entries(content.data);

    for (let item of items) {
      var key = item[0];
      var value = item[1];

      if (typeof value == "object") {
        if (value.path) {
          await loadConfig(new URL(value.path, path).href);
        } else if (value.alias) {
          for (let e of value.alias) {
            global.memory.data[e] = value.value;

            if (auto_capitalize) {
              global.memory.data[e[0].toUpperCase() + e.slice(1)] =
                value.value.toUpperCase();
            }
          }
          global.memory.data[key] = value.value;

          if (auto_capitalize) {
            global.memory.data[key[0].toUpperCase() + key.slice(1)] =
              value.value.toUpperCase();
          }
        }
      } else {
        global.memory.data[key] = value;
      }
    }
  }

  // We extract the translators.
  if (typeof content.translator == "object") {
    var items = await Object.entries(content.translator);

    for (let item of items) {
      var key = item[0];
      var value = item[1];
      var content = await httpGet(new URL(value, path).href).then(
        (data) => data,
      );

      global.memory.translators[key] = content;
    }
  }
}
