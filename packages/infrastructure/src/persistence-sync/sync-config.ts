/**
 * 同步配置访问点
 * @description localStorage 持久化设备级配置（雪花 Epoch、机器位）；
 *              无 localStorage 环境（如测试）防御性降级为默认值/内存值。
 */

/** 雪花 Epoch 常量：2023-03-01T00:00:00Z（ms），与后端 consts.SnowflakeEpochMS 一致 */
export const DEFAULT_SNOWFLAKE_EPOCH = 1677628800000

/** localStorage keys */
export const SNOWFLAKE_EPOCH_KEY = 'snowflakeEpoch'
export const SNOWFLAKE_MACHINE_ID_KEY = 'snowflake-machine-id'
/** 服务器时间偏移（ms）：serverTimeOffset = serverTime - 本地时间，校准 LWW 时间基准 */
export const SERVER_TIME_OFFSET_KEY = 'server-time-offset'

/** 机器位取值范围：设备级持久随机数 ∈ [2, 1023]，避开后端固定 machineID=1 */
export const MACHINE_ID_MIN = 2
export const MACHINE_ID_MAX = 1023

const safeGetItem = (key: string): string | null => {
    try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
    } catch {
        return null
    }
}

const safeSetItem = (key: string, value: string): void => {
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
    } catch {
        // 存储不可用（隐私模式/测试环境）时忽略，回退默认值
    }
}

/** 读取雪花 Epoch（无缓存/非法时回退默认常量） */
export const getSnowflakeEpoch = (): number => {
    const stored = safeGetItem(SNOWFLAKE_EPOCH_KEY)
    if (stored !== null) {
        const value = Number(stored)
        if (Number.isFinite(value) && value > 0) return value
    }
    return DEFAULT_SNOWFLAKE_EPOCH
}

/** 写入雪花 Epoch（登录后拉取 /api/system/config 时调用） */
export const setSnowflakeEpoch = (epoch: number): void => {
    safeSetItem(SNOWFLAKE_EPOCH_KEY, String(epoch))
}

/** 读取服务器时间偏移（无缓存时 0） */
export const getServerTimeOffset = (): number => {
    const stored = safeGetItem(SERVER_TIME_OFFSET_KEY)
    if (stored !== null) {
        const value = Number(stored)
        if (Number.isFinite(value)) return value
    }
    return 0
}

/** 写入服务器时间偏移（同步/checkin 响应带回 serverTime 时校准） */
export const setServerTimeOffset = (offset: number): void => {
    safeSetItem(SERVER_TIME_OFFSET_KEY, String(offset))
}

/**
 * 服务端校准后的当前时间（ISO）
 * @description PS-15：本地业务写的时间基准（实体 `updatedAt` / 删除 `deletedAt`）必须走
 *              服务端校准值（`getServerTimeOffset`，由同步响应 `serverTime` 写入）。
 *              **禁**以裸 `new Date()` 作为 LWW 输入 —— 客户端时钟偏移会直接决定服务端
 *              `DecideUpsert` 的冲突结果（落后 ⇒ 本地写被静默 no-op；超前 ⇒ 覆盖他端较新写）。
 *              服务端仍以 `time.Now()` 为唯一权威（PS-8）。
 */
export const nowCalibratedIso = (): string =>
    new Date(Date.now() + getServerTimeOffset()).toISOString()

/**
 * 获取（或首次创建并持久化）设备级机器位
 * @description 持久随机数 ∈ [MACHINE_ID_MIN, MACHINE_ID_MAX]，避开后端 machineID=1
 */
export const getOrCreateMachineId = (): number => {
    const stored = safeGetItem(SNOWFLAKE_MACHINE_ID_KEY)
    if (stored !== null) {
        const value = Number(stored)
        if (Number.isInteger(value) && value >= MACHINE_ID_MIN && value <= MACHINE_ID_MAX) {
            return value
        }
    }
    const id = MACHINE_ID_MIN + Math.floor(Math.random() * (MACHINE_ID_MAX - MACHINE_ID_MIN + 1))
    safeSetItem(SNOWFLAKE_MACHINE_ID_KEY, String(id))
    return id
}