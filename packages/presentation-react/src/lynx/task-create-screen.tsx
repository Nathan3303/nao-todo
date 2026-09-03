import { useEffect, useState } from '@lynx-js/react'
import { Button, Input, TextArea } from '@lynx-js/lynx-ui'
import type { TaskState } from '@nao-todo/domain-task'
import { useI18n } from '../hooks/use-i18n'
import { useNav } from '../hooks/use-nav'
import { useProjectStore } from '../hooks/use-project-store'
import { useTagStore } from '../hooks/use-tag-store'
import { navCore } from '../logic/nav-core'
import { taskPriorityLocaleKey, taskStateLocaleKey } from '../logic/task-filter-core'
import type { TaskApp } from '../hooks/use-task-app'
import { ScreenHeader } from './components/screen-header'
import { DatePickerSheet } from './components/date-picker-sheet'
import './task-ui.css'
import './task-create.css'

export type TaskCreateScreenProps = {
    app: TaskApp
}

/** 解析 "2026-06-01 09:00" / "2026-06-01" → ISO 字符串；失败返回 null */
const parseDateTime = (raw: string): string | null => {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? `${trimmed}T00:00:00`
        : trimmed.includes('T')
          ? trimmed
          : trimmed.replace(' ', 'T')
    const date = new Date(normalized)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
}

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * 任务创建屏幕
 * @description 表单（名称/描述/状态/优先级/项目/标签/起止时间），提交经 taskUseCase.createTask；
 *              按来源清单给出默认值（今日/明日/本周 → 起止时间；收集箱 → 项目），用户可覆盖。
 */
export const TaskCreateScreen = ({ app }: TaskCreateScreenProps) => {
    const { t } = useI18n()
    const route = useNav()
    const { projects } = useProjectStore(app.projectStore)
    const { tags } = useTagStore(app.tagStore)
    const [submitting, setSubmitting] = useState(false)

    const { builtinId, projectId: scopeProjectId } = route.params

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [state, setState] = useState<TaskState>('todo')
    const [priority, setPriority] = useState<string>('medium')
    const [projectId, setProjectId] = useState<string | null>(null)
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
    const [startAtRaw, setStartAtRaw] = useState('')
    const [endAtRaw, setEndAtRaw] = useState('')
    const [datePickerTarget, setDatePickerTarget] = useState<'startAt' | 'endAt' | null>(null)
    const [error, setError] = useState<string | null>(null)

    // 按来源清单初始化默认值（仅首帧一次；路由参数在该屏幕生命周期内不变）
    useEffect(() => {
        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        if (builtinId === 'today' || builtinId === 'tomorrow' || builtinId === 'week') {
            const offsetDays = builtinId === 'today' ? 0 : builtinId === 'tomorrow' ? 1 : 0
            const weekEnd = new Date(startOfDay)
            weekEnd.setDate(weekEnd.getDate() + (builtinId === 'week' ? 6 - weekEnd.getDay() : 0))
            setStartAtRaw(
                builtinId === 'week'
                    ? ''
                    : `${startOfDay.getFullYear()}-${pad(startOfDay.getMonth() + 1)}-${pad(startOfDay.getDate())}`
            )
            const end = builtinId === 'week' ? weekEnd : startOfDay
            end.setDate(end.getDate() + offsetDays)
            setEndAtRaw(`${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`)
        } else if (builtinId === 'inbox' || scopeProjectId) {
            setProjectId(scopeProjectId ?? 'inbox')
        }
    }, [builtinId, scopeProjectId])

    const activeProjects = projects.filter((p) => !p.isDeleted)

    const toggleTag = (tagId: string) => {
        setSelectedTagIds((prev) =>
            prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
        )
    }

    const submit = () => {
        const trimmedName = name.trim()
        if (trimmedName === '') {
            setError(t('mobile.taskCreate.namePlaceholder'))
            return
        }
        setError(null)
        setSubmitting(true)
        const startAt = parseDateTime(startAtRaw)
        const endAt = parseDateTime(endAtRaw)
        void app.taskUseCase
            .createTask({
                projectId: projectId ?? '',
                name: trimmedName,
                description,
                state,
                priority,
                startAt,
                endAt,
                tags: selectedTagIds,
                remindAt: null,
                remindRepeat: 'none',
                remindTime: null,
                remindWeekdays: []
            })
            .then(([, err]) => {
                if (err === null) {
                    navCore.back()
                } else {
                    setError(err instanceof Error ? err.message : err)
                    setSubmitting(false)
                }
            })
            .catch((reason) => {
                console.error(reason)
                setError(t('mobile.common.loadFailed'))
                setSubmitting(false)
            })
    }

    return (
        <view className="ts-screen">
            <view className="ts-glow" />
            <ScreenHeader
                title={t('mobile.taskCreate.title')}
                left="back"
                onLeftClick={() => navCore.back()}
            />

            <scroll-view className="ts-scroll" scroll-orientation="vertical">
                <view className="tc-body">
                    <view className="ts-field">
                        <text className="ts-field-label">{t('task.column.name')}</text>
                        <Input
                            className="ts-input"
                            value={name}
                            placeholder={t('mobile.taskCreate.namePlaceholder')}
                            onInput={(value) => setName(value)}
                        />
                    </view>

                    <view className="ts-field">
                        <text className="ts-field-label">{t('mobile.taskDetail.description')}</text>
                        <TextArea
                            className="ts-textarea"
                            value={description}
                            placeholder={t('mobile.taskCreate.descriptionPlaceholder')}
                            onInput={(value) => setDescription(value)}
                        />
                    </view>

                    <view className="ts-field">
                        <text className="ts-field-label">{t('mobile.taskCreate.state')}</text>
                        <view className="ts-chips">
                            {(['todo', 'in-progress', 'done'] as const).map((item) => (
                                <Button
                                    key={item}
                                    className={`ts-chip${state === item ? ' ui-active' : ''}`}
                                    onClick={() => setState(item)}
                                >
                                    <text className="ts-chip-text">
                                        {t(taskStateLocaleKey(item))}
                                    </text>
                                </Button>
                            ))}
                        </view>
                    </view>

                    <view className="ts-field">
                        <text className="ts-field-label">{t('mobile.taskCreate.priority')}</text>
                        <view className="ts-chips">
                            {(['high', 'medium', 'low', 'none'] as const).map((item) => (
                                <Button
                                    key={item}
                                    className={`ts-chip${priority === item ? ' ui-active' : ''}`}
                                    onClick={() => setPriority(item)}
                                >
                                    <text className="ts-chip-text">
                                        {t(taskPriorityLocaleKey(item))}
                                    </text>
                                </Button>
                            ))}
                        </view>
                    </view>

                    <view className="ts-field">
                        <text className="ts-field-label">{t('mobile.taskCreate.project')}</text>
                        {activeProjects.length === 0 ? (
                            <text className="tc-empty-tip">
                                {t('mobile.taskCreate.projectEmpty')}
                            </text>
                        ) : (
                            <view className="ts-chips">
                                {activeProjects.map((project) => (
                                    <Button
                                        key={project.id}
                                        className={`ts-chip${projectId === project.id ? ' ui-active' : ''}`}
                                        onClick={() => setProjectId(project.id)}
                                    >
                                        <view
                                            className="ts-dot"
                                            style={{ backgroundColor: project.icon }}
                                        />
                                        <text className="ts-chip-text">{project.name}</text>
                                    </Button>
                                ))}
                            </view>
                        )}
                    </view>

                    <view className="ts-field">
                        <text className="ts-field-label">{t('mobile.taskCreate.tags')}</text>
                        {tags.length === 0 ? (
                            <text className="tc-empty-tip">{t('mobile.taskCreate.tagEmpty')}</text>
                        ) : (
                            <view className="ts-chips">
                                {tags.map((tag) => (
                                    <Button
                                        key={tag.id}
                                        className={`ts-chip${selectedTagIds.includes(tag.id) ? ' ui-active' : ''}`}
                                        onClick={() => toggleTag(tag.id)}
                                    >
                                        <view
                                            className="ts-dot"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <text className="ts-chip-text">{tag.name}</text>
                                    </Button>
                                ))}
                            </view>
                        )}
                    </view>

                    <view className="ts-field">
                        <text className="ts-field-label">{t('task.column.startAt')}</text>
                        <Button
                            className={`ts-input tc-date-btn${startAtRaw === '' ? ' empty' : ''}`}
                            onClick={() => setDatePickerTarget('startAt')}
                        >
                            <text className="tc-date-btn-text">
                                {startAtRaw || t('mobile.taskCreate.startAtPlaceholder')}
                            </text>
                        </Button>
                    </view>

                    <view className="ts-field">
                        <text className="ts-field-label">{t('task.column.endAt')}</text>
                        <Button
                            className={`ts-input tc-date-btn${endAtRaw === '' ? ' empty' : ''}`}
                            onClick={() => setDatePickerTarget('endAt')}
                        >
                            <text className="tc-date-btn-text">
                                {endAtRaw || t('mobile.taskCreate.endAtPlaceholder')}
                            </text>
                        </Button>
                    </view>

                    {error !== null ? <text className="tc-error">{error}</text> : null}

                    <Button
                        className="ts-primary-btn tc-submit"
                        disabled={submitting}
                        onClick={submit}
                    >
                        <text className="ts-primary-btn-text">
                            {submitting ? t('common.loading') : t('mobile.taskCreate.submit')}
                        </text>
                    </Button>
                </view>
            </scroll-view>

            <DatePickerSheet
                show={datePickerTarget !== null}
                mode="datetime"
                initial={datePickerTarget === 'startAt' ? startAtRaw : endAtRaw || null}
                onConfirm={(iso) => {
                    if (datePickerTarget === 'startAt') setStartAtRaw(iso ?? '')
                    if (datePickerTarget === 'endAt') setEndAtRaw(iso ?? '')
                    setDatePickerTarget(null)
                }}
                onCancel={() => setDatePickerTarget(null)}
            />
        </view>
    )
}