"use strict";

import { httpGet, tomlToJson } from "./utils";

// Handle the Afrim configuration.
export class AfrimConfig {
  data: { [key: string]: string } = {};
  translation: { [key: string]: string[] } = {};
  translators: { [key: string]: string } = {};

  // Initialize an AfrimConfig instance.
  constructor() {}

  // Load the configuration file from an URL.
  async loadFromUrl(configUrl: string) {
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
          this.translation[key] = [value];
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
            this.translation[alias] = data;
          }
          this.translation[key] = data;
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
          this.data[key] = value;
        } else if (value.has("path")) {
          await this.loadFromUrl(new URL(value.get("path"), configUrl).href);
        } else if (value.has("alias")) {
          const data = value.get("value");
          for (const alias of value.get("alias")) {
            this.data[alias] = data;

            if (auto_capitalize) {
              this.data[data[0].toUpperCase() + data.slice(1)] =
                data.toUpperCase();
            }
          }
          this.data[key] = data;

          if (auto_capitalize) {
            this.data[key[0].toUpperCase() + key.slice(1)] = data.toUpperCase();
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

        this.translators[key] = data;
      }
    }
  }
}
