// One error type shared by the HTTP API and the MCP server (SPEC §4.4).
export class LoupeError extends Error {
  constructor(
    public code: 'not_found' | 'bad_request',
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'LoupeError'
  }
  toHttp(): { status: number; body: { error: string; message: string } } {
    return { status: this.status, body: { error: this.code, message: this.message } }
  }
  toMcp(): { isError: true; content: { type: 'text'; text: string }[] } {
    return { isError: true, content: [{ type: 'text', text: `${this.code}: ${this.message}` }] }
  }
}
