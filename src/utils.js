"use strict";

import { convertTomlToJson } from "afrim-js";
import ky from "ky";

// Convert TOML to JSON.
export function tomlToJson(data) {
  return convertTomlToJson(data);
}

// Make a http get request.
// HTTP because we want a fast request.
export async function httpGet(url) {
  const response = await ky(url);

  if (!response.ok) throw new Error(`Fetch error: ${response.statusText}`);

  return await response.text();
}

// Whether if the device is a mobile
export function isTouchDevice() {
  return (
    !!(
      typeof window !== "undefined" &&
      ("ontouchstart" in window ||
        (window.DocumentTouch &&
          typeof document !== "undefined" &&
          document instanceof window.DocumentTouch))
    ) ||
    !!(
      typeof navigator !== "undefined" &&
      (navigator.maxTouchPoints || navigator.msMaxTouchPoints)
    )
  );
}
