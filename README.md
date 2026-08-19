# StellarPrism

StellarPrism is an interactive 3D Stellarator visualization and lightweight plasma simulation demo. It uses Three.js for 3D rendering and Chart.js for analytics. The project is intended as a modular foundation for building more advanced simulations and UIs.

Developer
- Name: nehalmr
- GitHub: @nehalmr

Quick start

1. Install dependencies:

```bash
git clone https://github.com/nehalmr/stellarprism.git
cd stellarprism
npm install
```

2. Run dev server (HMR):

```bash
npm run dev
```

3. Open the URL shown by Vite (usually http://localhost:5173).

Build & preview (production):

```bash
npm run build
npm run preview
```

Testing, lint, format

```bash
npm run test    # vitest
npm run lint    # eslint
npm run format  # prettier
```

Project structure

- `index.html` — root entry (loads `src/main.ts`)
- `src/` — application sources
	- `main.ts` — scene setup, UI wiring, shader material, analytics
	- `styles.css` — global styles
	- `utils.ts` — testable utility functions
- `test/` — Vitest unit tests
- `.github/workflows/ci.yml` — CI pipeline (lint, test, build)

Key features

- Toroidal core visualization (Three.js TorusGeometry)
- Plasma rendered as a GPU shader (per-vertex coloring on GPU)
- Heating elements (add/remove, place on core) that influence plasma visual state
- Shader fallback: a texture-based heatmap option if uniform arrays aren't supported
- Real-time analytics via Chart.js (avg temp, magnetic-field samples)
- Basic project tooling: TypeScript, ESLint, Prettier, Vitest, Vite build/dev

Notes & recommendations

- The shader currently supports up to a configurable `MAX_HEAT` heaters via uniforms; a texture-based fallback packs heater positions+powers into a DataTexture to scale beyond the uniform limit.
- Bundle size: production build may be large; for production consider code-splitting and lazy-loading Chart.js.
- For high-performance, shift more work to GPU (e.g., compute plasma vertex displacement in the vertex shader) and reduce CPU-side per-frame allocations.

Contributing

Open issues or pull requests on GitHub: https://github.com/nehalmr

License

This project is provided as an example and includes no license file by default. Add a license if you plan to publish.
