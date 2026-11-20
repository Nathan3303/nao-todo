/**
 * Vitest 全局 setup（`vite.config.ts` 的 `test.setupFiles` 引用，每个测试文件加载前执行）。
 *
 * 为什么需要它：Node ≥ 26 在 `globalThis` 上暴露 Web Storage 访问器（未传 `--localstorage-file`
 * 时其值为 `undefined` 并打印 ExperimentalWarning）。vitest 的 jsdom 环境把 `window` 的属性
 * 搬到 `global` 时会跳过「`global` 上已存在」的键 ⇒ `localStorage` 不再被注入，依赖它的用例
 * 拿到 `undefined`（实测 Node 26.12.1：95 文件 / 597 例失败；Node 24.22.1：0 红）。
 *
 * 处理原则：
 * 1. 只在「DOM 环境（有 `window`）里拿不到可用 localStorage」时补齐；纯 Node 环境不注入
 *    （保持「Node 环境无 localStorage」的原语义）。
 * 2. jsdom 已正常注入时**不覆盖**（`ensureLocalStorage()` 返回 `false` 即未改动）。
 * 3. 补齐的实现**继承 `Storage.prototype`**，并把内存方法装在 `Storage.prototype` 上（仅在该
 *    兜底环境发生）⇒ `instanceof Storage` 成立，且全仓惯用的 `vi.spyOn(Storage.prototype, …)`
 *    （模拟存储故障）依然生效，不会出现「spy 无效 ⇒ 假绿/假红」。
 *
 * 本仓要求的 Node 版本见 `.node-version`（与 `package.json` 的 `engines.node`、CI 一致）。
 */

/** 兜底 Storage 的按实例状态（方法挂在原型上，状态不能挂在实例的自有属性里）。 */
const entriesOf = new WeakMap<object, Map<string, string>>()

const entriesFor = (self: object): Map<string, string> => {
    let entries = entriesOf.get(self)
    if (!entries) {
        entries = new Map()
        entriesOf.set(self, entries)
    }
    return entries
}

/** 与浏览器 `Storage` 语义一致的内存实现（方法集，供装到原型或普通对象上）。 */
const memoryStorageDescriptors: PropertyDescriptorMap = {
    length: {
        configurable: true,
        get(this: object): number {
            return entriesFor(this).size
        }
    },
    clear: {
        configurable: true,
        writable: true,
        value(this: object): void {
            entriesFor(this).clear()
        }
    },
    getItem: {
        configurable: true,
        writable: true,
        value(this: object, key: string): string | null {
            return entriesFor(this).get(String(key)) ?? null
        }
    },
    key: {
        configurable: true,
        writable: true,
        value(this: object, index: number): string | null {
            return [...entriesFor(this).keys()][index] ?? null
        }
    },
    removeItem: {
        configurable: true,
        writable: true,
        value(this: object, key: string): void {
            entriesFor(this).delete(String(key))
        }
    },
    setItem: {
        configurable: true,
        writable: true,
        value(this: object, key: string, value: string): void {
            entriesFor(this).set(String(key), String(value))
        }
    }
}

const createMemoryStorage = (): Storage => {
    if (typeof Storage === 'function') {
        Object.defineProperties(Storage.prototype, memoryStorageDescriptors)
        return Object.create(Storage.prototype) as Storage
    }

    return Object.defineProperties({} as Storage, memoryStorageDescriptors) as Storage
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
 * 在 `scope` 上补齐 `localStorage`（仅 DOM 环境）。
 *
 * @returns `true` = 本次注入了兜底实现；`false` = 已有可用实现或非 DOM 环境，未做任何改动。
 */
export const ensureLocalStorage = (scope: typeof globalThis = globalThis): boolean => {
    if (hasUsableLocalStorage(scope)) return false

    const win = (scope as { window?: unknown }).window
    if (!win) return false

    Object.defineProperty(scope, 'localStorage', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: createMemoryStorage()
    })

    return true
}

ensureLocalStorage()