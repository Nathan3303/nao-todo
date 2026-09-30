// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { defineComponent, h, provide } from 'vue'
import { useUserStore } from '@nao-todo/presentation-identity'
import { useTaskDetailsStore } from '../../../stores'
import {
    TASK_DETAILS_CONTEXT_KEY,
    TASK_DETAILS_PRE_CONTEXT_KEY,
    type TaskDetailsContext,
    type TaskDetailsPreContext
} from '../context'
import useComments from '../use-comments'
import DetailsMainComments from '../main/comments.vue'

vi.mock('nue-ui', () => ({ NueMessage: { success: vi.fn(), error: vi.fn() } }))

/**
 * DEF-69 新增评论后用户信息不显示（web / desktop 共用本 presentation 路径）
 * @description 本地优先（W2）下评论由本地仓储写入。若创建时未带上当前用户的昵称/头像，
 *              评论行会立即缺作者信息。用例经真实 `useComments` 创建链路 + 真实评论行组件，
 *              断言「新增一条评论 ⇒ 评论行立即显示当前用户昵称与头像」。
 */
describe('DEF-69 新增评论立即显示当前用户信息', () => {
    let pinia: Pinia
    let wrapper: VueWrapper | null = null

    beforeEach(() => {
        pinia = createPinia()
        setActivePinia(pinia)
    })

    afterEach(() => {
        wrapper?.unmount()
        wrapper = null
        document.body.innerHTML = ''
        vi.clearAllMocks()
    })

    it('创建评论后评论行立即显示当前用户的昵称与头像', async () => {
        const userStore = useUserStore()
        userStore.setUserProfile({
            nickname: '张三',
            avatar: '/static/uploads/avatars/me.png'
        } as never)

        const store = useTaskDetailsStore()
        // 端口替身：与真实 `TaskCommentUseCase.create` 同口径把视图对象落回 store
        const taskCommentUseCase = {
            create: vi.fn(async (createViewObject: Record<string, unknown>) => {
                const id = 'comment-1'
                store.addComment({
                    id,
                    taskId: createViewObject.taskId as string,
                    content: createViewObject.content as string,
                    attachments: [],
                    isTopUp: false,
                    nickname: (createViewObject.nickname as string) ?? '',
                    avatar: (createViewObject.avatar as string) ?? '',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-01T00:00:00Z',
                    deletedAt: null
                })
                store.addCommentId(id)
                return [id, null]
            }),
            list: vi.fn(async () => [[], null]),
            update: vi.fn(async () => null),
            delete: vi.fn(async () => [null, null])
        }

        const Host = defineComponent({
            name: 'CommentAuthorInfoHost',
            setup(_, { expose }) {
                const api = useComments(store)
                provide(TASK_DETAILS_CONTEXT_KEY, {
                    comments: api.comments,
                    commentHandler: api.commentHandler,
                    commentsLoading: api.commentsLoading,
                    commentsError: api.commentsError,
                    retryComments: api.retryComments
                } as unknown as TaskDetailsContext)
                expose({ create: api.commentHandler.create.bind(api.commentHandler) })
                return () => h(DetailsMainComments)
            }
        })

        wrapper = mount(Host, {
            global: {
                plugins: [pinia],
                provide: {
                    [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: {
                        taskCommentUseCase
                    } as unknown as TaskDetailsPreContext
                },
                config: { warnHandler: () => {} }
            }
        })

        const { create } = wrapper.vm as unknown as {
            create: (viewObject: { taskId: string; content: string }) => Promise<unknown>
        }
        const createError = await create({ taskId: 'task-1', content: '你好' })
        expect(createError).toBeNull()
        await flushPromises()

        // 1) 评论数据立即带上作者信息（store 即评论行数据源）
        const comment = store.getComment('comment-1')
        expect(comment?.nickname).toBe('张三')
        expect(comment?.avatar).toContain('/static/uploads/avatars/me.png')

        // 2) 评论行立即渲染出昵称 / 头像
        expect(wrapper.text()).toContain('张三')
        const avatar = wrapper.find('nue-avatar')
        if (avatar.exists()) {
            expect(avatar.attributes('src')).toContain('/static/uploads/avatars/me.png')
        }
    })
})