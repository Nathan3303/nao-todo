import { Button } from '@lynx-js/lynx-ui'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useI18n } from '../../hooks/use-i18n'
import { formatDateTime } from '../../logic/time-core'
import { taskPriorityLocaleKey, taskStateLocaleKey } from '../../logic/task-filter-core'

export type TaskCardProps = {
    task: TaskViewObject
    onClick: () => void
    /** 标签 id → 名称（列表页注入，卡片展示标签名） */
    tagNames?: (tagId: string) => string
    /** 入场动画延迟（ms，列表逐条上浮） */
    style?: Record<string, string | number>
}

/**
 * 任务卡片（列表项）
 * @description 名称 + 状态/优先级 chips + 结束时间 + 标签；整体为可点击 Button。
 */
export const TaskCard = ({ task, onClick, tagNames, style }: TaskCardProps) => {
    const { t } = useI18n()
    const endAtText = formatDateTime(task.endAt)
    const tagTexts = (task.tags ?? []).map((id) => tagNames?.(id) ?? id).filter(Boolean)

    return (
        <Button className="tcard" style={style} onClick={onClick}>
            <view className="tcard-main">
                <view className="tcard-name-row">
                    <text className={`tcard-state-dot tcard-state-${task.state}`} />
                    <text className="tcard-name">{task.name || t('common.unknown')}</text>
                    {task.state === 'done' ? (
                        <view className="tcard-seal">
                            <text className="tcard-seal-text">✓</text>
                        </view>
                    ) : null}
                </view>
                <view className="tcard-meta">
                    <view className="tcard-chip">
                        <text className="tcard-chip-text">{t(taskStateLocaleKey(task.state))}</text>
                    </view>
                    {task.priority !== 'none' ? (
                        <view className={`tcard-chip tcard-priority-${task.priority}`}>
                            <text className="tcard-chip-text">
                                {t(taskPriorityLocaleKey(task.priority))}
                            </text>
                        </view>
                    ) : null}
                    {endAtText !== '' ? <text className="tcard-date">{endAtText}</text> : null}
                </view>
            </view>
            {tagTexts.length > 0 ? (
                <view className="tcard-tags">
                    {tagTexts.slice(0, 3).map((name, index) => (
                        <view className="tcard-tag" key={`${name}-${index}`}>
                            <text className="tcard-tag-text">{name}</text>
                        </view>
                    ))}
                </view>
            ) : null}
        </Button>
    )
}