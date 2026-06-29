// Acts as an MCP client (the "Claude queries loupe" analog): spawns the stdio server,
// lists tools, and runs the "can I afford Zepbound right now?" worked example.
//   npm run mcp:smoke

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/mcp/server.ts'] })
const client = new Client({ name: 'loupe-smoke', version: '1.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
console.log('tools:', tools.map((t) => t.name).join(', '))

type CostOut = { cost_basis: string; points: { nadac_per_unit_usd: number | null; pricing_unit: string | null }[] }
const cost = (await client.callTool({ name: 'get_drug_cost', arguments: { drug_id: 'tirzepatide-zepbound' } }))
  .structuredContent as CostOut
const prices = cost.points.map((p) => p.nadac_per_unit_usd).filter((n): n is number => n != null)
console.log('\n"can I afford Zepbound right now?" →')
console.log('  basis     :', cost.cost_basis)
console.log('  cheapest  : $' + Math.min(...prices).toFixed(2), 'per', cost.points[0]?.pricing_unit)

const shortage = (await client.callTool({ name: 'get_drug_shortage', arguments: { drug_id: 'tirzepatide-zepbound' } }))
  .structuredContent as { status: string }
console.log('  supply    :', shortage.status)

await client.close()
console.log('\nMCP smoke ok')
