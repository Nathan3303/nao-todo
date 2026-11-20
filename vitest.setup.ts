/**
 * Vitest 全局 setup（`vite.config.ts` 的 `test.setupFiles` 引用，每个测试文件加载前执行）。
 *
 * 为什么需要它：Node ≥ 26 在 `globalThis` 上暴露 Web Storage 访问器（未传 `--localstorage-file`
 * 时其值为 `undefined` 并打印 ExperimentalWarning）。vitest 的 jsdom 环境把 `window` 的属性
 * 搬到 `global` 时会跳过「`global` 上已存在」的键 ⇒ `localStorage` 不再被注入，依赖它的用例
 * 拿到 `undefined`（实测 Node 26.12.1：95 文件 / 597 例失败；Node 24.22.1：0 红）。
 *
 * 处理原则：只在「拿不到可用 localStorage」时补一个内存实现；jsdom 已正常注入时**不覆盖**
 * （`ensureLocalStorage()` 返回 `false` 即未改动）。这样两种 Node 大版本下的用例判据一致，
 * 也不要求所有人额外带 `NODE_OPTIONS=--no-experimental-webstorage`。
 *
 * 本仓要求的 Node 版本见 `.node-version`（与 `package.json` 的 `engines.node`、CI 一致）。
 */

/** 与浏览器 Storage 语义一致的内存实现（jsdom 未注入时兜底）。 */
const createMemoryStorage = (): Storage => {
    const entries = new Map<string, string>()

    return {
        get length(): number {
            return entries.size
        },
        clear: (): void => {
            entries.clear()
        },
        getItem: (key: string): string | null => entries.get(String(key)) ?? null,
        key: (index: number): string | null => [...entries.keys()][index] ?? null,
        removeItem: (key: string): void => {
            entries.delete(String(key))
        },
        setItem: (key: string, value: string): void => {
            entries.set(String(key), String(value))
        }
    }
}

/** 探测「可用」而非「存在」：Node 26 上该属性存在但为 undefined（甚至访问即抛错）。 */
const hasUsableLocalStorage = (scope: typeof globalThis): boolean => {
    try {
        return typeof scope.localStorage?.getItem === 'function'
    } catch {
        return false
    }
}

/**
 * 在 `scope` 上补齐 `localStorage`。
 *
 * @returns `true` = 本次注入了兜底实现；`false` = 已有可用实现，未做任何改动。
 */
export const ensureLocalStorage = (scope: typeof globalThis = globalThis): boolean => {
    if (hasUsableLocalStorage(scope)) return false

    Object.defineProperty(scope, 'localStorage', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: createMemoryStorage()
    })

    return true
}

ensureLocalStorage()