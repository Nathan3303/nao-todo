/**
 * DDD 红线守卫（领域隔离）
 * @description 校验 packages/domain-* 下源码满足：
 *  1. 不通过 '@nao-todo/shared' 根桶导入（根桶再导出 requester/axios 等传输实现）——
 *     领域/应用层只能引用纯子路径（types/constants/valueobjects/entity 等）；
 *  2. 不残留 'ResponseDataPagination'（传输信封命名）—— 一律使用中立 Pagination。
 * 用途：CI / 提交前手动跑 `pnpm guard:ddd`。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import process from 'node:process'
import { join } from 'node:path'

const roots = readdirSync('packages')
    .filter((name) => name.startsWith('domain-'))
    .map((name) => join('packages', name, 'src'))

const files = []
const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry)
        if (statSync(p).isDirectory()) walk(p)
        else if (p.endsWith('.ts')) files.push(p)
    }
}
roots.forEach((r) => (statSync(r).isDirectory() ? walk(r) : null))

const offenders = []
for (const f of files) {
    if (f.includes('__tests__')) continue
    const text = readFileSync(f, 'utf8')
    if (/from '@nao-todo\/shared'/.test(text)) offenders.push(`${f}: 根桶导入 '@nao-todo/shared'`)
    if (/\bResponseDataPagination\b/.test(text))
        offenders.push(`${f}: 引用传输信封命名 ResponseDataPagination`)
}

if (offenders.length > 0) {
    console.error('[guard:ddd] 领域隔离红线违反：')
    offenders.forEach((line) => console.error('  - ' + line))
    process.exit(1)
}
console.log('[guard:ddd] OK - domain 包未引用 shared 根桶 / ResponseDataPagination')