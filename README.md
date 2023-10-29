<div align="center">

  <h1><code>afrim-web</code></h1>

<strong>A <code>web app</code> to showcase the working of the <a href="https://github.com/pythonbrad/afrim-js">afrim-js</a>.</strong>

  <p>
    <a href="https://github.com/pythonbrad/afrim-web/actions/workflows/ci.yml"><img alt="Build Status" src="https://github.com/pythonbrad/afrim-web/actions/workflows/ci.yml/badge.svg?branch=main"/></a>
  </p>

<sub>Built by <a href="https://github.com/pythonbrad">@pythonbrad</a></sub>

</div>

## 🚴 Usage

```
npm install
npm start
```

## 🔋 Files Included

- `.gitignore`: ignores `node_modules`
- `README.md`: the file you are reading now!
- `index.html`: a bare bones html document that includes the webpack bundle
- `index.js`: example js file with a comment showing how to use the `afrim-js`
- `config.js`: example js file with a comment showing how to import afrim config file
- `utils.js`: some useful functions
- `package.json` and `package-lock.json`:
  - pulls in devDependencies for using webpack:
    - [`webpack`](https://www.npmjs.com/package/webpack)
    - [`webpack-cli`](https://www.npmjs.com/package/webpack-cli)
    - [`webpack-dev-server`](https://www.npmjs.com/package/webpack-dev-server)
  - defines a `start` script to run `webpack-dev-server`
- `webpack.config.js`: configuration file for bundling your js with webpack

## License

Licensed under MIT license ([LICENSE](LICENSE) or http://opensource.org/licenses/MIT).

### Contribution

We are open for contribution.
