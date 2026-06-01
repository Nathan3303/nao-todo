import type { ViewAdapterNoTaskError } from '@/layouts/app/view-adapters'

/**
 * 用户清单空状态
 */
export const PROJECT_EMPTY_STATE: ViewAdapterNoTaskError = {
    image: '/images/notaskhere.webp',
    imageSize: '8rem',
    message: 'task.empty.project',
    isShowTaskCreateButton: true
}
