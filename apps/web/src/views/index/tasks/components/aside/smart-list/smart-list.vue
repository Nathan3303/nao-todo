<template>
    <nue-collapse-item class="smart-list" :name="collapseItemName">
        <template #header="{ collapse, state }">
            <nue-button :icon="state ? 'arrow-right' : 'arrow-down'" theme="pure" @click="collapse">
                <template #default>
                    <nue-div align="center">
                        <nue-text size="12px">{{ name }}</nue-text>
                        <nue-text color="gray" size="12px">{{ count ?? 0 }}</nue-text>
                    </nue-div>
                </template>
            </nue-button>
            <nue-div gap="8px" width="fit-content">
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
        <slot v-if="count">
            <aside-link v-for="link in links" :key="link.id" :route="link.route" :icon="link.icon">
                {{ link.title }}
                <template #append>
                    <slot name="linkAppend" :link="link"></slot>
                </template>
            </aside-link>
        </slot>
        <nue-text v-else class="nue-collapse-item__empty-text" color="#a5a5a5" size="11px">
            {{ emptyText ?? '用清单来分类收集、组织和管理你的待办任务' }}
        </nue-text>
    </nue-collapse-item>
</template>

<script lang="ts" setup>
import { AsideLink } from '@nao-todo/components'
import type { SmartListEmits, SmartListProps } from './types'
import { computed } from 'vue'

const props = defineProps<SmartListProps>()
const emit = defineEmits<SmartListEmits>()

const count = computed(() => {
    return props.count ?? props.links?.length
})
</script>
