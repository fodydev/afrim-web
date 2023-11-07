import { convert_toml_to_json } from "afrim-js";

// Convert TOML to JSON.
export function tomlToJson(data) {
  return JSON.parse(convert_toml_to_json(data));
}

// Make a http get request.
// HTTP because we want a fast request.
export async function httpGet(url) {
  return await new Promise((resolve, reject) => {
    const http = require("http");
    var req = http.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.error(
          `Did not get an OK from the server. Code: ${res.statusCode}`,
        );
        res.resume();
        return;
      }

      var data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("close", () => {
        resolve(data);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
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
