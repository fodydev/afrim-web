import { fetchText, loadAfrim, tomlToJson } from "./utils";

// A TOML table, as returned by afrim's TOML parser.
type TomlTable = Map<string, any>;
// A `key = value` entry of a TOML table.
type TomlEntry = [string, any];

// What to load, shared by a configuration and the files it includes.
type LoadOptions = {
  downloadStatusElement: HTMLElement;
  ignoreTranslation: boolean;
  ignoreTranslators: boolean;
  // Aborts the downloads still running when the loading fails.
  signal: AbortSignal;
};

function isTable(value: unknown): value is TomlTable {
  return value instanceof Map;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Entries of the `name` table of `content`, or none if it is absent or ignored.
function entriesOf(
  content: TomlTable,
  name: string,
  ignored = false,
): TomlEntry[] {
  return !ignored && content.has(name) ? Array.from(content.get(name)) : [];
}

/**
 * Resolves the URL of a configuration file included by `baseUrl`.
 * When the configuration is gzipped (`*.toml.gz`), its included TOML files
 * are gzipped too, so `.gz` is appended to them.
 */
function resolveInclude(path: string, baseUrl: string): string {
  const url = new URL(path, baseUrl);

  if (baseUrl.endsWith(".gz") && url.pathname.endsWith(".toml")) {
    url.pathname += ".gz";
  }
  return url.href;
}

/** An Afrim configuration: data, translation dictionary and translators. */
export class AfrimConfig {
  data: Record<string, string> = {};
  translation: Record<string, string[]> = {};
  translators: Record<string, string> = {};

  /**
   * Loads the configuration file at `configUrl` and every file it includes.
   * The configuration can be plain (`*.toml`) or gzipped (`*.toml.gz`).
   */
  async loadFromUrl(
    configUrl: string,
    downloadStatusElement: HTMLElement,
    ignoreTranslation: boolean,
    ignoreTranslators: boolean,
  ): Promise<void> {
    const controller = new AbortController();
    try {
      await this.load(configUrl, {
        downloadStatusElement,
        ignoreTranslation,
        ignoreTranslators,
        signal: controller.signal,
      });
    } catch (err) {
      // Stop the other downloads: they are useless now, and their progress
      // would overwrite the error shown in the status element.
      controller.abort();
      throw err;
    }
  }

  private async load(configUrl: string, options: LoadOptions): Promise<void> {
    // Start the wasm download now, so it overlaps with the config download.
    loadAfrim();

    const content: TomlTable = await tomlToJson(
      await fetchText(configUrl, options.downloadStatusElement, options.signal),
    );
    const autoCapitalize: boolean =
      content.get("core")?.get("auto_capitalize") ?? false;

    const translationEntries = entriesOf(
      content,
      "translation",
      options.ignoreTranslation,
    );
    const dataEntries = entriesOf(content, "data");
    const translatorEntries = entriesOf(
      content,
      "translators",
      options.ignoreTranslators,
    );

    // Download every included file and translator in parallel.
    // They are merged below in their original order, so later entries
    // still override earlier ones.
    const loadIncludes = (entries: TomlEntry[]) =>
      entries.map(([, value]) =>
        isTable(value) && value.has("path")
          ? AfrimConfig.loadChild(
              resolveInclude(value.get("path"), configUrl),
              options,
            )
          : null,
      );
    const translationIncludes = loadIncludes(translationEntries);
    const dataIncludes = loadIncludes(dataEntries);
    const translatorScripts = Promise.all(
      translatorEntries.map(([, path]) =>
        fetchText(
          new URL(path, configUrl).href,
          options.downloadStatusElement,
          options.signal,
        ),
      ),
    );
    // Avoid unhandled rejections if we fail before awaiting some of them.
    for (const pending of [
      ...translationIncludes,
      ...dataIncludes,
      translatorScripts,
    ]) {
      pending?.catch(() => {});
    }

    for (const [index, [key, value]] of translationEntries.entries()) {
      const include = translationIncludes[index];

      if (include) {
        this.merge(await include);
      } else {
        this.applyTranslation(key, value, configUrl);
      }
    }

    for (const [index, [key, value]] of dataEntries.entries()) {
      const include = dataIncludes[index];

      if (include) {
        this.merge(await include);
      } else {
        this.applyData(key, value, autoCapitalize, configUrl);
      }
    }

    const scripts = await translatorScripts;
    for (const [index, [name]] of translatorEntries.entries()) {
      this.translators[name] = scripts[index];
    }
  }

  // Loads an included configuration file into a separate instance.
  private static async loadChild(
    configUrl: string,
    options: LoadOptions,
  ): Promise<AfrimConfig> {
    const child = new AfrimConfig();
    await child.load(configUrl, options);
    return child;
  }

  // Merges another configuration into this one, its entries take precedence.
  private merge(other: AfrimConfig): void {
    Object.assign(this.data, other.data);
    Object.assign(this.translation, other.translation);
    Object.assign(this.translators, other.translators);
  }

  // Applies a `[translation]` entry: `key = "text"`, `key = ["text", …]`
  // or a table with aliases.
  private applyTranslation(key: string, value: unknown, configUrl: string) {
    if (typeof value === "string") {
      this.translation[key] = [value];
    } else if (Array.isArray(value)) {
      this.translation[key] = value;
    } else if (isTable(value) && value.has("alias")) {
      const texts: string[] = value.has("values")
        ? value.get("values")
        : [value.get("value")];

      for (const alias of value.get("alias")) {
        this.translation[alias] = texts;
      }
      this.translation[key] = texts;
    } else {
      throw new Error(
        `load config error: unexpected value for "${key}" in ${configUrl}`,
      );
    }
  }

  // Applies a `[data]` entry: `key = "text"` or a table with aliases.
  private applyData(
    key: string,
    value: unknown,
    autoCapitalize: boolean,
    configUrl: string,
  ) {
    if (typeof value === "string") {
      this.data[key] = value;
    } else if (isTable(value) && value.has("alias")) {
      const text: string = value.get("value");

      for (const alias of value.get("alias")) {
        this.data[alias] = text;

        if (autoCapitalize) {
          this.data[capitalize(text)] = text.toUpperCase();
        }
      }
      this.data[key] = text;

      if (autoCapitalize) {
        this.data[capitalize(key)] = text.toUpperCase();
      }
    } else {
      throw new Error(
        `load config error: unexpected value for "${key}" in ${configUrl}`,
      );
    }
  }
}
