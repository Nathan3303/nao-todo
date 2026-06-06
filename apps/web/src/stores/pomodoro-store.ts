import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'
import type { PomodoroRecordViewObject } from '@/components/pomodoro/timer/types'

/**
 * 生成 mock 专注记录数据
 */
function initMockRecords(): PomodoroRecordViewObject[] {
    const today = dayjs().format('YYYY-MM-DD')
    return [
        {
            id: nanoid(),
            taskId: 'mock-task-1',
            name: '完成项目架构设计文档',
            type: 'timer',
            startAt: `${today}T09:00:00.000Z`,
            endAt: `${today}T09:25:00.000Z`,
            duration: 25 * 60,
            note: '完成了整体架构图和数据流设计'
        },
        {
            id: nanoid(),
            taskId: 'mock-task-2',
            name: '修复登录页面样式问题',
            type: 'timer',
            startAt: `${today}T09:30:00.000Z`,
            endAt: `${today}T09:55:00.000Z`,
            duration: 25 * 60,
            note: ''
        },
        {
            id: nanoid(),
            taskId: '',
            name: '未关联任务',
            type: 'timer',
            startAt: `${today}T10:30:00.000Z`,
            endAt: `${today}T10:45:00.000Z`,
            duration: 15 * 60,
            note: '临时专注，回顾上午工作进度'
        },
        {
            id: nanoid(),
            taskId: 'mock-task-1',
            name: '完成项目架构设计文档',
            type: 'timer',
            startAt: `${today}T14:00:00.000Z`,
            endAt: `${today}T14:25:00.000Z`,
            duration: 25 * 60,
            note: '补充了接口定义和错误处理方案'
        }
    ]
}

const usePomodoroStore = defineStore('PomodoroStore', () => {
    // @state 当前关联任务 ID
    const currentTaskId = ref<string | null>(null)

    // @state 当前关联任务名称
    const currentTaskName = ref('')

    // @state 当前专注记录 ID（focus 开始时由 nanoid 生成）
    const currentRecordId = ref<string | null>(null)

    // @state 当前专注记录开始时间（ISO 8601）
    const currentRecordStartAt = ref<string | null>(null)

    // @state 专注记录列表
    const records = ref<PomodoroRecordViewObject[]>(initMockRecords())

    // @state 当前笔记文本
    const noteText = ref('')

    // @state 专注时长（秒）
    const focusDuration = ref(25 * 60)

    // @state 休息时长（秒）
    const breakDuration = ref(5 * 60)

    // @action 设置当前会话
    const setCurrentSession = (
        taskId: string | null,
        taskName: string,
        recordId: string,
        startAt: string
    ) => {
        currentTaskId.value = taskId
        currentTaskName.value = taskName
        currentRecordId.value = recordId
        currentRecordStartAt.value = startAt
    }

    // @action 清除当前会话
    const clearCurrentSession = () => {
        currentTaskId.value = null
        currentTaskName.value = ''
        currentRecordId.value = null
        currentRecordStartAt.value = null
        noteText.value = ''
    }

    // @action 添加专注记录
    const addRecord = (record: PomodoroRecordViewObject) => {
        records.value.push(record)
    }

    // @action 更新记录笔记
    const updateNote = (recordId: string, note: string) => {
        const record = records.value.find((r) => r.id === recordId)
        if (record) {
            record.note = note
        }
    }

    // @action 设置笔记文本
    const setNoteText = (text: string) => {
        noteText.value = text
    }

    // @action 设置专注时长
    const setFocusDuration = (seconds: number) => {
        focusDuration.value = seconds
    }

    // @action 设置休息时长
    const setBreakDuration = (seconds: number) => {
        breakDuration.value = seconds
    }

    return {
        currentTaskId,
        currentTaskName,
        currentRecordId,
        currentRecordStartAt,
        records,
        noteText,
        focusDuration,
        breakDuration,
        setCurrentSession,
        clearCurrentSession,
        addRecord,
        updateNote,
        setNoteText,
        setFocusDuration,
        setBreakDuration
    }
})

export default usePomodoroStore
