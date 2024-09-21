import { useUserStore } from '@/stores'

const userStore = useUserStore()

export const TasksBasicViewContentKey = 'TASKS_BASIC_VIEW_CONTENT'

export const TasksBasicViewContent = {
    all: {
        title: '所有',
        description: '所有板块是专门展示和管理工作所有需要完成的任务的地方。',
        default: {
            viewType: 'table',
            filterInfo: { isDeleted: false }
        }
    },
    today: {
        title: '今日',
        description: '今日板块是专门展示和管理工作当天需要完成的任务的地方。',
        default: {
            viewType: 'table',
            filterInfo: {
                isDeleted: false,
                relativeDate: 'today'
            }
        }
    },
    tomorrow: {
        title: '明日',
        description: '明日板块是专门展示和管理工作明天需要完成的任务的地方。',
        default: {
            viewType: 'table',
            filterInfo: {
                isDeleted: false,
                relativeDate: 'tomorrow'
            }
        }
    },
    week: {
        title: '最近 7 天',
        description: '最近 7 天板块是专门展示和管理工作本周需要完成的任务的地方。',
        default: {
            viewType: 'table',
            filterInfo: {
                isDeleted: false,
                relativeDate: 'week'
            }
        }
    },
    inbox: {
        title: '收集箱',
        description: '收集箱板块是专门展示和管理工作所有需要完成的任务的地方。',
        default: {
            viewType: 'table',
            filterInfo: {
                isDeleted: false,
                projectId: userStore.user!.id
            }
        }
    },
    recycle: {
        title: '垃圾桶',
        description: '垃圾桶板块是专门展示和管理工作所有已经删除的任务的地方。',
        default: {
            viewType: 'table',
            filterInfo: { isDeleted: true }
        }
    }
}
