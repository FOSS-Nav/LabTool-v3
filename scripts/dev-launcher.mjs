/**
 * LabTool-V3 沙箱兼容开发启动器
 */

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync, copyFileSync } from 'node:fs'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, extname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'sucrase'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = join(ROOT, 'out')
const RENDERER_DIR = join(ROOT, 'src', 'renderer')
const SRC_DIR = join(ROOT, 'src')

const PORT = Number(process.env.PORT) || 5175

/* ============================================================
 * 1. tsc 编译 main + preload 为 CJS
 *    用临时 tsconfig + 后处理展平目录
 * ============================================================ */
async function compileNode() {
  console.log('[1/3] tsc compiling main + preload ...')
  await mkdir(OUT, { recursive: true })

  // 写临时 tsconfig（放在项目根，避免 include 路径解析问题）
  const tmpCfg = join(ROOT, '__tmp_tsconfig.json')
  const cfg = {
    compilerOptions: {
      module: 'CommonJS',
      moduleResolution: 'Node',
      target: 'ES2022',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      strict: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      noEmit: false,
      sourceMap: false,
      rootDir: SRC_DIR,
      outDir: join(OUT, 'compiled'),
      types: ['node']
    },
    include: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'src/shared/**/*.ts'
    ],
    exclude: [
      'node_modules', 'tests', 'out', 'dist',
      'electron.vite.config.ts'
    ]
  }
  await writeFile(tmpCfg, JSON.stringify(cfg, null, 2))

  // 跑 tsc
  const tscCode = await new Promise((res) => {
    const tsc = spawn(
      process.execPath,
      [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', tmpCfg],
      { cwd: ROOT, stdio: 'inherit' }
    )
    tsc.on('exit', (code) => res(code ?? 1))
    tsc.on('error', () => res(1))
  })
  if (tscCode !== 0) throw new Error('tsc exited ' + tscCode)

  // 清理临时 tsconfig
  try { rmSync(tmpCfg, { force: true }) } catch { /* ignore */ }

  // 展平 compiled/X → out/X（tsc 把 src 作为 rootDir 掉了）
  const compiledRoot = join(OUT, 'compiled')
  if (existsSync(compiledRoot)) {
    for (const sub of readdirSync(compiledRoot)) {
      const subSrc = join(compiledRoot, sub)
      const subDst = join(OUT, sub)
      if (!existsSync(subDst)) mkdirSync(subDst, { recursive: true })
      // 递归移动
      moveDir(subSrc, subDst)
    }
    rmSync(compiledRoot, { recursive: true, force: true })
  }
  console.log('  output flattened to out/')
}

function moveDir(src, dst) {
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, e.name)
    const d = join(dst, e.name)
    if (e.isDirectory()) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true })
      moveDir(s, d)
    } else {
      copyFileSync(s, d)
      rmSync(s, { force: true })
    }
  }
}

/* ============================================================
 * 2. sucrase 打包 renderer
 * ============================================================ */

const ENTRY = join(SRC_DIR, 'renderer', 'src', 'main.tsx')

const ALIAS = new Map([
  ['@shared', join(SRC_DIR, 'shared', 'index.ts')],
  ['@renderer', join(SRC_DIR, 'renderer', 'src')]
])

function resolveAlias(spec) {
  for (const [prefix, target] of ALIAS) {
    if (spec === prefix) return target
    if (spec.startsWith(prefix + '/')) {
      const rest = spec.slice(prefix.length + 1)
      const resolved = join(dirname(target), rest)
      return resolveExt(resolved)
    }
  }
  return null
}

function resolveExt(p) {
  if (existsSync(p)) {
    if (existsSync(p + '.ts')) return p + '.ts'
    if (existsSync(p + '.tsx')) return p + '.tsx'
    if (existsSync(p + '.js')) return p + '.js'
  }
  const exts = ['.ts', '.tsx', '.js', '.jsx', '']
  for (const ext of exts) {
    const candidate = p + ext
    if (existsSync(candidate)) return candidate
  }
  return p + '.ts'
}

function isBareExternal(spec) {
  if (spec.startsWith('.') || spec.startsWith('/')) return false
  if (spec.startsWith('@shared') || spec.startsWith('@renderer')) return false
  return true
}

function resolveImport(spec, fromFile) {
  const aliasResolved = resolveAlias(spec)
  if (aliasResolved) return aliasResolved
  if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) {
    const base = resolve(dirname(fromFile), spec)
    if (existsSync(base) && !existsSync(base + '.ts') && !existsSync(base + '.tsx')) {
      for (const idx of ['/index.ts', '/index.tsx', '/index.js']) {
        if (existsSync(base + idx)) return base + idx
      }
    }
    return resolveExt(base)
  }
  return null
}

function convertImportsToRequires(src) {
  let out = src
  out = out.replace(
    /^import\s+(?:(\*\s+as\s+(\w+))|(\{[^}]+\})|(\w+))\s*,?\s*(?:\*\s+as\s+(\w+))?\s+from\s+(['"`])([^'"`]+)\6\s*;?$/gm,
    (_m, starAll, starName, named, defaultName, _q, spec) => {
      const r = `__localRequire('${spec}')`
      if (starName) return `var ${starName} = ${r};`
      if (named) return `var ${named} = ${r};`
      if (defaultName) return `var ${defaultName} = ${r};`
      return `${r};`
    }
  )
  out = out.replace(/^import\s+(['"`])([^'"`]+)\1\s*;?$/gm, (_m, _q, spec) => `__localRequire('${spec}');`)
  out = out.replace(/^export\s+\{[^}]+\}\s+from\s+(['"`])([^'"`]+)\1\s*;?$/gm, (_m, _q, spec) => `__localRequire('${spec}');`)
  out = out.replace(/^export\s+\*\s+from\s+(['"`])([^'"`]+)\1\s*;?$/gm, (_m, _q, spec) => `__localRequire('${spec}');`)
  out = out.replace(/\brequire\(/g, '__localRequire(')
  return out
}

async function bundle() {
  console.log('[2/3] bundling renderer (sucrase) ...')

  const visited = new Set()
  const order = []
  const sources = new Map()

  async function visit(file) {
    if (visited.has(file)) return
    visited.add(file)
    order.push(file)

    let code
    try {
      code = await readFile(file, 'utf8')
    } catch (e) {
      throw new Error(`Failed to read ${file}: ${e.message}`)
    }

    const importRe =
      /(?:import\s+(?:[^'"`;]+?\s+from\s+)?['"`]([^'"`]+)['"`]|require\s*\(\s*['"`]([^'"`]+)['"`]\s*\))/g
    const deps = []
    let m
    while ((m = importRe.exec(code)) !== null) {
      const spec = m[1] || m[2]
      if (/\.(css|scss|sass|less|png|jpg|jpeg|gif|svg|woff2?)$/i.test(spec)) continue
      const resolved = resolveImport(spec, file)
      if (resolved && !isBareExternal(spec)) deps.push(resolved)
    }
    for (const dep of deps) await visit(dep)

    const t1 = transform(code, {
      transforms: ['typescript', 'jsx'],
      filePath: file
    }).code
    sources.set(file, convertImportsToRequires(t1))
  }

  await visit(ENTRY)
  console.log(`  collected: ${order.length} files`)

  const moduleId = (file) =>
    relative(SRC_DIR, file).replace(/\\/g, '/').replace(/\.(ts|tsx|js|jsx)$/, '')

  const parts = []
  parts.push('// Auto-generated by scripts/dev-launcher.mjs')
  parts.push('// Sandbox-mode renderer bundle (no esbuild, no vite)')
  parts.push('')
  parts.push('const __SOURCES__ = {')
  for (const file of order) {
    const id = moduleId(file)
    parts.push(`  ${JSON.stringify(id)}: ${JSON.stringify(sources.get(file))},`)
  }
  parts.push('};')
  parts.push('')
  parts.push('const __MODULES__ = new Map();')
  parts.push('const __LOADING__ = new Set();')
  parts.push('let __CURRENT_FILE__ = "";')
  parts.push('')
  parts.push('function __resolveFrom(spec, fromFile) {')
  parts.push('  if (spec.startsWith("./") || spec.startsWith("../")) {')
  parts.push('    const dir = fromFile.replace(/\\/[^/]*$/, "");')
  parts.push('    let base = dir.replace(/\\\\/g, "/") + "/" + spec;')
  parts.push('    base = base.replace(/([^/]+\\/)\\.\\//g, "$1");')
  parts.push('    while (/\\/\\.\\./.test(base)) base = base.replace(/[^/]+\\/\\.\\.\\//, "");')
  parts.push('    const exts = [".ts",".tsx",".js",".jsx",""];')
  parts.push('    for (const ext of exts) {')
  parts.push('      const c = ext === "" ? base : (base.endsWith(ext) ? base : base + ext);')
  parts.push('      if (c in __SOURCES__) return c;')
  parts.push('    }')
  parts.push('    return base;')
  parts.push('  }')
  parts.push('  if (spec === "@shared") return "src/shared/index.ts";')
  parts.push('  if (spec.startsWith("@shared/")) {')
  parts.push('    const rest = spec.slice(8);')
  parts.push('    for (const ext of [".ts",".tsx",".js",""]) {')
  parts.push('      const c = "src/shared/" + rest + ext;')
  parts.push('      if (c in __SOURCES__) return c;')
  parts.push('    }')
  parts.push('    return "src/shared/" + rest + ".ts";')
  parts.push('  }')
  parts.push('  if (spec === "@renderer") return "src/renderer/src/index.ts";')
  parts.push('  if (spec.startsWith("@renderer/")) return "src/renderer/src/" + spec.slice(10);')
  parts.push('  return spec;')
  parts.push('}')
  parts.push('')
  parts.push('function __localRequire(spec) {')
  parts.push('  if (!spec.startsWith(".") && !spec.startsWith("/") && !spec.startsWith("@")) {')
  parts.push('    if (spec === "react") return window.React;')
  parts.push('    if (spec === "react-dom") return window.ReactDOM;')
  parts.push('    if (spec === "react-dom/client") return window.ReactDOM;')
  parts.push('    if (spec === "zustand") return window.zustand || (function(){throw new Error("zustand missing")})();')
  parts.push('    if (spec === "zustand/middleware") return window.zustand && window.zustand.subscribeWithSelector')
  parts.push('      || (function(){throw new Error("zustand/middleware missing")})();')
  parts.push('    if (spec === "nanoid") return window.nanoid || (function(){return () => "id";})();')
  parts.push('    if (spec === "uplot") return window.uPlot;')
  parts.push('    throw new Error("Unknown bare import: " + spec);')
  parts.push('  }')
  parts.push('  const id = __resolveFrom(spec, __CURRENT_FILE__);')
  parts.push('  return __require(id);')
  parts.push('}')
  parts.push('')
  parts.push('function __require(id) {')
  parts.push('  if (__MODULES__.has(id)) return __MODULES__.get(id).exports;')
  parts.push('  if (__LOADING__.has(id)) throw new Error("circular: " + id);')
  parts.push('  __LOADING__.add(id);')
  parts.push('  const m = { exports: {} };')
  parts.push('  __MODULES__.set(id, m);')
  parts.push('  const prevFile = __CURRENT_FILE__;')
  parts.push('  __CURRENT_FILE__ = id;')
  parts.push('  const src = __SOURCES__[id];')
  parts.push('  if (src === undefined) throw new Error("Module not registered: " + id);')
  parts.push('  try {')
  parts.push('    new Function("__module", "__exports", "__localRequire", "window", "globalThis", src)(m, m.exports, __localRequire, window, globalThis);')
  parts.push('  } catch (e) {')
  parts.push('    throw new Error("Error in " + id + ": " + (e.stack || e.message));')
  parts.push('  }')
  parts.push('  __CURRENT_FILE__ = prevFile;')
  parts.push('  __LOADING__.delete(id);')
  parts.push('  return m.exports;')
  parts.push('}')
  parts.push('')
  parts.push('__require("src/renderer/src/main.tsx");')

  const bundlePath = join(OUT, 'renderer', 'bundle.js')
  await mkdir(dirname(bundlePath), { recursive: true })
  await writeFile(bundlePath, parts.join('\n'), 'utf8')
  console.log(`  bundle: ${relative(ROOT, bundlePath)}`)

  // 复制 HTML + CSS
  const htmlSrc = join(RENDERER_DIR, 'index.html')
  const htmlDst = join(OUT, 'renderer', 'index.html')
  await mkdir(dirname(htmlDst), { recursive: true })
  let html = readFileSync(htmlSrc, 'utf8')
  html = html.replace(
    '<script type="module" src="/src/main.tsx"></script>',
    [
      '<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>',
      '<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>',
      '<script src="https://unpkg.com/zustand@4.5.4/umd/zustand.production.min.js"></script>',
      '<script>window.zustandMiddleware = { subscribeWithSelector: window.zustand.subscribeWithSelector };</script>',
      '<script src="https://unpkg.com/uplot@1.6.30/dist/uPlot.iife.min.js"></script>',
      '<link rel="stylesheet" href="https://unpkg.com/uplot@1.6.30/dist/uPlot.min.css">',
      '<script src="./bundle.js"></script>'
    ].join('\n    ')
  )
  await writeFile(htmlDst, html, 'utf8')

  await copyFile(join(RENDERER_DIR, 'src', 'styles.css'), join(OUT, 'renderer', 'styles.css'))
  const compCssDir = join(RENDERER_DIR, 'src', 'components')
  if (existsSync(compCssDir)) {
    for (const comp of readdirSync(compCssDir)) {
      const cssFile = join(compCssDir, comp, comp + '.css')
      if (existsSync(cssFile)) {
        const dst = join(OUT, 'renderer', 'components', comp, comp + '.css')
        await mkdir(dirname(dst), { recursive: true })
        await writeFile(dst, readFileSync(cssFile, 'utf8'), 'utf8')
      }
    }
  }
}

async function copyFile(src, dst) {
  await mkdir(dirname(dst), { recursive: true })
  await writeFile(dst, readFileSync(src, 'utf8'), 'utf8')
}

/* ============================================================
 * 3. 启动 HTTP + Electron
 * ============================================================ */

async function startHttp() {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  }
  const root = join(OUT, 'renderer')
  const server = createServer(async (req, res) => {
    try {
      let url = decodeURIComponent((req.url || '/').split('?')[0])
      if (url === '/') url = '/index.html'
      const filePath = join(root, url)
      if (!filePath.startsWith(root)) {
        res.writeHead(403).end()
        return
      }
      const data = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': mime[extname(filePath)] ?? 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((res) => server.listen(PORT, '127.0.0.1', () => res()))
  return `http://127.0.0.1:${PORT}`
}

function startElectron(rendererUrl) {
  const electronBin = join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
  const mainJs = join(OUT, 'main', 'index.js')

  console.log('[3/3] starting Electron ...')
  console.log('  electron :', electronBin)
  console.log('  main     :', mainJs)
  console.log('  renderer :', rendererUrl)

  const env = {
    ...process.env,
    ELECTRON_RENDERER_URL: rendererUrl,
    ELECTRON_IS_DEV: '1',
    LABTOOL_V3_DEV: '1'
  }
  const child = spawn(electronBin, [mainJs], { cwd: ROOT, env, stdio: 'inherit' })
  child.on('exit', (code) => {
    console.log(`[electron] exited with code ${code}`)
    process.exit(code ?? 0)
  })
  process.on('SIGINT', () => child.kill('SIGINT'))
  process.on('SIGTERM', () => child.kill('SIGTERM'))
}

;(async () => {
  try {
    await compileNode()
    await bundle()
    const url = await startHttp()
    startElectron(url)
  } catch (e) {
    console.error('FATAL:', e)
    process.exit(1)
  }
})()
