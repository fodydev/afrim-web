"use strict";

import { convertTomlToJson } from "afrim-js";
import ky from "ky";

// Convert TOML to JSON.
export function tomlToJson(data: string) {
  return convertTomlToJson(data);
}

// Make a http get request.
// HTTP because we want a fast request.
export async function httpGet(url: string) {
  const response = await ky(url);

  if (!response.ok) throw new Error(`Fetch error: ${response.statusText}`);

  return await response.text();
}
