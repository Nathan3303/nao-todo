import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import { DESKTOP_CSP_POLICY, DESKTOP_CSP_POLICY_DEV } from '../csp-policy'

/**
 * AC12 / C-58 桌面端 `<meta>` CSP 回归
 *
 * @description desktop 生产走 `win.loadFile`（`file://`，无 HTTP 响应头）⇒ CSP 只能落
 *              `<meta http-equiv="Content-Security-Policy">`。本文件逐字断言源
 *              `index.html`（即构建产物）内的策略文本与 `csp-policy.ts` 单一真源一致，
 *              并校验「脚本禁内联/eval」等不可回退项。
 * @see docs/prds/2026-09-23-web-offline-stage1.md（AC12）
 */

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8')

/** 从 `<meta http-equiv="Content-Security-Policy">` 抽取 content（容忍属性顺序与新行） */
const extractCspContent = (source: string): string | null => {
    const metaTag = source.match(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i)
    if (!metaTag) return null
    const content = metaTag[0].match(/\bcontent=(["'])([\s\S]*?)\1/i)
    return content?.[2] ?? null
}

/** 指令 → 值列表 */
const parseDirectives = (policy: string): Record<string, string[]> => {
    const map: Record<string, string[]> = {}
    for (const segment of policy.split(';')) {
        const [name, ...values] = segment.trim().split(/\s+/)
        if (name) map[name] = values
    }
    return map
}

describe('AC12 desktop `<meta>` CSP', () => {
    it('index.html 含生效的 Content-Security-Policy meta，且与策略真源逐字一致', () => {
        const content = extractCspContent(html)
        expect(content).not.toBeNull()
        expect(content).toBe(DESKTOP_CSP_POLICY)
    })

    it('script-src 仅 self（不得含 inline/eval）', () => {
        const directives = parseDirectives(DESKTOP_CSP_POLICY)
        expect(directives['script-src']).toEqual(["'self'"])
    })

    it('style-src 的内联放宽仅限样式（不与 script 混淆）', () => {
        const directives = parseDirectives(DESKTOP_CSP_POLICY)
        expect(directives['style-src']).toContain("'unsafe-inline'")
        expect(directives['script-src']).not.toContain("'unsafe-inline'")
        expect(directives['script-src']).not.toContain("'unsafe-eval'")
    })

    it('固定档位：default-src self / object-src none / base-uri none', () => {
        const directives = parseDirectives(DESKTOP_CSP_POLICY)
        expect(directives['default-src']).toEqual(["'self'"])
        expect(directives['object-src']).toEqual(["'none'"])
        expect(directives['base-uri']).toEqual(["'none'"])
    })

    it('connect-src 覆盖应用生产 API 源（.env.production 的 VITE_BASE_URL）', () => {
        const envProd = readFileSync(new URL('../../../.env.production', import.meta.url), 'utf-8')
        const baseUrl = envProd.match(/^VITE_BASE_URL=(.+)$/m)?.[1]?.trim()
        expect(baseUrl).toBeTruthy()
        const directives = parseDirectives(DESKTOP_CSP_POLICY)
        expect(directives['connect-src']).toContain(baseUrl)
    })

    it('meta 投递下被忽略的指令不得写入（frame-ancestors / report-uri / sandbox）', () => {
        for (const ignored of ['frame-ancestors', 'report-uri', 'sandbox']) {
            expect(DESKTOP_CSP_POLICY).not.toContain(ignored)
        }
    })

    it('dev 策略仅在 connect-src 放宽（HMR ws + 本地 API），其余与生产一致', () => {
        const prod = parseDirectives(DESKTOP_CSP_POLICY)
        const dev = parseDirectives(DESKTOP_CSP_POLICY_DEV)

        expect(dev['connect-src']).toEqual(
            expect.arrayContaining(['ws://localhost:*', 'http://localhost:3302'])
        )
        expect(dev['script-src']).toEqual(prod['script-src'])
        expect(dev['default-src']).toEqual(prod['default-src'])
        expect(dev['object-src']).toEqual(prod['object-src'])
        expect(DESKTOP_CSP_POLICY_DEV).not.toBe(DESKTOP_CSP_POLICY)
    })
})