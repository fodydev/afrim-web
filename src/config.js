"use strict";

import { httpGet, tomlToJson } from "./utils";

// Load the afrim configuration through an URL.
export async function loadConfig(path) {
  const content = await httpGet(path).then((data) => tomlToJson(data));
  let auto_capitalize = false;

  if (content.core) {
    auto_capitalize = content.core.auto_capitalize || false;
  }

  if (typeof content.translation == "object") {
    const items = await Object.entries(content.translation);

    for (const item of items) {
      const key = item[0];
      const value = item[1];

      // We extract the translation.
      if (typeof value == "object") {
        if (value.path) {
          await loadConfig(new URL(value.path, path).href);
        } else if (value.alias) {
          let _ = null;

          if (value.values) {
            _ = value.values;
          } else {
            _ = [value.value];
          }

          for (const e of value.alias) {
            global.afrim.dictionary[e] = _;
          }
          global.afrim.dictionary[key] = _;
        }
      } else {
        global.afrim.dictionary[key] = [value];
      }
    }
  }

  // We extract the data.
  if (typeof content.data == "object") {
    const items = await Object.entries(content.data);

    for (const item of items) {
      const key = item[0];
      const value = item[1];

      if (typeof value == "object") {
        if (value.path) {
          await loadConfig(new URL(value.path, path).href);
        } else if (value.alias) {
          for (const e of value.alias) {
            global.afrim.data[e] = value.value;

            if (auto_capitalize) {
              global.afrim.data[e[0].toUpperCase() + e.slice(1)] =
                value.value.toUpperCase();
            }
          }
          global.afrim.data[key] = value.value;

          if (auto_capitalize) {
            global.afrim.data[key[0].toUpperCase() + key.slice(1)] =
              value.value.toUpperCase();
          }
        }
      } else {
        global.afrim.data[key] = value;
      }
    }
  }

  // We extract the translators.
  if (typeof content.translator == "object") {
    const items = await Object.entries(content.translator);

    for (const item of items) {
      const key = item[0];
      const value = item[1];
      const content = await httpGet(new URL(value, path).href).then(
        (data) => data,
      );

      global.afrim.translators[key] = content;
    }
  }
}
