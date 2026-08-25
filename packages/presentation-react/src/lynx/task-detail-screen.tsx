import { Button, Checkbox, CheckboxIndicator, Input, TextArea } from '@lynx-js/lynx-ui'
import { useI18n } from '../hooks/use-i18n'
import { useNav } from '../hooks/use-nav'
import { navCore } from '../logic/nav-core'
import { taskPriorityLocaleKey, taskStateLocaleKey } from '../logic/task-filter-core'
import { formatDateTime, formatRelativeTime } from '../logic/time-core'
import type { TaskApp } from '../hooks/use-task-app'
import { ScreenHeader } from './components/screen-header'
import { useTaskDetail } from './use-task-detail'
import './task-ui.css'
import './task-detail.css'

export type TaskDetailScreenProps = {
    app: TaskApp
}

/**
 * 任务详情屏幕（纯渲染，逻辑收敛于 use-task-detail）
 * @description 名称/描述查看与编辑、状态/优先级切换、检查事项（增删勾选）、子任务、评论、
 *              删除/恢复（垃圾桶）；交互全部经 hook 暴露的具名 handler（组件不直接调 UseCase）。
 */
export const TaskDetailScreen = ({ app }: TaskDetailScreenProps) => {
    const { t } = useI18n()
    const route = useNav()
    const taskId = route.params.taskId ?? ''

    const {
        task,
        checkItems,
        comments,
        subTasks,
        subTaskDone,
        setTaskState,
        setTaskPriority,
        descEditing,
        descDraft,
        setDescDraft,
        startEditDescription,
        cancelEditDescription,
        saveDescription,
        checkItemDraft,
        setCheckItemDraft,
        addCheckItem,
        toggleCheckItem,
        removeCheckItem,
        commentDraft,
        setCommentDraft,
        addComment,
        subTaskDraft,
        setSubTaskDraft,
        addSubTask,
        toggleSubTask,
        removeSubTask,
        deleteOrRestore
    } = useTaskDetail(app, taskId)

    if (!task) {
        return (
            <view className="ts-screen">
                <view className="ts-glow" />
                <ScreenHeader
                    title={t('mobile.common.back')}
                    left="back"
                    onLeftClick={() => navCore.back()}
                />
                <view className="ts-empty">
                    <text className="ts-empty-text">{t('mobile.common.loadFailed')}</text>
                </view>
            </view>
        )
    }

    return (
        <view className="ts-screen">
            <view className="ts-glow" />
            <ScreenHeader
                title={task.name || t('common.unknown')}
                left="back"
                onLeftClick={() => navCore.back()}
            />

            <scroll-view className="ts-scroll" scroll-orientation="vertical">
                <view className="td-body">
                    {task.isDeleted ? (
                        <view className="td-deleted-tip">
                            <text className="td-deleted-tip-text">
                                {t('mobile.taskDetail.deletedTip')}
                            </text>
                        </view>
                    ) : null}

                    {/* 名称 */}
                    <view className="ts-card">
                        <text className="td-name">{task.name || t('common.unknown')}</text>
                        <text className="td-meta-line">
                            {t(taskStateLocaleKey(task.state))} ·{' '}
                            {t(taskPriorityLocaleKey(task.priority))}
                        </text>
                        {task.startAt || task.endAt ? (
                            <text className="td-meta-line">
                                {task.startAt ? `开始 ${formatDateTime(task.startAt)}` : ''}
                                {task.startAt && task.endAt ? ' · ' : ''}
                                {task.endAt ? `结束 ${formatDateTime(task.endAt)}` : ''}
                            </text>
                        ) : null}
                    </view>

                    {/* 状态切换 */}
                    <view className="ts-card">
                        <text className="ts-field-label">{t('mobile.taskCreate.state')}</text>
                        <view className="ts-chips">
                            {(['todo', 'in-progress', 'done'] as const).map((state) => (
                                <Button
                                    key={state}
                                    className={`ts-chip${task.state === state ? ' ui-active' : ''}`}
                                    onClick={() => setTaskState(state)}
                                >
                                    <text className="ts-chip-text">
                                        {t(taskStateLocaleKey(state))}
                                    </text>
                                </Button>
                            ))}
                        </view>
                    </view>

                    {/* 优先级切换（与状态栏目同构） */}
                    <view className="ts-card">
                        <text className="ts-field-label">{t('mobile.taskCreate.priority')}</text>
                        <view className="ts-chips">
                            {(['high', 'medium', 'low', 'none'] as const).map((priority) => (
                                <Button
                                    key={priority}
                                    className={`ts-chip${task.priority === priority ? ' ui-active' : ''}`}
                                    onClick={() => setTaskPriority(priority)}
                                >
                                    <text className="ts-chip-text">
                                        {t(taskPriorityLocaleKey(priority))}
                                    </text>
                                </Button>
                            ))}
                        </view>
                    </view>

                    {/* 描述 */}
                    <view className="ts-card">
                        <text className="ts-field-label">{t('mobile.taskDetail.description')}</text>
                        {descEditing ? (
                            <view>
                                <TextArea
                                    className="ts-textarea"
                                    value={descDraft}
                                    placeholder={t('mobile.taskCreate.descriptionPlaceholder')}
                                    onInput={(value) => setDescDraft(value)}
                                />
                                <view className="td-row-actions">
                                    <Button
                                        className="ts-danger-btn td-ghost"
                                        onClick={cancelEditDescription}
                                    >
                                        <text className="ts-danger-btn-text">
                                            {t('mobile.common.cancel')}
                                        </text>
                                    </Button>
                                    <Button
                                        className="ts-primary-btn td-submit"
                                        onClick={saveDescription}
                                    >
                                        <text className="ts-primary-btn-text">
                                            {t('mobile.common.save')}
                                        </text>
                                    </Button>
                                </view>
                            </view>
                        ) : (
                            <Button className="td-desc" onClick={startEditDescription}>
                                <text className="td-desc-text">
                                    {task.description
                                        ? task.description
                                        : t('mobile.taskCreate.descriptionPlaceholder')}
                                </text>
                            </Button>
                        )}
                    </view>

                    {/* 检查事项 */}
                    <view className="ts-card">
                        <text className="ts-field-label">{t('mobile.taskDetail.checkItems')}</text>
                        {checkItems.length > 0 ? (
                            <view className="td-check-list">
                                {checkItems.map((item) => (
                                    <view className="td-check-row" key={item.id}>
                                        <Checkbox
                                            className="td-check"
                                            checked={item.isDone}
                                            onChange={(checked) =>
                                                toggleCheckItem(item.id, checked)
                                            }
                                        >
                                            <CheckboxIndicator className="td-check-ind">
                                                <text className="td-check-ind-text">✓</text>
                                            </CheckboxIndicator>
                                        </Checkbox>
                                        <text
                                            className={`td-check-name${item.isDone ? ' done' : ''}`}
                                        >
                                            {item.name}
                                        </text>
                                        <Button
                                            className="td-row-delete"
                                            onClick={() => removeCheckItem(item.id)}
                                        >
                                            <text className="td-row-delete-text">✕</text>
                                        </Button>
                                    </view>
                                ))}
                            </view>
                        ) : null}
                        <view className="td-input-row">
                            <Input
                                className="ts-input td-input"
                                value={checkItemDraft}
                                placeholder={t('mobile.taskDetail.checkItemPlaceholder')}
                                onInput={(value) => setCheckItemDraft(value)}
                            />
                            <Button className="ts-primary-btn td-add-btn" onClick={addCheckItem}>
                                <text className="ts-primary-btn-text">
                                    {t('mobile.taskDetail.addCheckItem')}
                                </text>
                            </Button>
                        </view>
                    </view>

                    {/* 子任务 */}
                    <view className="ts-card">
                        <view className="td-sub-head">
                            <text className="ts-field-label">
                                {t('mobile.taskDetail.subTasks')}
                            </text>
                            {subTasks.length > 0 ? (
                                <text className="td-sub-progress">
                                    {t('mobile.taskDetail.subTaskProgress', {
                                        done: subTaskDone,
                                        total: subTasks.length
                                    })}
                                </text>
                            ) : null}
                        </view>
                        {subTasks.length === 0 ? (
                            <text className="td-sub-empty">
                                {t('mobile.taskDetail.subTaskEmpty')}
                            </text>
                        ) : (
                            <view className="td-check-list">
                                {subTasks.map((sub) => (
                                    <view className="td-check-row" key={sub.id}>
                                        <Checkbox
                                            className="td-check"
                                            checked={sub.state === 'done'}
                                            onChange={(checked) => toggleSubTask(sub.id, checked)}
                                        >
                                            <CheckboxIndicator className="td-check-ind">
                                                <text className="td-check-ind-text">✓</text>
                                            </CheckboxIndicator>
                                        </Checkbox>
                                        <text
                                            className={`td-check-name${sub.state === 'done' ? ' done' : ''}`}
                                        >
                                            {sub.name}
                                        </text>
                                        <Button
                                            className="td-row-delete"
                                            onClick={() => removeSubTask(sub.id)}
                                        >
                                            <text className="td-row-delete-text">✕</text>
                                        </Button>
                                    </view>
                                ))}
                            </view>
                        )}
                        <view className="td-input-row">
                            <Input
                                className="ts-input td-input"
                                value={subTaskDraft}
                                placeholder={t('mobile.taskDetail.subTaskPlaceholder')}
                                onInput={(value) => setSubTaskDraft(value)}
                            />
                            <Button className="ts-primary-btn td-add-btn" onClick={addSubTask}>
                                <text className="ts-primary-btn-text">
                                    {t('mobile.taskDetail.addSubTask')}
                                </text>
                            </Button>
                        </view>
                    </view>

                    {/* 评论 */}
                    <view className="ts-card">
                        <text className="ts-field-label">{t('mobile.taskDetail.comments')}</text>
                        {comments.length > 0 ? (
                            <view className="td-comment-list">
                                {comments.map((comment) => (
                                    <view className="td-comment" key={comment.id}>
                                        <view className="td-comment-head">
                                            <text className="td-comment-author">
                                                {comment.nickname || t('common.unknown')}
                                            </text>
                                            <text className="td-comment-time">
                                                {formatRelativeTime(comment.createdAt)}
                                            </text>
                                        </view>
                                        <text className="td-comment-content">
                                            {comment.content}
                                        </text>
                                    </view>
                                ))}
                            </view>
                        ) : null}
                        <view className="td-input-row">
                            <Input
                                className="ts-input td-input"
                                value={commentDraft}
                                placeholder={t('mobile.taskDetail.commentPlaceholder')}
                                onInput={(value) => setCommentDraft(value)}
                            />
                            <Button className="ts-primary-btn td-add-btn" onClick={addComment}>
                                <text className="ts-primary-btn-text">
                                    {t('mobile.taskDetail.addComment')}
                                </text>
                            </Button>
                        </view>
                    </view>

                    {/* 危险操作 */}
                    <view className="ts-card td-danger-zone">
                        <text className="ts-field-label">{t('mobile.taskDetail.dangerZone')}</text>
                        <Button className="ts-danger-btn" onClick={deleteOrRestore}>
                            <text className="ts-danger-btn-text">
                                {task.isDeleted
                                    ? t('mobile.taskDetail.restore')
                                    : t('mobile.taskDetail.delete')}
                            </text>
                        </Button>
                    </view>
                </view>
            </scroll-view>
        </view>
    )
}