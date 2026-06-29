// /docs — Scalar API reference (dark), loaded from CDN so we add no build dep.
export function docsHtml(): string {
  return `<!doctype html>
<html class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>loupe API — reference</title>
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script>
      document.getElementById('api-reference').dataset.configuration = JSON.stringify({ theme: 'kepler', darkMode: true })
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`
}
