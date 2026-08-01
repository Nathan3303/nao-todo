import type { Go } from '../types'

export class JsonStringValueObject {
    // JSON 对象
    // 用于存储 JSON 字符串解析后的对象
    // 用于在需要时进行 JSON 操作，如序列化、反序列化等
    // 恒为对象，解析失败时为空对象，避免 null 流入下游
    public value: Record<string, unknown> = {}

    // JSON 字符串构造函数
    // 用于将 JSON 字符串转换为 JSON 对象
    // 用于在需要时进行 JSON 操作，如序列化、反序列化等
    // @param jstring JSON 字符串
    // @returns JSON 对象
    // constructor(public value: string) {
    //     const [res, error] = this.marshall(jstring)
    //     if (error != null) {
    //         throw new Error(unwrapError(error))
    //     }
    //     this.value = res
    // }

    /**
     * 从 JSON 字符串创建 JSON 字符串值对象
     * @param jstring JSON 字符串
     * @returns JSON 字符串值对象
     */
    static CreateByJsonString(jstring: string): JsonStringValueObject {
        const vo = new JsonStringValueObject()
        const [res, error] = vo.marshall(jstring)
        if (error !== null) {
            console.error(error)
        }
        vo.value = res ?? {}
        return vo
    }

    /**
     * 从对象创建 JSON 字符串值对象
     * @param obj 对象
     * @returns JSON 字符串值对象
     */
    static CreateByObject(obj: Record<string, unknown>): JsonStringValueObject {
        const vo = new JsonStringValueObject()
        vo.value = obj
        return vo
    }

    /**
     * 读取值并与兜底对象合并
     * @description 用于列配置这类「必须有完整字段」的场景，
     *              解析结果中缺失的键由 fallback 补齐
     * @param fallback 兜底对象
     * @returns 合并后的对象
     */
    valueOr<T extends Record<string, unknown>>(fallback: T): T {
        return { ...fallback, ...this.value } as T
    }

    /**
     * 解析 JSON 字符串为对象
     * @param ostr JSON 字符串
     * @returns 解析后的对象
     */
    marshall(ostr: string): Go<Record<string, unknown>> {
        try {
            // 空字符串视为空对象，避免污染 value
            if (!ostr) return [{}, '[JsonParser] JSON string is empty.']
            // 解析
            const parsed = JSON.parse(ostr)
            // 判断是否是空对象
            if (Object.keys(parsed).length === 0) {
                return [{}, '[JsonParser] Object length is zero.']
            }
            // 正常返回
            return [parsed, null]
        } catch (err) {
            console.error('[JsonParser]', err)
            return [{}, '[JsonParser] JSON parse failed.']
        }
    }

    /**
     * 反序列化对象为 JSON 字符串
     * @description 反序列化对象为 JSON 字符串，返回 JSON 字符串
     * @returns JSON 字符串
     */
    unmarshal(): string {
        return JSON.stringify(this.value)
    }
}