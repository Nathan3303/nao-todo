import { computed, type ComputedRef } from 'vue'
import type { PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'

/**
 * Format duration in seconds to a readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "2小时30分15秒", "30分15秒", or "15秒"
 */
export const formatDuration = (seconds: number): string => {
    if (seconds <= 0) return '0秒'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    const parts: string[] = []

    if (hours > 0) {
        parts.push(`${hours}小时`)
    }
    if (minutes > 0) {
        parts.push(`${minutes}分`)
    }
    if (secs > 0 || parts.length === 0) {
        parts.push(`${secs}秒`)
    }

    return parts.join('')
}

/**
 * Hook for calculating pomodoro records statistics
 * @param records - Computed ref of PomodoroRecordViewObject array or plain array
 * @returns Computed statistics
 */
export const usePomodoroRecordsStats = (
    records: ComputedRef<PomodoroRecordViewObject[]> | PomodoroRecordViewObject[]
) => {
    const recordsRef = computed(() => (Array.isArray(records) ? records : records.value))

    const totalDuration = computed(() => {
        const total = recordsRef.value.reduce((sum, record) => sum + record.duration, 0)
        return formatDuration(total)
    })

    const totalDurationSeconds = computed(() => {
        return recordsRef.value.reduce((sum, record) => sum + record.duration, 0)
    })

    const totalRecords = computed(() => recordsRef.value.length)

    const sessionCount = computed(() => {
        const sessionIds = new Set(recordsRef.value.map((r) => r.sessionId))
        return sessionIds.size
    })

    const pomodoroCount = computed(() => {
        return recordsRef.value.filter((r) => r.type === 1).length
    })

    const focusCount = computed(() => {
        return recordsRef.value.filter((r) => r.type === 2).length
    })

    const pomodoroPercentage = computed(() => {
        if (totalRecords.value === 0) return 0
        return (pomodoroCount.value / totalRecords.value) * 100
    })

    return {
        totalDuration,
        totalDurationSeconds,
        totalRecords,
        sessionCount,
        pomodoroCount,
        focusCount,
        pomodoroPercentage
    }
}

export type UsePomodoroRecordsStats = ReturnType<typeof usePomodoroRecordsStats>