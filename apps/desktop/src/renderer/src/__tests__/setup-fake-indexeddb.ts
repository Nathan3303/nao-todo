/**
 * 测试专用 IndexedDB shim（非用例；必须**最先 import**）
 *
 * @description
 * ① `fake-indexeddb` 是 `@nao-todo/infrastructure` 的 devDependency（pnpm 严格 node_modules）
 *    ⇒ apps 侧无法用 bare specifier 解析，且跨包相对 import 会触 `TS6307`
 *    （不在 apps tsconfig 文件列表）⇒ 以 `vp test` 的 cwd（仓库根）定位 infra 包后 `require`。
 * ② `fake-indexeddb/auto` 在 jsdom 下只挂到 `window`，而 vitest 的 `globalThis` 与 jsdom `window`
 *    **非同一对象** ⇒ 显式桥接到 `globalThis`。
 * ③ **Dexie 在模块加载时即捕获 `indexedDB`** ⇒ 本模块必须早于任何 `@nao-todo/infrastructure`
 *    的导入（含间接导入）执行，故在用例中以**第一条 import** 引入。
 */
import { createRequire } from 'node:module'
import { resolve as resolvePath } from 'node:path'

const infraRequire = createRequire(
    resolvePath(process.cwd(), 'packages/infrastructure/package.json')
)
infraRequire(infraRequire.resolve('fake-indexeddb/auto'))

const GLOBAL_KEYS = [
    'indexedDB',
    'IDBCursor',
    'IDBCursorWithValue',
    'IDBDatabase',
    'IDBFactory',
    'IDBIndex',
    'IDBKeyRange',
    'IDBObjectStore',
    'IDBOpenDBRequest',
    'IDBRecord',
    'IDBRequest',
    'IDBTransaction',
    'IDBVersionChangeEvent'
] as const

const g = globalThis as unknown as Record<string, unknown> & { window?: Record<string, unknown> }
const source = (g.window ?? g) as Record<string, unknown>

for (const key of GLOBAL_KEYS) {
    if (g[key] === undefined && source[key] !== undefined) {
        Object.defineProperty(g, key, { value: source[key], configurable: true, writable: true })
    }
}