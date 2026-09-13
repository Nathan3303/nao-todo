import { ref } from 'vue'
import {
    addSearchHistory,
    clearSearchHistory,
    readSearchHistory,
    removeSearchHistory
} from './search-history'

/**
 * 搜索历史组合式（SEA-04 / S6）
 * @description 视图侧唯一入口：持有响应式历史列表，仓储式读写收敛在纯层
 *              （localStorage 容错在 search-history.ts）。空词态展示、点选复用、
 *              单条/全部清除均由本组合式驱动。
 */
export const useSearchHistory = () => {
    const history = ref<string[]>(readSearchHistory())

    /** 记录一次有效回找（D3：点击结果进入详情时调用） */
    const record = (keyword: string): void => {
        history.value = addSearchHistory(keyword)
    }

    /** 移除单条 */
    const remove = (keyword: string): void => {
        history.value = removeSearchHistory(keyword)
    }

    /** 清空全部 */
    const clear = (): void => {
        history.value = clearSearchHistory()
    }

    return { history, record, remove, clear }
}