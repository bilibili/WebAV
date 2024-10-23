---
nav:
  title: Guide
  order: 2
group:
  title: Start
order: 2
---

# Quick Start

## Installing dependencies

:::code-group

```bash [npm]
$ npm install @webav/av-cliper
```

```bash [pnpm]
$ pnpm add @webav/av-cliper
```

:::

If your project relies on multiple packages under `@webav/*`, be sure to keep their version numbers consistent.

## Project Structure

```
- doc-site                   // Documentation site
  - docs
    *.md
- packages                   // Monorepo managed by pnpm, refer to the module introduction section for more details
  - av-cliper
  - av-canvas
  - av-recorder
package.json

```

To start the project or the site, please refer to the [Contribution Guide](./contribution) section.

## Go Further

- Explore the [DEMO](../demo) to learn more about the project's capabilities
- Each DEMO allows you to expand and view the code, helping you understand how to integrate it into your project through example code
- Learn more details through the API or source code
- If you're new to this field, it's recommended to first read the [related articles](../article)
