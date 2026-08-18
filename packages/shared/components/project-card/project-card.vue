<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectCardProps, ProjectCardEmits } from './types'
import { parse2RelativeDate } from '@nao-todo/shared'

defineOptions({ name: 'ProjectCard' })
const props = defineProps<ProjectCardProps>()
defineEmits<ProjectCardEmits>()

const isDeleted = computed(() => props.project.isDeleted)
const isArchived = computed(() => props.project.isArchived)

const statusText = computed(() => {
    if (props.project.isDeleted) return '已删除'
    if (props.project.isArchived) return '已归档'
    return '正常'
})

const statusColor = computed(() => {
    if (props.project.isDeleted) return 'var(--nue-error-color-80)'
    if (props.project.isArchived) return 'var(--nue-warning-color-80)'
    return 'var(--nue-success-color-70)'
})
</script>

<template>
    <nue-div theme="project-card" :data-deleted="isDeleted" :data-archived="isArchived">
        <nue-div theme="name-desc">
            <!-- 顶部：项目名称 + 图标 + 操作 -->
            <nue-div theme="name">
                <nue-icon v-if="project.icon" :name="project.icon" />
                <nue-text :clamped="1">{{ project.name }}</nue-text>
                <nue-div theme="actions" align="center" width="fit-content" gap="0.5rem">
                    <slot name="ops" />
                </nue-div>
            </nue-div>
            <!-- 项目描述 -->
            <nue-text
                theme="description"
                size="var(--nue-text-xs)"
                color="var(--nue-primary-color-500)"
                :clamped="3"
                style="word-break: break-word"
            >
                {{ project.description || '无描述' }}
            </nue-text>
        </nue-div>
        <!-- 底部信息 -->
        <nue-div theme="info">
            <nue-text v-if="isDeleted" color="var(--nue-primary-color-600)">
                删除于{{ parse2RelativeDate(project.deactivedAt!) }}
            </nue-text>
            <nue-text v-else color="var(--nue-primary-color-400)">
                创建于{{ parse2RelativeDate(project.createdAt) }}
            </nue-text>
            <nue-text :color="statusColor">{{ statusText }}</nue-text>
        </nue-div>
    </nue-div>
</template>

<style scoped>
@import url('./project-card.css');
</style>