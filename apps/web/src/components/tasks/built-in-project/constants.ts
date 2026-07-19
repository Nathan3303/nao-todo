import type { ViewAdapterNoTaskError } from '@nao-todo/domain/task'

/**
 * 内建清单空状态映射
 * @description 根据内建清单 ID 返回对应的空状态配置
 */
export const BUILT_IN_EMPTY_STATE_MAP: Record<string, ViewAdapterNoTaskError> = {
    all: {
        image: '/images/notaskhere.webp',
        imageSize: '8rem',
        message: 'task.empty.all',
        isShowTaskCreateButton: true
    },
    today: {
        image: '/images/coffee.webp',
        imageSize: '8rem',
        message: 'task.empty.today',
        isShowTaskCreateButton: true
    },
    tomorrow: {
        image: '/images/plan.webp',
        imageSize: '8rem',
        message: 'task.empty.tomorrow',
        isShowTaskCreateButton: true
    },
    week: {
        image: '/images/plan2.webp',
        imageSize: '8rem',
        message: 'task.empty.week',
        isShowTaskCreateButton: true
    },
    inbox: {
        image: '/images/category.webp',
        imageSize: '8rem',
        message: 'task.empty.inbox',
        isShowTaskCreateButton: true
    },
    favourite: {
        image: '/images/notaskhere.webp',
        imageSize: '8rem',
        message: 'task.empty.favourite',
        isShowTaskCreateButton: false
    },
    deleted: {
        image: '/images/notaskhere.webp',
        imageSize: '8rem',
        message: 'task.empty.deleted',
        isShowTaskCreateButton: false
    },
    overdue: {
        image: '/images/coffee.webp',
        imageSize: '8rem',
        message: 'task.empty.overdue',
        isShowTaskCreateButton: false
    },
    givenup: {
        image: '/images/notaskhere.webp',
        imageSize: '8rem',
        message: 'task.empty.givenup',
        isShowTaskCreateButton: false
    }
}
