import type { GoAsync, GoError } from '@nao-todo/shared/types'
import type { AuthService, AuthSessionValueObject } from '../../../domain'
import type { AuthStore, SignInViewObject, SignUpViewObject } from '../../viewobjects'
import {
    sessionValueObject2ViewObject,
    signInViewObject2ValueObject,
    signUpViewObject2ValueObject
} from './converters'
import {
    isCredentialError,
    isRetryableCheckInConflict,
    CHECK_IN_CONFLICT_CODE
} from './error-classification'
import { recordCheckInAttempt } from '@nao-todo/shared/session-renewal'

/**
 * 检入冲突（`10022`）重试前的去抖窗口（T558 / Issue #260 残余）
 * @description 服务端 CAS 败者拿到 `10022` 时，胜利方的轮换结果可能**尚未落到 store**；
 *              先等一个 ≥300ms 窗口再重读 token，避免拿旧 token 白重试。
 */
const CHECK_IN_CONFLICT_RETRY_DELAY_MS = 300

/** token 只记前缀（避免日志泄漏完整凭据） */
const tokenPrefix = (token: string): string =>
    token.length > 0 ? `${token.slice(0, 8)}…` : '(empty)'

/** 结构化记录检入冲突（不输出完整 token） */
const logCheckInConflict = (fields: Record<string, unknown>): void => {
    console.warn('[nao-auth] checkin-conflict', { code: CHECK_IN_CONFLICT_CODE, ...fields })
}

/**
 * 认证用例
 * @description 认证用例类，用于处理认证相关的业务逻辑。
 */
export class AuthUseCase {
    /**
     * 检入单飞表（key = token；`finally` 必清；不同 token **不得**合并）
     * @description 同一 token 的并发检入在服务端是 CAS（只许一次换发，败者 `10022`）
     *              ⇒ 客户端必须先合并为一个在途请求（页冷启动 / 续期调度器 / 未来入口全受益）。
     */
    private readonly checkInInFlight = new Map<string, Promise<GoError>>()

    /**
     * 认证用例构造函数
     * @param authService 认证服务
     * @param authStore 认证存储
     */
    constructor(
        private authService: AuthService,
        private authStore: AuthStore
    ) {}

    /**
     * 登录
     * @param signInViewObject 登录视图对象
     * @returns 错误信息或空值
     */
    async signIn(signInViewObject: SignInViewObject): GoAsync<void> {
        const [authSession, signInError] = await this.authService.signIn(
            signInViewObject2ValueObject(signInViewObject)
        )
        if (signInError !== null) {
            return signInError
        }
        // Issue #260 修复①：登录成功即记录 checkin 发起时刻 —— 必须在 `setUserToken` **之前**：
        // store watch 的微任务先于本用例续体执行，晚于 setUserToken 才记录 ⇒ 桌面续期调度器
        // `start()` 的同步段读到 null ⇒ 立即用旧 token 补发 checkin ⇒ 服务端轮换 ⇒
        // 在途 pull/Epoch/导航请求拿 10041 ⇒ 被登出 ⇒ 「登录成功但卡在登录页」。
        recordCheckInAttempt()
        const sessionViewObject = sessionValueObject2ViewObject(authSession)
        this.authStore.setIsAuthenticated(true)
        this.authStore.setUserToken(sessionViewObject.token)
        this.authStore.setUserDeletion({
            isPending: sessionViewObject.isPending,
            deadline: sessionViewObject.deadline
        })
        return null
    }

    /**
     * 注册
     * @param signUpViewObject 注册视图对象
     * @returns 错误信息或空值
     */
    async signUp(signUpViewObject: SignUpViewObject): GoAsync<void> {
        const signUpError = await this.authService.signUp(
            signUpViewObject2ValueObject(signUpViewObject)
        )
        if (signUpError !== null) {
            return signUpError
        }
        return null
    }

    /**
     * 检查登录状态（检入）
     * @description **按 token 单飞**：同一 token 的并发调用共享同一个在途请求与结果；
     *              `finally` 必清（失败也清，允许下一次重试）；不同 token 互不合并。
     *              `10022`（检入冲突-可重试）在本体内垂直处理，见 `runCheckIn`。
     * @param token 用户凭据
     * @returns 错误信息或空值
     */
    checkIn(token: string): GoAsync<void> {
        const inFlight = this.checkInInFlight.get(token)
        if (inFlight) return inFlight
        const promise = this.runCheckIn(token).finally(() => {
            // 同 token 在清空前不可能有新条目写入（新调用会 join 本 promise）⇒ 直接删安全
            this.checkInInFlight.delete(token)
        })
        this.checkInInFlight.set(token, promise)
        return promise
    }

    /**
     * 检入本体（在单飞体内执行；**重试也必须在本体内**直连 `authService`）
     * @param token 本次请求使用的 token（快照）
     */
    private async runCheckIn(token: string): GoAsync<void> {
        const [authSession, checkInError] = await this.authService.checkIn(token)
        if (checkInError !== null) {
            // T558：`10022` = 冲突-可重试（服务端 CAS）⇒ 先降级处置，**不得**按凭证失效清认证。
            // ⚠️ 仅限「带 token 的检入」：空 token 的失败不可能是「被并发换掉」⇒ 仍走既有 fail-closed。
            if (token && isRetryableCheckInConflict(checkInError)) {
                return this.resolveCheckInConflict(token)
            }
            // 失败分流（DEF-5 / AC7）：仅凭证类失败清认证；网络类/未知失败保留 JWT 与设备标识，允许重试
            if (isCredentialError(checkInError)) {
                this.authStore.clearAuthData()
            }
            return checkInError
        }
        this.applySession(authSession)
        return null
    }

    /**
     * 处置检入冲突（`10022`）—— 不判凭证失效，最多去抖重试 1 次
     * @description 语义（T558 / arch §7）：
     *              ① 等 ≥300ms 让并发胜利方的轮换结果落到 store；
     *              ② **重读当前 token**：已变化 ⇒ 放弃重试（胜利方已建立新会话），保持认证；
     *                 仍相同 ⇒ 用该 token **直连** `authService.checkIn`（⛔ 不得回调 `this.checkIn`，会自 join 单飞体）；
     *              ③ 重试后仍 `10022` ⇒ 静默结束 + **保持认证** + 结构化记录（token 只记前缀）。
     *              任何冲突分支都**不** `clearAuthData`、**不**导航、**不**触发凭证失效回调
     *              ⇒ 返回 `null`（调用方按「保持认证」继续，不回登录页）。
     * @param token 本次请求使用的 token（快照）
     */
    private async resolveCheckInConflict(token: string): GoAsync<void> {
        await new Promise<void>((resolve) => setTimeout(resolve, CHECK_IN_CONFLICT_RETRY_DELAY_MS))
        const currentToken = this.currentToken()
        if (currentToken === null || currentToken !== token) {
            // 快照已过期（store 已被胜利方更新）或无法校验新鲜度 ⇒ 不重试，保持认证
            logCheckInConflict({
                phase: 'abandon-retry',
                reason: currentToken === null ? 'token-unavailable' : 'token-changed',
                snapshot: tokenPrefix(token)
            })
            return null
        }
        const [retrySession, retryError] = await this.authService.checkIn(currentToken)
        if (retryError === null) {
            this.applySession(retrySession)
            logCheckInConflict({ phase: 'retry-succeeded', snapshot: tokenPrefix(token) })
            return null
        }
        if (!isRetryableCheckInConflict(retryError)) {
            // 重试后是其他失败：按既有分流（网络类保留认证；真实凭证失效仍清）
            if (isCredentialError(retryError)) {
                this.authStore.clearAuthData()
            }
            return retryError
        }
        logCheckInConflict({ phase: 'retry-conflict', snapshot: tokenPrefix(currentToken) })
        return null
    }

    /** 应用已换发的会话（成功路径 / 冲突重试成功共用） */
    private applySession(authSession: AuthSessionValueObject): void {
        const sessionViewObject = sessionValueObject2ViewObject(authSession)
        this.authStore.setIsAuthenticated(true)
        this.authStore.setUserToken(authSession.jwt)
        this.authStore.setUserDeletion({
            isPending: sessionViewObject.isPending,
            deadline: sessionViewObject.deadline
        })
    }

    /** 读取 store 中的当前 token（未提供读取能力 ⇒ `null` = 无法校验新鲜度） */
    private currentToken(): string | null {
        const token = this.authStore.getUserToken?.()
        return token ? token : null
    }

    /**
     * 退出登录
     * @param token 用户凭据
     * @returns 错误信息或空值
     */
    async signOut(token: string): GoAsync<void> {
        const signOutError = await this.authService.signOut(token)
        if (signOutError !== null) {
            return signOutError
        }
        this.authStore.clearAuthData()
        return null
    }
}