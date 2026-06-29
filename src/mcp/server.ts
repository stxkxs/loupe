// loupe MCP server (SPEC §4.4) — the third face of the ONE contract. Every tool reads
// the same DrugService the HTTP API uses, so an MCP result is byte-identical to a /v1
// response. stdio transport.
//
//   npx tsx src/mcp/server.ts        # or add to an MCP client's config
//
// Claude config example:
//   { "mcpServers": { "loupe": { "command": "npx", "args": ["tsx", "src/mcp/server.ts"] } } }

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { Drug, Cost, Shortage, Label, Alternatives, DrugSummary } from '../core/schema'
import { GUARDRAILS } from '../core/guardrails'
import { LoupeError } from '../core/errors'
import * as svc from '../core/service'

const DISCLAIMER =
  `${GUARDRAILS.notMedicalAdvice} Cost is NADAC acquisition cost (≠ patient copay). ` +
  'FAERS counts are spontaneous reports, not incidence rates. Label text is verbatim. ' +
  'Same-class alternatives are informational and clinician-gated — never advise a switch.'

const server = new McpServer({ name: 'loupe', version: '1.0.0' })

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
})
const notFound = (drug_id: string) => new LoupeError('not_found', `unknown drug_id: ${drug_id}`).toMcp()

const ListShape = { count: z.number(), results: z.array(DrugSummary) }
const SearchShape = { query: z.string(), results: z.array(DrugSummary) }

server.registerTool(
  'get_drug',
  {
    description: `Full sourced record (identity, cost, supply, label, alternatives) for one drug_id. ${DISCLAIMER}`,
    inputSchema: { drug_id: z.string() },
    outputSchema: Drug.shape,
  },
  async ({ drug_id }) => {
    const d = svc.getDrug(drug_id)
    return d ? ok(Drug.parse(d)) : notFound(drug_id)
  },
)

server.registerTool(
  'list_drugs',
  {
    description: `List the curated registry, filterable by class/status/shortage, sortable by cost|name. ${DISCLAIMER}`,
    inputSchema: {
      class: z.string().optional(),
      status: z.string().optional(),
      shortage: z.string().optional(),
      sort: z.enum(['cost', 'name']).optional(),
      limit: z.number().optional(),
    },
    outputSchema: ListShape,
  },
  async (args) => ok(svc.listDrugs(args)),
)

server.registerTool(
  'search_drugs',
  {
    description: `Substring search over brand/generic/rxcui in the curated registry. ${DISCLAIMER}`,
    inputSchema: { query: z.string(), limit: z.number().optional() },
    outputSchema: SearchShape,
  },
  async ({ query, limit }) => ok(svc.searchDrugs(query, limit)),
)

server.registerTool(
  'get_drug_cost',
  {
    description: `NADAC acquisition cost for a drug (cost_basis + disclaimer included). NADAC ≠ patient copay. ${DISCLAIMER}`,
    inputSchema: { drug_id: z.string() },
    outputSchema: Cost.shape,
  },
  async ({ drug_id }) => {
    const d = svc.getDrug(drug_id)
    return d ? ok(d.cost) : notFound(drug_id)
  },
)

server.registerTool(
  'get_drug_shortage',
  {
    description: `Current FDA Drug Shortages status for a drug (national; a pharmacy may differ). ${DISCLAIMER}`,
    inputSchema: { drug_id: z.string() },
    outputSchema: Shortage.shape,
  },
  async ({ drug_id }) => {
    const d = svc.getDrug(drug_id)
    return d ? ok(d.shortage) : notFound(drug_id)
  },
)

server.registerTool(
  'get_drug_label',
  {
    description: `Verbatim FDA label quotes + FAERS adverse-event report counts (REPORTS, not rates). ${DISCLAIMER}`,
    inputSchema: { drug_id: z.string() },
    outputSchema: Label.shape,
  },
  async ({ drug_id }) => {
    const d = svc.getDrug(drug_id)
    return d ? ok(d.label) : notFound(drug_id)
  },
)

server.registerTool(
  'get_drug_alternatives',
  {
    description: `Same pharmacologic-class drugs (RxClass). Informational + clinician-gated — never a recommendation. ${DISCLAIMER}`,
    inputSchema: { drug_id: z.string() },
    outputSchema: Alternatives.shape,
  },
  async ({ drug_id }) => {
    const d = svc.getDrug(drug_id)
    return d ? ok(d.alternatives) : notFound(drug_id)
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
