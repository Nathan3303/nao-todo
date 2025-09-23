<template>
    <nue-div
        class="project-card"
        :data-actived="!project.isArchived && !project.isDeleted"
        @click="handleClick"
    >
        <nue-div align="center" justify="space-between" wrap="nowrap">
            <nue-text size="16px" :clamped="1">
                {{ project.name }}
            </nue-text>
            <nue-div align="center" width="fit-content" gap="0.5rem">
                <slot name="ops" />
            </nue-div>
        </nue-div>
        <nue-text size="12px" color="gray" :clamped="3" style="word-break: break-word">
            {{ project.description || '无描述' }}
        </nue-text>
        <nue-div flex="1" />
        <nue-text size="12px" color="gray">
            清单状态：{{ project.isDeleted ? '已删除' : project.isArchived ? '已归档' : '正常' }}
        </nue-text>
        <nue-div v-if="$slots.footerOps" class="project-card__footer-ops" align="center">
            <nue-divider />
            <slot name="footerOps" />
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { Project } from '@nao-todo/types'

defineOptions({ name: 'ProjectCard' })
const props = defineProps<{
    project: Project
    allowRoute?: boolean
}>()
const emit = defineEmits<{
    (event: 'click', project: Project): void
    (event: 'unarchiveProject', projectId: Project['id']): void
}>()

const router = useRouter()

const handleClick = () => {
    const { project, allowRoute } = props
    emit('click', project)
    if (!allowRoute) return
    router.push({
        name: 'project-main',
        params: {
            projectId: project.id
        }
    })
}
</script>

<style scoped>
.project-card {
    border: 1px solid var(--nue-divider-color);
    border-radius: var(--nue-primary-radius);
    padding: 1rem;
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
    flex-wrap: nowrap;
    box-shadow: var(--nue-secondary-shadow);
}

.project-card[data-actived='false'] {
    background-color: #f2f2f2;
}

.project-card[data-actived='false'] > * {
    opacity: 0.8;
}

.project-card[data-actived='false'] .project-card__footer-ops,
.project-card[data-actived='false'] .project-card__ops {
    opacity: 1;
}
</style>
