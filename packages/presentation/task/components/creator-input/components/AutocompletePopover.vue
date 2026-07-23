<script lang="ts" setup>
import { NueIcon } from 'nue-ui'
import type { SuggestionResult } from '../types'

interface Props {
  visible: boolean
  suggestions: SuggestionResult[]
  activeIndex: number
  type: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', item: SuggestionResult): void
  (e: 'close'): void
  (e: 'update:activeIndex', index: number): void
}>()

// 显示标签映射
const typeLabels: Record<string, string> = {
  tag: '标签',
  project: '清单',
  priority: '优先级',
  status: '状态'
}

// 图标映射
const typeIcons: Record<string, string> = {
  tag: 'tag',
  project: 'folder',
  priority: 'flag',
  status: 'circle'
}

const typeColors: Record<string, string> = {
  tag: '#3b82f6',
  project: '#10b981',
  priority: '#f59e0b',
  status: '#8b5cf6'
}
</script>

<template>
  <div
    v-if="visible && suggestions.length > 0"
    class="autocomplete-popover"
    data-autocomplete-popover
  >
    <!-- 头部 -->
    <div class="popover-header">
      <nue-icon :name="typeIcons[type] || 'search'" size="14" />
      <span class="popover-title">{{ typeLabels[type] || type }}</span>
    </div>

    <!-- 建议列表 -->
    <div class="popover-list">
      <div
        v-for="(item, index) in suggestions"
        :key="item.id"
        class="popover-item"
        :class="{ 'popover-item--active': index === activeIndex }"
        @click="emit('select', item)"
        @mouseenter="$emit('update:activeIndex', index)"
      >
        <nue-icon
          v-if="item.isNew"
          name="plus-circle"
          size="16"
          style="color: #3b82f6"
        />
        <nue-icon
          v-else
          :name="typeIcons[item.type] || 'circle'"
          size="16"
          :style="{ color: typeColors[item.type] }"
        />
        <span class="item-label">{{ item.label }}</span>
      </div>
    </div>

    <!-- 底部提示 -->
    <div class="popover-footer">
      <span class="hint">↑↓ 导航</span>
      <span class="hint">Enter 选择</span>
      <span class="hint">Esc 关闭</span>
    </div>
  </div>
</template>

<style scoped>
.autocomplete-popover {
  position: absolute;
  z-index: 1000;
  min-width: 220px;
  max-width: 320px;
  background: #ffffff;
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  top: 100%;
  left: 0;
  margin-top: 4px;
}

.popover-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--nue-text-color-secondary);
  background-color: rgba(17, 24, 39, 0.02);
  border-bottom: 1px solid rgba(17, 24, 39, 0.06);
}

.popover-title {
  font-weight: 500;
}

.popover-list {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--nue-text-color-primary);
  transition: background-color 0.15s ease;
}

.popover-item:hover {
  background-color: rgba(17, 24, 39, 0.06);
}

.popover-item--active {
  background-color: rgba(59, 130, 246, 0.1) !important;
}

.item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.popover-footer {
  display: flex;
  gap: 12px;
  padding: 6px 12px;
  border-top: 1px solid rgba(17, 24, 39, 0.06);
  background-color: rgba(17, 24, 39, 0.02);
}

.hint {
  font-size: 11px;
  color: var(--nue-text-color-tertiary);
}
</style>
