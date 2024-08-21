// A dependency graph that contains any wasm must all be imported
// asynchronously. This `bootstrap.js` file does the single async import, so
// that no one else needs to worry about it again.
import("./index.js")
  .then((o) => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[afrim-input] Looks like we are in development mode!");
    }
    window.Afrim = o.default;
  })
  .catch((e) => console.error("Error importing `index.ts`:", e));
