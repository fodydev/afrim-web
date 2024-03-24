<div align="center">

  <h1><code>afrim-web</code></h1>

<strong>A <code>web input method engine</code> powered by <a href="https://github.com/pythonbrad/afrim-js">afrim-js</a>.</strong>

  <p>
    <a href="https://github.com/pythonbrad/afrim-web/actions/workflows/ci.yml"><img alt="Build Status" src="https://github.com/pythonbrad/afrim-web/actions/workflows/ci.yml/badge.svg?branch=main"/></a>&nbsp;
    <a href="https://github.com/pythonbrad/afrim-web/actions/workflows/deploy.yml"><img alt="Deploy Status" src="https://github.com/pythonbrad/afrim-web/actions/workflows/deploy.yml/badge.svg?branch=main"/></a>
  </p>

<img alt="Demo" src="https://github.com/pythonbrad/afrim-web/assets/45305909/d0cdf903-c2bc-4a1b-8bf7-d99d460c1019"/>

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
- `src/index.html`: a bare bones html document that includes the webpack bundle
- `src/index.js`: the entry point of our web app
- `src/config.js`: set of tools to handle the afrim config file
- `src/utils.js`: some useful functions
- `package.json` and `package-lock.json`:
  - pulls in devDependencies for using webpack:
    - [`webpack`](https://www.npmjs.com/package/webpack)
    - [`webpack-cli`](https://www.npmjs.com/package/webpack-cli)
    - [`webpack-dev-server`](https://www.npmjs.com/package/webpack-dev-server)
  - defines a `start` script to run `webpack-dev-server`
- `webpack.config.js`: configuration file for bundling the js with webpack

## License

Licensed under MIT license ([LICENSE](LICENSE) or http://opensource.org/licenses/MIT).

### Contribution

We are open for contribution.
