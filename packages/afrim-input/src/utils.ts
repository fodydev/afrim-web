"use strict";

import ky from "ky";

// Convert TOML to JSON.
export async function tomlToJson(data: string) {
  const afrim = await import("afrim");

  return afrim.convertTomlToJson(data);
}

// Make a http get request.
// HTTP because we want a fast request.
export async function httpGet(url: string, downloadStatusElement: HTMLElement) {
  const response = await ky(url, {
    onDownloadProgress: (progress, chunk) => {
      downloadStatusElement.textContent = `${url} | ${progress.percent * 100}% - ${progress.transferredBytes} of ${progress.totalBytes} bytes`;
    },
  });

  if (!response.ok) throw new Error(`Fetch error: ${response.statusText}`);

  return await response.text();
}
