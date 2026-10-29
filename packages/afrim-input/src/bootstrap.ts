import { default as AfrimInput } from "./index";
import { AfrimConfig } from "./config";

if (process.env.NODE_ENV !== "production") {
  console.log("[afrim-input] Looks like we are in development mode!");
}

export { AfrimInput, AfrimConfig };
