<script setup lang="ts">
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import type { ProjectCardProps, ProjectCardEmits } from './types'

defineOptions({ name: 'ProjectCard' })
const props = defineProps<ProjectCardProps>()
const emit = defineEmits<ProjectCardEmits>()

const router = useRouter()

const isActived = computed(() => {
    return !props.project.isArchived && !props.project.isDeleted
})

const handleClick = () => {
    emit('click', props.project)
    if (!props.allowRoute) return
    router.push({
        name: 'project-main',
        params: {
            projectId: props.project.id
        }
    })
}
</script>

<template>
    <nue-div class="project-card" :data-actived="isActived" @click="handleClick">
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

    &[data-actived='false'] {
        background-color: #f2f2f2;
    }

    &[data-actived='false'] > * {
        opacity: 0.8;
    }

    &[data-actived='false'] .project-card__footer-ops,
    &[data-actived='false'] .project-card__ops {
        opacity: 1;
    }
}
</style>
