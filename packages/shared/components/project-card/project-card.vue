<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectCardProps, ProjectCardEmits } from './types'
import { parse2RelativeDate } from '@nao-todo/shared/utils/relative-date-parser'
import { t } from '@nao-todo/shared/locales'

defineOptions({ name: 'ProjectCard' })
const props = defineProps<ProjectCardProps>()
defineEmits<ProjectCardEmits>()

const isDeleted = computed(() => props.project.isDeleted)
const isArchived = computed(() => props.project.isArchived)

const statusText = computed(() => {
    if (props.project.isDeleted) return t('component.projectCard.deleted')
    if (props.project.isArchived) return t('component.projectCard.archived')
    return t('component.projectCard.normal')
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
                {{ project.description || t('component.projectCard.noDescription') }}
            </nue-text>
        </nue-div>
        <!-- 底部信息 -->
        <nue-div theme="info">
            <nue-text v-if="isDeleted" color="var(--nue-primary-color-600)">
                {{ t('component.projectCard.deletedAt')
                }}{{ parse2RelativeDate(project.deactivedAt!) }}
            </nue-text>
            <nue-text
                v-else-if="isArchived && project.archivedAt"
                color="var(--nue-primary-color-400)"
            >
                {{ t('component.projectCard.archivedAt')
                }}{{ parse2RelativeDate(project.archivedAt) }}
            </nue-text>
            <nue-text v-else color="var(--nue-primary-color-400)">
                {{ t('component.projectCard.createdAt')
                }}{{ parse2RelativeDate(project.createdAt) }}
            </nue-text>
            <nue-text
                v-if="isArchived && project.archivedTaskCount !== undefined"
                color="var(--nue-primary-color-400)"
            >
                {{
                    t('component.projectCard.archivedTaskCount', {
                        count: project.archivedTaskCount
                    })
                }}
            </nue-text>
            <nue-text :color="statusColor">{{ statusText }}</nue-text>
        </nue-div>
    </nue-div>
</template>

<style scoped>
@import url('./project-card.css');
</style>