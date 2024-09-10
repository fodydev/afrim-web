<div align="center">

  <h1><code>afrim-input</code></h1>

<strong>A <code>js library</code> that simplify the deployment of `afrim` in any text field.</strong>

<p>
  <a href="https://www.npmjs.org/package/afrim-input"><img alt="NPM version" src="https://img.shields.io/npm/v/afrim-input.svg?style=flat-square"/></a>
</p>

</div>

## Lite Version

We also offer a lite version of this library for those who need a more lightweight solution.

You can find it here [npm/afrim-input-lite](https://www.npmjs.com/package/afrim-input-lite).

**Note:** This version is based on afrim-lite. Confer [github/fodydev/afrim-lite](https://github.com/fodydev/afrim-js?tab=readme-ov-file#lite-version)

## 🚀 Usage

In its simplest case, `afrim-input` can be initialised with a single line of Javascript:

```js
new AfrimInput({
  textFieldElementID: "textfield",
  downloadStatusElementID: "download-status",
  tooltipElementID: "tooltip",
  tooltipInputElementID: "tooltip-input",
  tooltipPredicatesElementID: "tooltip-predicates",
  configUrl: `https://raw.githubusercontent.com/fodydev/afrim-data/4b177197bb37c9742cd90627b1ad543c32ec791b/gez/gez.toml`,
});
```

## License

Licensed under MIT license ([LICENSE](LICENSE) or http://opensource.org/licenses/MIT).

### Contribution

We are open for contribution.
