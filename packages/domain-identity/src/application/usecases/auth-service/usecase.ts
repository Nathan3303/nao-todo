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
import { beginCheckIn, endCheckIn } from '@nao-todo/shared/requester/checkin-window'

/**
 * 检入冲突（`10022`）重试前的去抖窗口（T558 / Issue #260 残余）
 * @description 服务端 CAS 败者拿到 `10022` 时，胜利方的轮换结果可能**尚未落到 store**；
 *              先等一个 ≥300ms 窗口再重读 token，避免拿旧 token 白重试。
 */
const CHECK_IN_CONFLICT_RETRY_DELAY_MS = 300

/** 检入冲突处置阶段（结构化日志 / 可观测导出用） */
export type CheckInConflictPhase = 'abandon-retry' | 'retry-succeeded' | 'retry-conflict'

/**
 * 检入冲突事件（`code` 恒为 `10022`；⛔ 不含完整 token）
 * @description `phase` = 处置阶段；`reason` = 放弃重试的原因；`outcome` = 终态裁决结果；
 *              `snapshot` = token **前缀**（8 字符 + 省略号，空 token 为 `(empty)`）。
 */
export type CheckInConflictEvent = {
    code: number
    phase: CheckInConflictPhase
    snapshot: string
    reason?: 'token-unavailable' | 'token-changed'
    outcome?: 'established' | 'retryable-exit'
}

/** 检入冲突上报器（端侧注入：web/桌面接入 `__NAO_ERROR_LOG__`；移动端不注入 ⇒ 仅 console） */
export type CheckInConflictReporter = (event: CheckInConflictEvent) => void

/** token 只记前缀（避免日志泄漏完整凭据） */
const tokenPrefix = (token: string): string =>
    token.length > 0 ? `${token.slice(0, 8)}…` : '(empty)'

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
        private authStore: AuthStore,
        /** 冲突事件上报器（可选端口：端侧可把同一事件写入 `__NAO_ERROR_LOG__`） */
        private readonly reportConflict?: CheckInConflictReporter
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
        // T558 R1：检入在途窗口 —— 期间其它请求的 10041 由检入结果裁决（不抢跑清凭证）
        beginCheckIn()
        const promise = this.runCheckIn(token).finally(() => {
            // 同 token 在清空前不可能有新条目写入（新调用会 join 本 promise）⇒ 直接删安全
            this.checkInInFlight.delete(token)
            endCheckIn()
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
                return this.resolveCheckInConflict(token, checkInError)
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
     * @description 语义（T558 / arch §7 + T558 R1 终态补洞）：
     *              ① 等 ≥300ms 让并发胜利方的轮换结果落到 store；
     *              ② **重读当前 token**：已变化 ⇒ 放弃重试（胜利方已建立新会话）；
     *                 仍相同 ⇒ 用该 token **直连** `authService.checkIn`（⛔ 不得回调 `this.checkIn`，会自 join 单飞体）；
     *              ③ 任何分支的**终态**都必须是二者之一（禁「静默挂起」第 4 态）——
     *                 `isAuthenticated && token` 成立 ⇒ 返回 `null`（调用方按「进入应用」继续，深链生效）；
     *                 不成立（冷启动未建立会话）⇒ 返回该冲突错误 ⇒ 检入页落**显式可重试出口**。
     *              任何冲突分支都**不** `clearAuthData`、**不**导航、**不**触发凭证失效回调
     *              （`10022` 不是会话失效）。
     * @param token 本次请求使用的 token（快照）
     * @param conflictError 首次冲突错误（终态回传用；`10022`）
     */
    private async resolveCheckInConflict(token: string, conflictError: GoError): GoAsync<void> {
        await new Promise<void>((resolve) => setTimeout(resolve, CHECK_IN_CONFLICT_RETRY_DELAY_MS))
        const currentToken = this.currentToken()
        if (currentToken === null || currentToken !== token) {
            // 快照已过期（store 已被胜利方更新）或无法校验新鲜度 ⇒ 不重试
            const reason = currentToken === null ? 'token-unavailable' : 'token-changed'
            return this.settleCheckInConflict(token, conflictError, 'abandon-retry', { reason })
        }
        const [retrySession, retryError] = await this.authService.checkIn(currentToken)
        if (retryError === null) {
            this.applySession(retrySession)
            this.logCheckInConflict({ phase: 'retry-succeeded', snapshot: tokenPrefix(token) })
            return null
        }
        if (!isRetryableCheckInConflict(retryError)) {
            // 重试后是其他失败：按既有分流（网络类保留认证；真实凭证失效仍清）
            if (isCredentialError(retryError)) {
                this.authStore.clearAuthData()
            }
            return retryError
        }
        return this.settleCheckInConflict(currentToken, retryError, 'retry-conflict')
    }

    /**
     * 冲突终态裁决（T558 R1）
     * @description `isAuthenticated && token` 成立 ⇒ `null`（正常进入应用）；
     *              不成立 ⇒ 原样回传冲突错误（检入页据 `isRetryableCheckInConflict` 落可重试失败态）。
     *              两条分支都**不清凭证、不导航**。
     */
    private settleCheckInConflict(
        token: string,
        conflictError: GoError,
        phase: CheckInConflictPhase,
        extra: Pick<CheckInConflictEvent, 'reason'> = {}
    ): GoError {
        const established = this.hasEstablishedSession()
        this.logCheckInConflict({
            phase,
            snapshot: tokenPrefix(token),
            ...extra,
            outcome: established ? 'established' : 'retryable-exit'
        })
        return established ? null : conflictError
    }

    /** 是否已有可用会话（`isAuthenticated` 且 store 内 token 非空） */
    private hasEstablishedSession(): boolean {
        if (!this.authStore.getIsAuthenticated()) return false
        // 无 token 读取器（移动端端口）⇒ 以 `isAuthenticated` 为准（无法校验 token ⇒ 不阻断既有语义）
        return this.authStore.getUserToken ? this.currentToken() !== null : true
    }

    /** 结构化记录检入冲突（console + 端侧上报器；⛔ 不含完整 token） */
    private logCheckInConflict(fields: Omit<CheckInConflictEvent, 'code'>): void {
        const event: CheckInConflictEvent = { code: CHECK_IN_CONFLICT_CODE, ...fields }
        console.warn('[nao-auth] checkin-conflict', event)
        this.reportConflict?.(event)
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