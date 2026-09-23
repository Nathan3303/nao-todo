import { isCredentialError } from '@nao-todo/domain-identity'
import type { GoError } from '@nao-todo/shared/types'

/**
 * 远端优先 + 网络类失败回退本地镜像（C-66 / AC8）
 * @description 阶段一「只读离线镜像」的读路径装饰器：远端仓储为**主读**，
 *              仅当远端调用**抛出**（transport / HTTP 失败）且**非凭证类**失败时，
 *              改由同接口的本地镜像仓储读取（`mirrorPulledAt` / `mirrorTruncated` 由
 *              `syncStatus` 暴露给 UI，C-60）。
 *
 *              设计要点：
 *              - **只包装读方法**（`readMethods`）；写方法一律透传远端 ⇒ 阶段一
 *                **数据面不产生 `markDirty`**（C-59）。
 *              - 远端**业务失败**（返回 `[null, message]`）**不触发回退** —— 远端已应答，
 *                其结果为权威（镜像可能过期）；只有抛错（无应答）才回退。
 *              - **凭证类失败必须上抛**（`isCredentialError`，与 T102/DEF-5 同源）：
 *                会话失效须回登录页，不得用镜像掩盖。
 *
 * @param remote 远端仓储（主读）
 * @param mirror 本地镜像仓储（同接口；仅读方法会被调用）
 * @param readMethods 需要回退的读方法名（写方法不列入）
 */
export const withMirrorFallback = <T extends object>(
    remote: T,
    mirror: T,
    readMethods: readonly (keyof T)[]
): T => {
    const reads = new Set<string>(readMethods.map((name) => String(name)))
    const mirrorMethods = mirror as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
    >

    return new Proxy(remote, {
        get(target, property) {
            const value = Reflect.get(target, property, target) as unknown
            if (typeof value !== 'function') return value

            const name = String(property)
            // 写路径（含未列入的读方法）：原样委托远端，保持既有行为
            if (!reads.has(name)) return (value as (...args: unknown[]) => unknown).bind(target)

            return async (...args: unknown[]): Promise<unknown> => {
                try {
                    return await (value as (...args: unknown[]) => Promise<unknown>).apply(
                        target,
                        args
                    )
                } catch (err) {
                    if (isCredentialError(err as GoError)) throw err
                    return await mirrorMethods[name]!(...args)
                }
            }
        }
    })
}