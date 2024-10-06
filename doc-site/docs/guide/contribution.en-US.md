---
nav:
  title: Guide
  order: 2
group:
  title: other
  order: 4
order: 1
---

# Contribution Guide

If you're willing to help improve the WebAV project, first, a big salute to the warrior 🫡.

All contributions that help the project grow are welcome, including but not limited to:

- Assisting the community by answering Issues
- Documentation: improving the project site, API documentation, translations
- Code: Bugfixes, new features, unit tests
- Financial sponsorships

For new APIs, changes to existing APIs, or large bugfixes with significant code changes, it's crucial to discuss them with the project maintainers in an issue before starting. Wasting warriors' time is a grave offense.

---

**For documentation and code** contributions, please read the following:

## Running the Project

1. Clone the project locally
2. Run `pnpm install && pnpm build` in the root directory
3. Navigate to the specific package (let's assume it's `av-cliper`), and run `pnpm dev`
4. The path refers to the file name in the DEMO directory, such as `concat-media.html`
5. Open the DEMO URL in the browser, such as `http://localhost:6066/concat-media.html`
6. Run `pnpm test` to execute the unit tests of that package

## Running the WebAV Site

1. Clone the project locally
2. Run `pnpm install && pnpm build` in the root directory
3. Navigate to the `doc-site` directory, and run `pnpm dev`
4. Follow the terminal instructions to visit the specified URL

Starting the local site allows a smoother experience with the DEMO. The site also contains more examples for testing if the features are functioning correctly.

## Commit Guidelines

Please follow the [Angular's commit convention](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular) for commit message format.

## Code Guidelines

1. This project uses Prettier to format code. Please install the Prettier plugin to avoid style conflicts and prevent formatting issues from interfering with the PR code.
2. Make sure to run unit tests before submitting a PR (automatic validation will be added to the workflow in the future).

## Project Workflow

This project uses [changesets](https://github.com/changesets/changesets) to manage and automatically release versions.

After creating a PR, use the `pnpm changeset add` command to add a description of the PR. This helps auto-generate the changelog and update the package's version number.

Otherwise, a bot will remind you in the PR. For more details, please refer to the changesets documentation.
