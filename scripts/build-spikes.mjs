// Copies each spike into dist/ as a standalone page. Spike files hold only the page content
// (the artifact viewer adds the document skeleton), so this adds the skeleton for hosting.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
</head>
<body>
`

mkdirSync('dist', { recursive: true })
for (const file of readdirSync('spikes').filter((f) => f.endsWith('.html'))) {
  const body = readFileSync(`spikes/${file}`, 'utf8')
  writeFileSync(`dist/${file}`, `${head}${body}\n</body>\n</html>\n`)
  console.log(`spike: dist/${file}`)
}
