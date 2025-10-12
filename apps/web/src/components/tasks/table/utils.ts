import { columnTexts } from '@/stores/tasks/constants'

export const getColumnText = (key: string, replaceText?: string) => {
    const _k = key as keyof typeof columnTexts
    return columnTexts[_k] || replaceText || '无效列名'
}
