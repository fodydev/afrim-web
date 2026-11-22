import ky from "ky";

type AfrimModule = typeof import("afrim");

let afrimModule: Promise<AfrimModule> | null = null;

/**
 * Loads the afrim wasm module once, shared by every caller.
 * Calling it early lets the wasm download overlap with other requests.
 */
export function loadAfrim(): Promise<AfrimModule> {
  afrimModule ??= import("afrim");
  return afrimModule;
}

/** Converts a TOML document to its JSON (Map based) representation. */
export async function tomlToJson(data: string): Promise<any> {
  const afrim = await loadAfrim();

  return afrim.convertTomlToJson(data);
}

// The first two bytes of every gzip file.
const GZIP_MAGIC = [0x1f, 0x8b];

function isGzip(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

async function gunzip(buffer: ArrayBuffer): Promise<string> {
  const stream = new Blob([buffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));

  return new Response(stream).text();
}

/**
 * Downloads a text file, reporting the progress in `downloadStatusElement`.
 * Gzipped files (e.g. `*.toml.gz` served as `application/gzip`) are
 * decompressed here, since the browser only does it for `Content-Encoding`.
 */
export async function fetchText(
  url: string,
  downloadStatusElement: HTMLElement,
): Promise<string> {
  const response = await ky(url, {
    // Dictionaries can take a while on slow connections and the progress is
    // shown, so don't give up after ky's default 10s.
    timeout: false,
    onDownloadProgress: (progress) => {
      const percent = Math.round(progress.percent * 100);
      downloadStatusElement.textContent = `${url} | ${percent}% - ${progress.transferredBytes} of ${progress.totalBytes} bytes`;
    },
  });
  const buffer = await response.arrayBuffer();

  return isGzip(buffer) ? gunzip(buffer) : new TextDecoder().decode(buffer);
}
