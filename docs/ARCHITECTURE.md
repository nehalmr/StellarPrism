# Architecture Notes — StellarPrism

Overview

StellarPrism is organized for clarity and incremental extension. The main responsibilities are:

- Rendering: Three.js scene setup (`src/main.ts`)
- Simulation: heating elements influence (GPU) plasma appearance
- Analytics: Chart.js time-series visualizations
- Utilities: small, testable functions in `src/utils.ts`

Shader design

- The plasma is rendered with a `ShaderMaterial`.
- Heating inputs are passed to the shader either as uniform arrays (positions/powers) or as a `DataTexture` packing (x,y,z,power) per texel. The latter scales beyond uniform limits and is used when available.
- Fragment shader computes a simple distance-weighted influence per heat source and maps an accumulated temperature to a color.

Performance considerations

- Prefer GPU work: any per-vertex computations should live in vertex/fragment shaders.
- Reduce draw calls: group heating elements or render them as instanced meshes when count grows.
- Code-splitting: lazy-load analytics (Chart.js) to reduce initial bundle size.
