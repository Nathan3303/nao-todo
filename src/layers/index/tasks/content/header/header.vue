<template>
    <nue-header>
        <nue-div align="center" justify="space-between" wrap="nowrap">
            <nue-div vertical width="fit-content" gap="4px" flex>
                <nue-div align="center" width="fit-content" gap="8px">
                    <nue-button
                        theme="icon-only"
                        :icon="pav ? 'menu-close' : 'menu-open'"
                        @click="handleHideProjectAside"
                    ></nue-button>
                    <nue-text size="24px"> {{ title }} </nue-text>
                </nue-div>
                <nue-text size="14px" color="gray">
                    <slot name="subTitle"> {{ subTitle }} </slot>
                </nue-text>
            </nue-div>
            <nue-div align="center" justify="end" width="fit-content" gap="8px">
                <slot name="actions"></slot>
            </nue-div>
        </nue-div>
        <nue-div wrap="nowrap" align="center">
            <nue-div class="project-navigations">
                <slot name="navigations"> </slot>
            </nue-div>
        </nue-div>
    </nue-header>
</template>

<script setup lang="ts">
import { useViewStore } from '@/stores'
import { storeToRefs } from 'pinia'
import type { ContentHeaderProps } from './types'

defineOptions({ name: 'ContentHeader' })
const props = withDefaults(defineProps<ContentHeaderProps>(), {
    title: '名称',
    subTitle: '子标题'
})

const viewStore = useViewStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)

const handleHideProjectAside = () => {
    viewStore.toggleProjectAsideVisible()
}
</script>

<style scoped>
.project-navigations {
    width: fit-content;
    gap: 0px;
    padding: 4px;
    background-color: #f4f4f5;
    border-radius: var(--primary-radius);

    &:deep().nue-link {
        padding: 4px 12px;
        height: auto;
        color: #66666e;
        border-color: transparent;
        justify-content: center;
        font-size: 14px;

        --hover-background-color: transparent;
        --active-background-color: transparent;
    }

    &:deep().nue-link--actived {
        background-color: white;
        color: #131315;
        box-shadow: var(--secondary-shadow);
    }
}
</style>
