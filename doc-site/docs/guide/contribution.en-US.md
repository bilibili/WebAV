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

## What can I contribute?

- features Add/change features
- unitest adds/modifies single tests
- bugfix Fixes existing issues
- doc documentation improvements
- other

## How to contribute?

#### Pull Repository

- Original repository：https://github.com/bilibili/WebAV.git
- Target repository：fork to your own github
  ![img](../../public/img/fork.jpg)

#### Pull Branch

The original branch is bilibili/WebAV main，The branch after pulling should be `your git username`/WebAV main

#### Submit Code

Do not include any `console-related methods` or `debugger` in your code unless otherwise noted. When you're done, submit the pull request in the repository you forked.

#### PR Specification

- Format: '<type>(<scope>): <subject>' Example: feat(doc): change video doc
- Content: Lists the changes
- Requirements: the added feat content should be clearly annotated, and the corresponding single-test coverage should be covered as much as possible
- BUGFIX requirement: if the modified issue is related to the issues, please attach the relevant issueID to the content.

#### Review&Merge

#### Synchronize source repository changes to repository after fork

```zsh
# First, add "upstream" to your branch, that is, the source repository
$ git remote add upstream https://github.com/bilibili/WebAV.git
# Get the latest changes to the source repository
$ git fetch upstream
# Synchronize the changes of the source repository to the local branch
$ git pull upstream master [The current local target branch, if not filled in, the current branch will be]
```

#### Project Development

```zsh
# clone the current project locally
$ git clone https://github.com/bilibili/WebAV.git
```

<br/>

```zsh
# go to the project directory
$ npm install && pnpm build
```

<br/>

```zsh
# cd to 'packages/xxx'
$ pnpm dev
```

Open the DEMO URL in the browser, such as http://localhost:6066/concat-media.html

```zsh
# Run the unit tests for the package
$ pnpm test
```
