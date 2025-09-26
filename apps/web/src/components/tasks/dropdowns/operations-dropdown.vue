<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import useDropdownExecutor from './use-dropdown-executor'

const { register, unregisterAll, execute } = useDropdownExecutor()

onBeforeUnmount(() => unregisterAll())

defineExpose({ register })
</script>

<template>
    <nue-dropdown
        close-when-executed
        placement="bottom-end"
        size="small"
        @execute="(executeId: string) => execute(executeId)"
        theme="menu"
        group="tasks-operations-dropdown"
    >
        <template #trigger="{ trigger }">
            <slot name="trigger" :trigger="trigger">
                <nue-button icon="more" theme="icon,ghost" @click="trigger" />
            </slot>
        </template>
        <slot></slot>
        <!-- <template #default> -->
        <!-- <nue-div theme="block">
                <nue-text theme="title">切换视图</nue-text>
                <nue-div gap="0.5rem" wrap="nowrap" justify="space-between">
                    <li data-executeid="switch-view-to-table">
                        <nue-icon v-if="$route.name!.toString().endsWith('table')" name="check" />
                        表格
                    </li>
                    <li data-executeid="switch-view-to-kanban">
                        <nue-icon v-if="$route.name!.toString().endsWith('kanban')" name="check" />
                        看板
                    </li>
                    <li data-executeid="switch-view-to-list">
                        <nue-icon v-if="$route.name!.toString().endsWith('list')" name="check" />
                        列表
                    </li>
                </nue-div>
            </nue-div>
            <nue-divider />
            <nue-div theme="block">
                <nue-text theme="title">视图操作</nue-text>
                <li :data-disabled="isRefreshing" data-executeid="refresh-data">
                    <nue-icon name="refresh" /> 重新获取数据
                </li>
                <li data-executeid="hide-which-is-done">
                    <nue-icon name="eye-close" /> 隐藏已完成
                </li> 
            <inner-dropdown
                    @execute="handleColumnDropdownExecute"
                    title="显示与隐藏列"
                    @click.stop
                    :suffix="sortFieldDropdownOptions.count"
                    group="tasks-view-operations"
                >
                    <inner-dropdown-option
                        v-for="option in sortFieldDropdownOptions.options"
                        :key="option.label"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="option.checked"
                    />
                </inner-dropdown> -->
        <!-- </nue-div> -->
        <!-- <template v-if="viewProps.category === 'project'">
                <nue-divider />
                <nue-div theme="block">
                    <nue-text theme="title">清单操作</nue-text>
                <li data-executeid="save-as-preference">
                    <nue-icon name="picture" /> 保存当前视图布局偏好
                </li>
                    <li data-executeid="archive">
                        <nue-icon name="archive" />
                        归档该清单
                    </li>
                    <li data-executeid="delete-project">
                        <nue-icon name="delete" color="#f22" />
                        <span style="color: #f22">删除清单</span>
                    </li>
                </nue-div>
            </template>
            <template v-else-if="viewProps.category === 'tag'">
                <nue-divider />
                <nue-div theme="block">
                    <nue-text theme="title">标签操作</nue-text>
                    <li data-executeid="change-tag-color" v-if="viewProps.extra?.color">
                        <nue-icon name="theme" />
                        修改标签颜色
                        <tag-color-dot
                            :color="viewProps.extra.color as string"
                            style="margin-left: auto"
                            size="small"
                        />
                    </li>
                    <li data-executeid="delete-tag">
                        <nue-icon name="delete" color="#f22" />
                        <span style="color: #f22">删除标签</span>
                    </li>
                </nue-div>
            </template> -->
        <!-- </template> -->
    </nue-dropdown>
</template>
