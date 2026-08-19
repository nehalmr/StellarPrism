# Developer Guide — StellarPrism

This document helps contributors set up a local development environment and explains the primary developer commands.

Prerequisites

- Node.js 18+ and npm
- Recommended: code editor (VS Code)

Local setup

```bash
git clone https://github.com/nehalmr/stellarprism.git
cd stellarprism
npm install
```

Run development server (HMR):

```bash
npm run dev
# open http://localhost:5173
```

Run tests:

```bash
npm run test
```

Lint and format:

```bash
npm run lint
npm run format
```

Build production bundle:

```bash
npm run build
npm run preview
```

Project notes

- Entry point: `src/main.ts` — keep this file focused on wiring and high-level composition.
- GPU shader: the plasma coloring is implemented in a `ShaderMaterial` with a texture fallback to support additional heating elements.
- Tests: simple utilities are located in `src/utils.ts` and tested under `test/`.
