"use strict";

import { httpGet, tomlToJson } from "./utils";

// Load the afrim configuration through an URL.
export class AfrimConfig {
  config = Object({
    data: Object({}),
    dictionary: Object({}),
    translators: Object({}),
  });

  constructor() {}

  async loadFromUrl(configUrl) {
    const data = await httpGet(configUrl);
    const content = tomlToJson(data);
    let auto_capitalize = false;

    if (content.has("core")) {
      auto_capitalize = content.get("core").get("auto_capitalize") || false;
    }

    if (content.has("translation")) {
      for (const translation of content.get("translation")) {
        const key = translation[0];
        const value = translation[1];

        // We extract the translation.
        if (typeof value == "string") {
          this.config.dictionary[key] = [value];
        } else if (value.has("path")) {
          await this.loadFromUrl(new URL(value.get("path"), configUrl).href);
        } else if (value.has("alias")) {
          let data = null;

          if (value.has("values")) {
            data = value.get("values");
          } else {
            data = [value.get("value")];
          }

          for (const alias of value.get("alias")) {
            this.config.dictionary[alias] = data;
          }
          this.config.dictionary[key] = data;
        } else {
          throw new Error(`load config error: ${value} unexpected`);
        }
      }
    }

    // We extract the data.
    if (content.has("data")) {
      for (const data of content.get("data")) {
        const key = data[0];
        const value = data[1];

        if (typeof value == "string") {
          this.config.data[key] = value;
        } else if (value.has("path")) {
          await this.loadFromUrl(new URL(value.get("path"), configUrl).href);
        } else if (value.has("alias")) {
          const data = value.get("value");
          for (const alias of value.get("alias")) {
            this.config.data[alias] = data;

            if (auto_capitalize) {
              this.config.data[data[0].toUpperCase() + data.slice(1)] =
                data.toUpperCase();
            }
          }
          this.config.data[key] = data;

          if (auto_capitalize) {
            this.config.data[key[0].toUpperCase() + key.slice(1)] =
              data.toUpperCase();
          }
        } else {
          throw new Error(`load config error: ${value} unexpected`);
        }
      }
    }

    // We extract the translators.
    if (content.has("translators")) {
      for (const translator of content.get("translators")) {
        const key = translator[0];
        const value = translator[1];
        const data = await httpGet(new URL(value, configUrl).href);

        this.config.translators[key] = data;
      }
    }
  }
}
