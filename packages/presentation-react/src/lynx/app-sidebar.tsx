import { useSyncExternalStore } from '@lynx-js/react'
import { Button } from '@lynx-js/lynx-ui'
import type { UserViewObject } from '@nao-todo/domain-identity/src/application/viewobjects'
import { useBuiltInProjectStore } from '../hooks/use-built-in-project-store'
import { useI18n } from '../hooks/use-i18n'
import { useNav } from '../hooks/use-nav'
import { useProjectStore } from '../hooks/use-project-store'
import { useTagStore } from '../hooks/use-tag-store'
import { useSafeArea } from '../hooks/use-safe-area'
import { getAuthToken } from '../logic/auth-token-core'
import { navCore } from '../logic/nav-core'
import type { TaskApp } from '../hooks/use-task-app'
import { UserAvatar } from './components/user-avatar'
import './task-ui.css'
import './app-sidebar.css'

export type AppSidebarProps = {
    app: TaskApp
    open: boolean
    onClose: () => void
}

/**
 * 应用侧边栏抽屉
 * @description 对齐 Web 端 FloatAppAside 三段布局：
 *              顶部用户区（头像 + 昵称）→ 中部子页链接（内建清单 / 项目 / 标签）→ 底部页面切换（任务 / 设置）。
 *              当前路由高亮；点击链接后替换/入栈导航并收起抽屉。
 */
export const AppSidebar = ({ app, open, onClose }: AppSidebarProps) => {
    const { t } = useI18n()
    const route = useNav()
    const { builtInProjects } = useBuiltInProjectStore(app.builtInProjectStore)
    const { projects } = useProjectStore(app.projectStore)
    const { tags } = useTagStore(app.tagStore)
    const { top: safeTop } = useSafeArea()
    const profile = useSyncExternalStore<UserViewObject | undefined>(
        app.authStore.subscribe,
        app.authStore.getUserProfile
    )

    const { screen, params } = route
    const { builtinId, projectId, tagId } = params
    const nickname = profile?.nickname || 'NaoTodo'
    const email = profile?.email ?? ''

    const navigateList = (params: Record<string, string | undefined>) => {
        navCore.replace('task-list', params)
        onClose()
    }

    const activeProjects = projects.filter((p) => !p.isDeleted)

    return (
        <view className={`sb-root${open ? ' open' : ''}`}>
            {/* 遮罩 */}
            <view className="sb-backdrop" bindtap={onClose} />
            {/* 抽屉面板 */}
            <view className="sb-panel">
                {safeTop > 0 ? (
                    <view className="sb-safe-top" style={{ height: `${safeTop}rpx` }} />
                ) : null}
                {/* 顶部：用户区 */}
                <view className="sb-profile">
                    <UserAvatar
                        avatar={profile?.avatar ?? ''}
                        nickname={nickname}
                        token={getAuthToken()}
                        size={88}
                    />
                    <view className="sb-profile-info">
                        <text className="sb-nickname">{nickname}</text>
                        {email !== '' ? <text className="sb-email">{email}</text> : null}
                    </view>
                </view>

                {/* 中部：子页链接 */}
                <scroll-view className="sb-scroll" scroll-orientation="vertical">
                    <text className="sb-section-title">{t('mobile.sidebar.lists')}</text>
                    {builtInProjects.map((item) => (
                        <Button
                            key={item.id}
                            className={`sb-link${screen === 'task-list' && builtinId === item.id ? ' active' : ''}`}
                            onClick={() => navigateList({ builtinId: item.id })}
                        >
                            <text className="sb-link-text">{item.name}</text>
                        </Button>
                    ))}

                    <text className="sb-section-title">{t('mobile.sidebar.projects')}</text>
                    {activeProjects.length === 0 ? (
                        <text className="sb-empty-tip">{t('common.noData')}</text>
                    ) : (
                        activeProjects.map((project) => (
                            <Button
                                key={project.id}
                                className={`sb-link${screen === 'task-list' && projectId === project.id ? ' active' : ''}`}
                                onClick={() => navigateList({ projectId: project.id })}
                            >
                                <view
                                    className="ts-dot"
                                    style={{ backgroundColor: project.icon }}
                                />
                                <text className="sb-link-text">{project.name}</text>
                            </Button>
                        ))
                    )}
                    <Button
                        className="sb-link sb-manage"
                        onClick={() => {
                            navCore.push('project-manage')
                            onClose()
                        }}
                    >
                        <text className="sb-link-text">{t('mobile.sidebar.manageProjects')}</text>
                    </Button>

                    <text className="sb-section-title">{t('mobile.sidebar.tags')}</text>
                    {tags.length === 0 ? (
                        <text className="sb-empty-tip">{t('common.noData')}</text>
                    ) : (
                        tags.map((tag) => (
                            <Button
                                key={tag.id}
                                className={`sb-link${screen === 'task-list' && tagId === tag.id ? ' active' : ''}`}
                                onClick={() => navigateList({ tagId: tag.id })}
                            >
                                <view className="ts-dot" style={{ backgroundColor: tag.color }} />
                                <text className="sb-link-text">{tag.name}</text>
                            </Button>
                        ))
                    )}
                    <Button
                        className="sb-link sb-manage"
                        onClick={() => {
                            navCore.push('tag-manage')
                            onClose()
                        }}
                    >
                        <text className="sb-link-text">{t('mobile.sidebar.manageTags')}</text>
                    </Button>
                </scroll-view>

                {/* 底部：页面切换 */}
                <view className="sb-footer">
                    <Button
                        className={`sb-footer-link${screen === 'task-list' ? ' active' : ''}`}
                        onClick={() => navigateList({ builtinId: 'today' })}
                    >
                        <text className="sb-footer-text">{t('nav.tasks')}</text>
                    </Button>
                    <Button
                        className={`sb-footer-link${screen === 'settings' ? ' active' : ''}`}
                        onClick={() => {
                            navCore.replace('settings')
                            onClose()
                        }}
                    >
                        <text className="sb-footer-text">{t('nav.settings')}</text>
                    </Button>
                </view>
            </view>
        </view>
    )
}