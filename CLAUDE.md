# loupe — Claude Code instructions

One sourced page per GLP-1 / cardiometabolic drug, from five free US-government datasets,
served three ways from ONE Zod contract: a React SPA, a Hono `/v1` API, and an MCP server.

## Commands

```bash
npm run dev        # SPA → http://localhost:3001
npm run api        # API + SPA → http://localhost:8787
npm run mcp:smoke  # spawn the MCP server, run the "can I afford Zepbound?" example
npm test           # vitest (jsdom)
npm run test:coverage  # vitest + v8 coverage gate on the request-time logic (CI runs this)
npm run build      # tsc --noEmit && vite build
npm run lint       # eslint
npm run prefetch   # rebuild src/data/snapshot/* from live upstreams (needs network)
npm run verify     # CI drift gate: re-resolve seeds + CMS datasets against live upstreams
```

## Invariants (do not break)

- **One contract.** `src/core/schema.ts` is the single source of truth. The SPA, API
  (`src/api/`), and MCP (`src/mcp/`) all read it via `src/core/service.ts`. An HTTP body and
  an MCP tool result are the same object. Never add a second drug shape.
- **Guardrail strings live once** in `src/core/guardrails.ts`; the schema pins them as
  `z.literal` defaults. Never re-author the disclaimers in UI/API/MCP — import them.
- **Snapshots OMIT guardrail literals.** `resolveDrug` builds literal-free objects;
  `Drug.parse()` back-fills them on read. `literals.test.ts` enforces it. Never write a
  disclaimer string into a snapshot.
- **Browser/node split.** `service.ts`, `http.ts`, `resolveDrug.ts`, `sourcefetch/*` are
  node-only (fs / live fetch) — never import them from the SPA.
- **Trust framing is load-bearing:** cost is NADAC acquisition (≠ copay); FAERS = reports,
  not rates; labels are verbatim; alternatives are clinician-gated. Don't soften or invert.
- **est. $/mo only when dose-countable** (`src/core/derive.ts`) — never infer a monthly
  figure for mL-priced injectables (that's a clinical assumption).
- **Theme is token-driven, light + dark.** Light is the default; `html.dark` (in
  `src/index.css`) overrides the same semantic tokens. Every component themes via the
  semantic utilities (`bg-bg`/`text-fg`/`text-muted`/`text-primary`/…) — keep both modes AA.

## Style

- TypeScript strict, no `any`. snake_case on the wire (matches the gov data), camelCase in TS.
- 2-space indent, single quotes, no semicolons (prettier). LF endings.
- Tailwind 4 CSS-first: tokens in `src/index.css @theme` (+ `html.dark` overrides). No
  hardcoded hex in components except the documented exemptions: the cost ramp
  (`src/lib/costRamp.ts`) and the no-`window` chart-color fallbacks (`LabelDetail.tsx`). The
  pre-paint theme `<script>` in `index.html` necessarily inlines the bg hex (runs before CSS).
