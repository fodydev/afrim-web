"use strict";

import ky from "ky";

// Convert TOML to JSON.
export async function tomlToJson(data: string) {
  const afrim = await require("afrim");

  return afrim.convertTomlToJson(data);
}

// Make a http get request.
// HTTP because we want a fast request.
export async function httpGet(url: string) {
  const response = await ky(url);

  if (!response.ok) throw new Error(`Fetch error: ${response.statusText}`);

  return await response.text();
}
