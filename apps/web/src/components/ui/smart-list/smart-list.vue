<template>
    <nue-collapse-item :name="collapseItemName">
        <template #header="{ collapse, state }">
            <nue-button :icon="state ? 'arrow-right' : 'arrow-down'" theme="pure" @click="collapse">
                <template #default>
                    <nue-div align="center">
                        <nue-text size="var(--nue-text-xs)">{{ name }}</nue-text>
                        <nue-text color="var(--nue-primary-color-800)" size="var(--nue-text-xs)">
                            {{ count ?? 0 }}
                        </nue-text>
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
        <nue-div vertical align="stretch" gap=".5rem">
            <slot v-if="count">
                <nue-link
                    v-for="link in links"
                    :key="link.id"
                    :route="link.route"
                    :icon="link.icon"
                    theme="route"
                >
                    {{ link.title }}
                    <template #append>
                        <nue-div class="nue-link__append">
                            <slot name="linkAppend" :link="link"></slot>
                        </nue-div>
                    </template>
                </nue-link>
            </slot>
            <nue-text v-else class="nue-collapse-item__empty-text">
                {{ emptyText ?? '用清单来分类收集、组织和管理你的待办任务' }}
            </nue-text>
        </nue-div>
    </nue-collapse-item>
</template>

<script lang="ts" setup>
import type { NaoSmartListEmits, NaoSmartListProps } from './types'
import { computed } from 'vue'

defineOptions({ name: 'NaoSmartList' })
const props = defineProps<NaoSmartListProps>()
const emit = defineEmits<NaoSmartListEmits>()

const count = computed(() => {
    return props.count ?? props.links?.length
})
</script>

