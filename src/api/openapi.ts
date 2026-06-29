import { z } from 'zod'
import { Drug, DrugSummary, Identity, Cost, Shortage, Label, Alternatives, PANELS } from '../core/schema'
import { GUARDRAILS } from '../core/guardrails'

// OpenAPI 3.0 generated from the ONE zod contract via native Zod-4 toJSONSchema
// (no @hono/zod-openapi → avoids the Zod-3/4 coupling hazard, SPEC §2).
const js = (s: z.ZodType) => z.toJSONSchema(s, { target: 'openapi-3.0' }) as Record<string, unknown>

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

export function openapiDoc() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'loupe API',
      version: '1',
      description:
        'One sourced record per GLP-1 / cardiometabolic drug, from five free US-government datasets. ' +
        `Keyless, read-only. ${GUARDRAILS.notMedicalAdvice} ` +
        'Cost is NADAC acquisition cost (≠ copay); FAERS counts are reports, not rates; label text is verbatim.',
    },
    servers: [{ url: '/', description: 'same origin' }],
    paths: {
      '/v1/drugs': {
        get: {
          summary: 'List drugs (filterable)',
          parameters: [
            { name: 'class', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' }, description: 'approval_status' },
            { name: 'shortage', in: 'query', schema: { type: 'string' }, description: 'shortage_status' },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['cost', 'name'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            '200': {
              description: 'matching drug summaries',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { count: { type: 'integer' }, results: { type: 'array', items: ref('DrugSummary') } },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/drugs/{slug}': {
        get: {
          summary: 'Full canonical record for one drug',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'the Drug record', content: { 'application/json': { schema: ref('Drug') } } },
            '404': { description: 'unknown drug_id' },
          },
        },
      },
      '/v1/drugs/{slug}/{panel}': {
        get: {
          summary: 'One panel of a drug record',
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
            {
              name: 'panel',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: [...PANELS] },
            },
          ],
          responses: {
            '200': {
              description: 'the requested panel',
              content: {
                'application/json': {
                  schema: { oneOf: [ref('Identity'), ref('Cost'), ref('Shortage'), ref('Label'), ref('Alternatives')] },
                },
              },
            },
          },
        },
      },
      '/v1/search': {
        get: {
          summary: 'Substring search over the curated registry',
          parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'matching summaries',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { query: { type: 'string' }, results: { type: 'array', items: ref('DrugSummary') } },
                  },
                },
              },
            },
            '400': { description: 'q is required' },
          },
        },
      },
    },
    components: {
      schemas: {
        Drug: js(Drug),
        DrugSummary: js(DrugSummary),
        Identity: js(Identity),
        Cost: js(Cost),
        Shortage: js(Shortage),
        Label: js(Label),
        Alternatives: js(Alternatives),
      },
    },
  }
}
