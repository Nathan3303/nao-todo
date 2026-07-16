<script lang="ts" setup>
import type { NaoSmartListEmits, NaoSmartListProps } from './types'
import { computed } from 'vue'

defineOptions({ name: 'NaoSmartList' })
const props = defineProps<NaoSmartListProps>()
const emit = defineEmits<NaoSmartListEmits>()

const count = computed(() => props.count ?? props.links?.length)
</script>

F
<template>
    <nue-collapse-item :name="collapseItemName" theme="smart-list">
        <template #header="{ collapse, state }">
            <nue-button :icon="state ? 'arrow-right' : 'arrow-down'" theme="pure" @click="collapse">
                <nue-div theme="title" align="center">
                    <nue-text>{{ name }}</nue-text>
                    <nue-text theme="count">{{ count ?? 0 }}</nue-text>
                </nue-div>
            </nue-button>
            <nue-div theme="actions">
                <slot name="actions">
                    <nue-tooltip :content="manageBtnTooltip ?? '管理'" size="small">
                        <nue-button icon="setting" theme="pure" @click.stop="emit('manage')" />
                    </nue-tooltip>
                    <nue-tooltip :content="createBtnTooltip ?? '新增'" size="small">
                        <nue-button icon="plus" theme="pure" @click.stop="emit('create')" />
                    </nue-tooltip>
                </slot>
            </nue-div>
        </template>
        <nue-div
            theme="links"
            @dragstart="draggable && emit('dragstart', $event)"
            @dragover="draggable && emit('dragover', $event)"
            @dragleave="draggable && emit('dragleave', $event)"
            @dragend="draggable && emit('dragend', $event)"
            @drop="draggable && emit('drop', $event)"
        >
            <slot v-if="count">
                <nue-link
                    v-for="link in links"
                    :key="link.id"
                    :route="link.route"
                    :icon="link.icon"
                    theme="route"
                    :draggable="draggable"
                    :data-drag-item="draggable"
                    :data-drag-id="link.id"
                >
                    {{ link.title }}
                    <template #append>
                        <nue-div class="nue-link__append">
                            <slot name="linkAppend" :link="link"></slot>
                        </nue-div>
                    </template>
                </nue-link>
            </slot>
            <nue-text v-else theme="empty">
                {{ emptyText ?? '用清单来分类收集、组织和管理你的待办任务' }}
            </nue-text>
        </nue-div>
    </nue-collapse-item>
</template>

<style scoped>
@import url('./smart-list.css');
</style>

