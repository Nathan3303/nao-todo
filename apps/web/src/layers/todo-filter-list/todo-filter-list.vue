<template>
    <nue-collapse-item name="filters">
        <template #header="{ collapse, state }">
            <nue-button theme="pure" :icon="state ? 'arrow-right' : 'arrow-down'" @click="collapse">
                <template #default>
                    <nue-div>
                        <nue-text size="12px">过滤器</nue-text>
                        <nue-text size="12px" color="gray">0</nue-text>
                    </nue-div>
                </template>
            </nue-button>
            <nue-div width="fit-content" gap="8px">
                <nue-tooltip size="small" content="打开过滤器管理器">
                    <nue-button theme="pure" icon="setting" @click.stop />
                </nue-tooltip>
                <nue-tooltip size="small" content="创建待办过滤器">
                    <nue-button id="create-filter-btn" theme="pure" icon="plus" @click.stop />
                </nue-tooltip>
            </nue-div>
        </template>
        <template #default>
            <nue-text class="nue-collapse-item__empty-text" size="11px" color="#a5a5a5">
                根据清单、时间、优先级、标签等属性过滤出符合条件的特定任务。
            </nue-text>
        </template>
    </nue-collapse-item>
</template>

<script setup lang="ts">
defineOptions({ name: 'TodoFilterList' })
</script>
