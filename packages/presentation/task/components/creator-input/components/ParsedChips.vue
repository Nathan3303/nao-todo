<script lang="ts" setup>
import { computed } from 'vue'
import type { TaskProjectViewObject, TaskTagViewObject } from '@nao-todo/application/task/viewobjects'
import { NueIcon } from 'nue-ui'

interface Props {
  tags: string[]
  projectId: string | null
  priority: string | null
  state: string | null
  availableTags: TaskTagViewObject[]
  availableProjects: TaskProjectViewObject[]
}

const props = defineProps<Props>()

// ============== 标签 Chips ==============

const tagChips = computed(() => {
  return props.tags
    .map(tagId => {
      const tag = props.availableTags.find(t => t.id === tagId)
      if (!tag) return null
      return {
        id: tag.id,
        label: tag.name || '',
        color: tag.color || '#6b7280'
      }
    })
    .filter(Boolean)
})

// ============== 项目 Chip ==============

const projectChip = computed(() => {
  if (!props.projectId) return null

  const project = props.availableProjects.find(p => p.id === props.projectId)
  if (!project) return null

  return {
    id: project.id,
    label: project.name || ''
  }
})

// ============== 优先级 Chip ==============

const priorityChip = computed(() => {
  if (!props.priority) return null

  const labels: Record<string, string> = {
    low: '低优先级',
    medium: '中优先级',
    high: '高优先级'
  }

  const colors: Record<string, string> = {
    low: '#6b7280',
    medium: '#3b82f6',
    high: '#ef4444'
  }

  return {
    value: props.priority,
    label: labels[props.priority] || props.priority,
    color: colors[props.priority] || '#6b7280'
  }
})

// ============== 状态 Chip ==============

const stateChip = computed(() => {
  if (!props.state) return null

  const labels: Record<string, string> = {
    todo: '待办',
    'in-progress': '进行中',
    done: '已完成'
  }

  const colors: Record<string, string> = {
    todo: '#6b7280',
    'in-progress': '#3b82f6',
    done: '#10b981'
  }

  return {
    value: props.state,
    label: labels[props.state] || props.state,
    color: colors[props.state] || '#6b7280'
  }
})

// ============== 是否有内容 ==============

const hasContent = computed(
  () =>
    tagChips.value.length > 0 ||
    projectChip.value !== null ||
    priorityChip.value !== null ||
    stateChip.value !== null
)
</script>

<template>
  <div v-if="hasContent" class="task-creator-chips">
    <!-- 标签 -->
    <div class="chip-group">
      <span class="chip-label">
        <nue-icon name="tag" size="14" />
      </span>
      <span v-for="tag in tagChips" :key="tag.id" class="chip chip--tag" :style="{ backgroundColor: tag.color + '20', color: tag.color }">
        {{ tag.label }}
      </span>
    </div>

    <!-- 项目 -->
    <div v-if="projectChip" class="chip-group">
      <span class="chip-label">
        <nue-icon name="folder" size="14" />
      </span>
      <span class="chip chip--project">
        {{ projectChip.label }}
      </span>
    </div>

    <!-- 优先级 -->
    <div v-if="priorityChip" class="chip-group">
      <span class="chip-label">
        <nue-icon name="flag" size="14" />
      </span>
      <span class="chip chip--priority" :style="{ backgroundColor: priorityChip.color + '20', color: priorityChip.color }">
        {{ priorityChip.label }}
      </span>
    </div>

    <!-- 状态 -->
    <div v-if="stateChip" class="chip-group">
      <span class="chip-label">
        <nue-icon name="circle" size="14" />
      </span>
      <span class="chip chip--state" :style="{ backgroundColor: stateChip.color + '20', color: stateChip.color }">
        {{ stateChip.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.task-creator-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background-color: rgba(17, 24, 39, 0.02);
  border-top: 1px solid rgba(17, 24, 39, 0.06);
}

.chip-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chip-label {
  display: flex;
  align-items: center;
  color: var(--nue-text-color-secondary);
  opacity: 0.6;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.5;
  background-color: rgba(17, 24, 39, 0.06);
  color: var(--nue-text-color-secondary);
}

.chip--tag {
  background-color: rgba(59, 130, 246, 0.1);
  color: rgb(37, 99, 235);
}

.chip--project {
  background-color: rgba(16, 185, 129, 0.1);
  color: rgb(5, 150, 105);
}

.chip--priority {
  background-color: rgba(245, 158, 11, 0.1);
  color: rgb(217, 119, 6);
}

.chip--state {
  background-color: rgba(139, 92, 246, 0.1);
  color: rgb(124, 58, 237);
}
</style>
