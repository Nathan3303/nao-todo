<template>
    <nue-div class="project-card" theme="card" :data-actived="isActived" @click="handleClick">
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
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ProjectCardProps, ProjectCardEmits } from './types'

defineOptions({ name: 'ProjectCard' })
const props = defineProps<ProjectCardProps>()
const emit = defineEmits<ProjectCardEmits>()

const router = useRouter()

const isActived = computed(() => {
    const { project } = props
    return !project.isArchived && !project.isDeleted
})

const handleClick = () => {
    const { project, allowRoute } = props
    if (allowRoute) {
        router.push({
            name: 'project-main',
            params: {
                projectId: props.project.id
            }
        })
    }
    emit('click', project)
}
</script>

<style scoped>
@import url('./card.css');
</style>
