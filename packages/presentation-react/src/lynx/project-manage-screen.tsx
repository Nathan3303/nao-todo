import { useEffect, useState } from '@lynx-js/react'
import { Button, Input } from '@lynx-js/lynx-ui'
import { useI18n } from '../hooks/use-i18n'
import { useProjectStore } from '../hooks/use-project-store'
import { navCore } from '../logic/nav-core'
import type { TaskApp } from '../hooks/use-task-app'
import { ScreenHeader } from './components/screen-header'
import { PROJECT_COLORS } from './manage-constants'
import './task-ui.css'
import './manage.css'

export type ProjectManageScreenProps = {
    app: TaskApp
}

/**
 * 项目管理屏幕
 * @description 项目列表 + 新建（名称/颜色）+ 软删除/恢复；交互经 projectUseCase（DDD 红线）。
 */
export const ProjectManageScreen = ({ app }: ProjectManageScreenProps) => {
    const { t } = useI18n()
    const { projects } = useProjectStore(app.projectStore)
    const [name, setName] = useState('')
    const [color, setColor] = useState<string>(PROJECT_COLORS[0])
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        void app.projectUseCase.loadProjects()
    }, [app.projectUseCase])

    const active = projects.filter((p) => !p.isDeleted)
    const deleted = projects.filter((p) => p.isDeleted)

    const create = () => {
        const trimmed = name.trim()
        if (trimmed === '') return
        setSubmitting(true)
        void app.projectUseCase
            .createProject({ icon: color, name: trimmed, description: '' })
            .then(() => {
                setName('')
                setSubmitting(false)
            })
    }

    return (
        <view className="ts-screen">
            <view className="ts-glow" />
            <ScreenHeader
                title={t('mobile.project.title')}
                left="back"
                onLeftClick={() => navCore.back()}
            />

            <scroll-view className="ts-scroll" scroll-orientation="vertical">
                <view className="mg-body">
                    {/* 新建 */}
                    <view className="ts-card">
                        <text className="ts-field-label">{t('mobile.project.create')}</text>
                        <view className="mg-row">
                            <Input
                                className="ts-input mg-name-input"
                                value={name}
                                placeholder={t('mobile.project.namePlaceholder')}
                                onInput={(value) => setName(value)}
                            />
                            <Button
                                className="ts-primary-btn mg-add-btn"
                                disabled={submitting}
                                onClick={create}
                            >
                                <text className="ts-primary-btn-text">
                                    {t('mobile.project.create')}
                                </text>
                            </Button>
                        </view>
                        <view className="ts-chips mg-colors">
                            {PROJECT_COLORS.map((item) => (
                                <Button
                                    key={item}
                                    className={`mg-color-dot-wrap${color === item ? ' ui-active' : ''}`}
                                    onClick={() => setColor(item)}
                                >
                                    <view
                                        className="mg-color-dot"
                                        style={{ backgroundColor: item }}
                                    />
                                </Button>
                            ))}
                        </view>
                    </view>

                    {/* 项目列表 */}
                    {active.length === 0 ? (
                        <view className="ts-empty">
                            <text className="ts-empty-text">{t('common.noData')}</text>
                        </view>
                    ) : (
                        <view className="mg-list">
                            {active.map((project) => (
                                <view className="ts-card mg-item" key={project.id}>
                                    <view
                                        className="ts-dot"
                                        style={{ backgroundColor: project.icon }}
                                    />
                                    <text className="mg-item-name">{project.name}</text>
                                    <Button
                                        className="mg-item-btn"
                                        onClick={() => {
                                            void app.projectUseCase.deleteProject(project.id)
                                        }}
                                    >
                                        <text className="mg-item-btn-text">
                                            {t('mobile.project.delete')}
                                        </text>
                                    </Button>
                                </view>
                            ))}
                        </view>
                    )}

                    {/* 已删除 */}
                    {deleted.length > 0 ? (
                        <view className="mg-deleted">
                            <text className="mg-section-title">
                                {t('mobile.project.deletedSection')}
                            </text>
                            {deleted.map((project) => (
                                <view className="ts-card mg-item" key={project.id}>
                                    <view
                                        className="ts-dot"
                                        style={{ backgroundColor: project.icon }}
                                    />
                                    <text className="mg-item-name">{project.name}</text>
                                    <Button
                                        className="mg-item-btn mg-restore"
                                        onClick={() => {
                                            void app.projectUseCase.restoreProject(project.id)
                                        }}
                                    >
                                        <text className="mg-item-btn-text">
                                            {t('mobile.project.restore')}
                                        </text>
                                    </Button>
                                </view>
                            ))}
                        </view>
                    ) : null}
                </view>
            </scroll-view>
        </view>
    )
}