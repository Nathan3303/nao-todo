/**
 * 应用配置核心（Lynx 端全局配置）
 * @description App 入口启动时注入（如 API_BASE_URL）；纯 TS 深路径，无框架依赖。
 */

/** 应用配置 */
export type AppConfig = {
    /** API 基础地址（用于拼接相对路径资源，如头像） */
    apiBaseURL: string
}

let appConfig: AppConfig = { apiBaseURL: '' }

/** 注入配置（App 入口调用一次） */
export const setAppConfig = (config: AppConfig): void => {
    appConfig = config
}

/** 读取配置 */
export const getAppConfig = (): AppConfig => appConfig

/** 读取 API 基础地址 */
export const getApiBaseURL = (): string => appConfig.apiBaseURL