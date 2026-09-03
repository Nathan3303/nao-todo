import { useCallback, useState } from 'react'

/**
 * 认证表单状态 hook
 * @description 管理表单输入值、校验错误与提交 loading 态。
 *              校验函数由 logic 层提供（validateSignInForm / validateSignUpForm）。
 * @param initialValues 初始表单值
 * @param validate 校验函数
 * @returns 表单状态与控制函数
 */
export const useAuthForm = <T extends Record<string, string>>(
    initialValues: T,
    validate: (values: T) => string | null
) => {
    const [values, setValues] = useState<T>(initialValues)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    /**
     * 更新单个字段
     * @param key 字段名
     * @param value 新值
     */
    const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setValues((prev) => ({ ...prev, [key]: value }))
    }, [])

    /**
     * 执行校验并同步错误状态
     * @returns 错误字符串或 null
     */
    const runValidate = useCallback((): string | null => {
        const err = validate(values)
        setError(err)
        return err
    }, [validate, values])

    return {
        values,
        setField,
        error,
        setError,
        loading,
        setLoading,
        runValidate
    }
}