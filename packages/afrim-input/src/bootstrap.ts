import { default as AfrimInput } from "./index";
import type { AfrimInputOptions } from "./index";
import { AfrimConfig } from "./config";
import { loadAfrim as preloadAfrim } from "./utils";

if (process.env.NODE_ENV !== "production") {
  console.log("[afrim-input] Looks like we are in development mode!");
}

export { AfrimInput, AfrimConfig, preloadAfrim };
export type { AfrimInputOptions };
