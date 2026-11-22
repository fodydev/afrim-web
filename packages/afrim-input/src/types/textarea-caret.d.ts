// Minimal typings for https://github.com/component/textarea-caret-position
declare module "textarea-caret" {
  type CaretCoordinates = { top: number; left: number; height: number };

  export default function getCaretCoordinates(
    element: HTMLInputElement | HTMLTextAreaElement,
    position: number,
    options?: { debug?: boolean },
  ): CaretCoordinates;
}
