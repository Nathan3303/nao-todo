/**
 * 雪花 Epoch 初始化
 * @description 登录（JWT 到手）后调用：GET /api/system/config 拉取后端 snowflakeEpoch，
 *              缓存到 localStorage 并配置雪花生成器；失败时静默降级（缓存/默认常量兜底，不阻塞登录）。
 *              认证流程不创建业务实体，无循环依赖（见 data-sync-plan.md §1.4）。
 */
import { getRequesterImpl } from '@nao-todo/shared'
import { getJWTFromLocalStorage } from '../persistence-go/utils'
import { setSnowflakeEpoch } from './sync-config'
import { snowflake } from './snowflake'

interface SystemConfigRes {
    data?: {
        snowflakeEpoch?: string | number
    }
    code?: number
}

/**
 * 拉取并应用后端雪花 Epoch
 * @returns 应用成功返回 epoch（ms），失败返回 null（回退缓存/默认常量）
 */
export const initSnowflakeEpoch = async (): Promise<number | null> => {
    try {
        const response = await getRequesterImpl().get('/system/config', {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        const res = response.data as SystemConfigRes
        const raw = res?.data?.snowflakeEpoch
        const epoch = raw === undefined ? NaN : Number(raw)
        if (Number.isFinite(epoch) && epoch > 0) {
            setSnowflakeEpoch(epoch)
            snowflake.configure(epoch)
            return epoch
        }
    } catch {
        // 网络/鉴权失败：回退缓存或默认常量（getSnowflakeEpoch 兜底），不阻塞登录
    }
    return null
}