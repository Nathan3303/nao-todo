import {
    LANGUAGE_KEY,
    THEME_MODE_KEY,
    USER_JWT_LOCALSTORAGE_KEY,
    USER_PROFILE_CACHE_KEY
} from '@nao-todo/domain-identity'
import { PLAINTEXT_NOTICE_ACK_KEY } from '@nao-todo/shared/constants/storage-keys'
import {
    SERVER_TIME_OFFSET_KEY,
    SNOWFLAKE_EPOCH_KEY,
    SNOWFLAKE_MACHINE_ID_KEY
} from '../../persistence-sync/sync-config'

/**
 * 登出 / 注销到期 / 切换账号清库的 localStorage 黑白名单（C-52 / K10）
 *
 * 两类必须分开标注（PM [T106] Q2 条件 4）：
 * - **设备级（保留）**：设备标识与设备/应用级配置，属「同一设备」而非「某一账号」；
 * - **身份/会话级（必清）**：身份凭据、用户偏好快照、业务/布局状态。
 *
 * 实现采用**设备级白名单驱动**：白名单外的键一律 `removeItem`（含未登记的新业务键），
 * 以保证 AC5「localStorage 业务键全部清空」；下面的显式黑名单常量用于审计与测试断言。
 */

/** 设备级 localStorage 键（**保留**） */
export const DEVICE_LEVEL_STORAGE_KEYS: readonly string[] = [
    // 设备 ID（DEF-14 实测依据：误清 ⇒ 设备漂移 + 服务端「同设备覆盖旧会话」失效 ⇒ user_sessions 膨胀）
    'nao.deviceId',
    // 主题
    THEME_MODE_KEY,
    // 语言
    LANGUAGE_KEY,
    // 雪花 Epoch（设备级配置）
    SNOWFLAKE_EPOCH_KEY,
    // 雪花机器位（设备级持久随机数）
    SNOWFLAKE_MACHINE_ID_KEY,
    // 服务器时间偏移（设备级时间基准校准）
    SERVER_TIME_OFFSET_KEY,
    // 明文姿态「首次进入」告知已读标记（设备级；单一真源见 @nao-todo/shared 的 PLAINTEXT_NOTICE_ACK_KEY）
    PLAINTEXT_NOTICE_ACK_KEY
]

/** 身份/会话级 localStorage 键（**必清**，精确键） */
export const USER_SCOPED_STORAGE_KEYS: readonly string[] = [
    // 用户 JWT
    USER_JWT_LOCALSTORAGE_KEY,
    // 离线身份缓存（昵称）
    USER_PROFILE_CACHE_KEY,
    // 注销反悔确认标记
    'USER_CONFIRM_UNRESTORE',
    // 番茄钟计时快照
    'POMODORO_TIMER_SNAPSHOT',
    // 番茄钟专注快照
    'POMODORO_FOCUS_SNAPSHOT',
    // 番茄钟设置
    'POMODORO_SETTINGS',
    // 侧边栏宽度（`useAsideWidth` 默认 storageKey）
    'ASIDE_WIDTH',
    // 日历周起始（TASK-26 / PS-6：设备级 → 用户级；登出即清，切换账号不串号）
    'CALENDAR_WEEKSTART',
    // 上次访问路由（按用户）
    'LAST_VISITED_ROUTE',
    // tasks 分区上次路由
    'LAST_TASKS_ROUTE',
    // calendar 分区上次路由
    'LAST_CALENDAR_ROUTE'
]

/** 身份/会话级 localStorage 键前缀（**必清**，前缀匹配） */
export const USER_SCOPED_STORAGE_KEY_PREFIXES: readonly string[] = [
    // 表格列配置（`getStorageKey(tableId)` = `TABLE_CONFIG_${tableId}`）
    'TABLE_CONFIG_'
]

/** 枚举当前 localStorage 的全部键（不可用环境返回空数组） */
const listStorageKeys = (): string[] => {
    if (typeof localStorage === 'undefined') return []
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key) keys.push(key)
    }
    return keys
}

/**
 * 「当前会话凭据」键（**补清语境**必留，C-52 / r11）
 * @description `resumePendingWipe` 补的是**上一次登出**的收尾（C-53）；若其间用户已重新
 *              登录（同账号重登，或共享设备上另一账号登录），当前会话凭据**不得**被该次补清删除
 *              —— 否则补清反噬可用性（DEF-34）。
 *              `USER_PROFILE_CACHE_KEY` 由 `readCachedNickname` 按 `userId` 自校验 ⇒ 保留无串号风险。
 */
export const ACTIVE_SESSION_CREDENTIAL_KEYS: readonly string[] = [
    USER_JWT_LOCALSTORAGE_KEY,
    USER_PROFILE_CACHE_KEY
]

/** `clearUserScopedLocalStorage` 选项（清库语境，C-52 / r11） */
export type ClearUserScopedStorageOptions = {
    /**
     * 补清语境（C-53 / r11，DEF-34）：`true` ⇒ 设备级白名单 + **当前会话凭据键**保留，其余按键清除。
     * 默认 `false` = **终结会话语境**（C-52 逐字不变：凭据键必清）。
     */
    preserveActiveSessionCredentials?: boolean
}

/**
 * 按键清除身份/会话级 localStorage（C-52：**禁** `localStorage.clear()`）
 * @description 登出 / 注销到期 / 切换账号 / **补清**（C-53）共用（由 `deletionService.wipeUserData` 调用）。
 *              设备级白名单键保留；其余（含未登记业务键）一律清除。
 *              补清语境（`preserveActiveSessionCredentials: true`）额外保留当前会话凭据键（r11）。
 */
export const clearUserScopedLocalStorage = (options: ClearUserScopedStorageOptions = {}): void => {
    if (typeof localStorage === 'undefined') return
    const preserveActiveSessionCredentials = options.preserveActiveSessionCredentials === true
    for (const key of listStorageKeys()) {
        if (DEVICE_LEVEL_STORAGE_KEYS.includes(key)) continue
        if (preserveActiveSessionCredentials && ACTIVE_SESSION_CREDENTIAL_KEYS.includes(key))
            continue
        localStorage.removeItem(key)
    }
}