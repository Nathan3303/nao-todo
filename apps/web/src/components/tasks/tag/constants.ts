import type { ViewAdapterNoTaskError } from '@nao-todo/presentation/task'

/**
 * 用户清单空状态
 */
export const TAG_EMPTY_STATE: ViewAdapterNoTaskError = {
    image: '/images/notaskhere.webp',
    imageSize: '8rem',
    message: 'task.empty.tag',
    isShowTaskCreateButton: true
}