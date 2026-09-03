import { useCallback, useRef } from 'react'
import type { ComposedAuthUseCase } from '../logic/compose-auth-usecase'
import { useAuthForm } from './use-auth-form'

/**
 * 认证提交流程封装
 * @description 统一「校验 → loading → 调用用例 → 错误上屏」的提交编排；
 *              组件经本 hook 暴露的 submit 触发，不直接调用 UseCase（DDD 红线）。
 * @param authUseCase 认证用例（由应用层经 props 注入）
 * @param initialValues 初始表单值
 * @param validate 校验函数
 * @param action 用例动作（登录/注册）
 */
export const useAuthSubmit = <T extends Record<string, string>>(
    authUseCase: ComposedAuthUseCase,
    initialValues: T,
    validate: (values: T) => string | null,
    action: (authUseCase: ComposedAuthUseCase, values: T) => Promise<string | null>
) => {
    const { values, setField, error, setError, loading, setLoading, runValidate } = useAuthForm(
        initialValues,
        validate
    )

    // 同 tick 双提交防护（loading state 需重渲染后才生效，ref 立即可见）
    const inFlightRef = useRef(false)

    /**
     * 提交表单
     * @returns 是否提交成功（成功时调用方自行处理后续，如切页/回填）
     */
    const submit = useCallback(async (): Promise<boolean> => {
        if (loading || inFlightRef.current) return false
        const validateError = runValidate()
        if (validateError !== null) return false
        inFlightRef.current = true
        setLoading(true)
        try {
            const err = await action(authUseCase, values)
            if (err !== null) {
                setError(err)
                return false
            }
            return true
        } finally {
            // 成功/失败/异常均重置：避免 loading 卡死或 in-flight 标志残留
            inFlightRef.current = false
            setLoading(false)
        }
    }, [loading, runValidate, action, authUseCase, values, setError, setLoading])

    return {
        values,
        setField,
        error,
        loading,
        submit
    }
}

/**
 * 登出封装
 * @description 组件经本 hook 暴露的 signOut 触发，不直接调用 UseCase（DDD 红线）。
 *              成功时用例内部完成 clearAuthData，UI 自动切回登录页。
 * @param authUseCase 认证用例
 * @param userToken 当前用户 token
 */
export const useSignOut = (authUseCase: ComposedAuthUseCase, userToken: string) => {
    const signOut = useCallback(() => {
        void authUseCase
            .signOut(userToken)
            .then((err) => {
                if (err !== null) console.error(err)
            })
            .catch((error) => console.error(error))
    }, [authUseCase, userToken])

    return { signOut }
}