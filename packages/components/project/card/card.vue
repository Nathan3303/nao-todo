<template>
    <nue-div
        class="project-card"
        theme="card"
        :data-actived="!project.isArchived && !project.isDeleted"
        @click="handleClick"
    >
        <nue-div vertical gap="8px" flex>
            <nue-div align="center" justify="space-between">
                <nue-text size="16px" :clamped="1">
                    {{ project.title }}
                </nue-text>
                <nue-div class="project-card__ops" align="center" width="fit-content">
                    <slot name="ops" />
                </nue-div>
            </nue-div>
            <nue-text size="12px" color="gray" :clamped="3">
                {{ project.description || '无描述' }}
            </nue-text>
        </nue-div>
        <nue-text size="12px" color="gray">
            清单状态：{{ project.isDeleted ? '已删除' : project.isArchived ? '已归档' : '正常' }}
        </nue-text>
        <nue-divider />
        <nue-div align="center" wrap="nowrap">
            <nue-text size="12px" color="gray">4/16</nue-text>
            <nue-progress :percentage="36" color="#424242" />
        </nue-div>
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
    flex-direction: column;

    &[data-actived='false'] {
        background-color: #f2f2f2;

        & > * {
            opacity: 0.8;
        }

        .project-card__footer-ops,
        .project-card__ops {
            opacity: 1;
        }
    }
}
</style>
