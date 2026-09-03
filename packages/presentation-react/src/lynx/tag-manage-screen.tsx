import { useEffect, useState } from '@lynx-js/react'
import { Button, Input } from '@lynx-js/lynx-ui'
import { useI18n } from '../hooks/use-i18n'
import { useTagStore } from '../hooks/use-tag-store'
import { navCore } from '../logic/nav-core'
import type { TaskApp } from '../hooks/use-task-app'
import { ScreenHeader } from './components/screen-header'
import { TAG_COLORS } from './manage-constants'
import './task-ui.css'
import './manage.css'

export type TagManageScreenProps = {
    app: TaskApp
}

/**
 * 标签管理屏幕
 * @description 标签列表 + 新建（名称/颜色）+ 删除；交互经 tagUseCase（DDD 红线）。
 */
export const TagManageScreen = ({ app }: TagManageScreenProps) => {
    const { t } = useI18n()
    const { tags } = useTagStore(app.tagStore)
    const [name, setName] = useState('')
    const [color, setColor] = useState<string>(TAG_COLORS[0])
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        void app.tagUseCase.loadTags()
    }, [app.tagUseCase])

    const create = () => {
        const trimmed = name.trim()
        if (trimmed === '') return
        setSubmitting(true)
        void app.tagUseCase.createTag({ name: trimmed, color, description: '' }).then(() => {
            setName('')
            setSubmitting(false)
        })
    }

    return (
        <view className="ts-screen">
            <view className="ts-glow" />
            <ScreenHeader
                title={t('mobile.tag.title')}
                left="back"
                onLeftClick={() => navCore.back()}
            />

            <scroll-view className="ts-scroll" scroll-orientation="vertical">
                <view className="mg-body">
                    {/* 新建 */}
                    <view className="ts-card">
                        <text className="ts-field-label">{t('mobile.tag.create')}</text>
                        <view className="mg-row">
                            <Input
                                className="ts-input mg-name-input"
                                value={name}
                                placeholder={t('mobile.tag.namePlaceholder')}
                                onInput={(value) => setName(value)}
                            />
                            <Button
                                className="ts-primary-btn mg-add-btn"
                                disabled={submitting}
                                onClick={create}
                            >
                                <text className="ts-primary-btn-text">
                                    {t('mobile.tag.create')}
                                </text>
                            </Button>
                        </view>
                        <view className="ts-chips mg-colors">
                            {TAG_COLORS.map((item) => (
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

                    {/* 标签列表 */}
                    {tags.length === 0 ? (
                        <view className="ts-empty">
                            <text className="ts-empty-text">{t('common.noData')}</text>
                        </view>
                    ) : (
                        <view className="mg-list">
                            {tags.map((tag) => (
                                <view className="ts-card mg-item" key={tag.id}>
                                    <view
                                        className="ts-dot"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                    <text className="mg-item-name">{tag.name}</text>
                                    <Button
                                        className="mg-item-btn"
                                        onClick={() => {
                                            void app.tagUseCase.deleteTag(tag.id)
                                        }}
                                    >
                                        <text className="mg-item-btn-text">
                                            {t('mobile.tag.delete')}
                                        </text>
                                    </Button>
                                </view>
                            ))}
                        </view>
                    )}
                </view>
            </scroll-view>
        </view>
    )
}