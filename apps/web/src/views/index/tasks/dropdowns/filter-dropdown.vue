<script setup lang="ts">
import {InnerDropdown, InnerDropdownOption} from './inner-dropdown'

const handleDropdownExecute = (executeId: string) => {
    console.log(executeId)
}
</script>

<template>
    <nue-dropdown placement="bottom-end" size="small" theme="menu">
        <template #default="{ clickTrigger }">
            <nue-button
                icon="filter"
                theme="icon-only"
                @click.stop="clickTrigger"
            />
        </template>
        <template #dropdown>
            <nue-div style="max-width: 12rem" gap="4px">
                <nue-div theme="block">
                    <nue-text theme="title">筛选</nue-text>
                    <inner-dropdown
                        @execute="handleDropdownExecute"
                        title="优先级"
                    >
                        <inner-dropdown-option
                            icon="priority-1"
                            title="低优先级"
                            execute-id="low"
                        />
                        <inner-dropdown-option
                            icon="priority-2"
                            title="中优先级"
                            execute-id="medium"
                        />
                        <inner-dropdown-option
                            icon="priority-3"
                            title="高优先级"
                            execute-id="high"
                        />
                    </inner-dropdown>
                    <inner-dropdown
                        @execute="handleDropdownExecute"
                        title="状态"
                    >
                        <inner-dropdown-option
                            icon="circle"
                            title="待办"
                            execute-id="todo"
                        />
                        <inner-dropdown-option
                            icon="in-progress"
                            title="正在进行"
                            execute-id="in-progress"
                        />
                        <inner-dropdown-option
                            icon="success"
                            title="已完成"
                            execute-id="done"
                        />
                    </inner-dropdown>
                </nue-div>
                <nue-divider/>
                <nue-div theme="block">
                    <nue-text theme="title">排序</nue-text>
                    <inner-dropdown
                        @execute="handleDropdownExecute"
                        title="字段"
                        icon="select"
                    >
                    </inner-dropdown>
                    <inner-dropdown
                        @execute="handleDropdownExecute"
                        title="顺序"
                        icon="select"
                    >
                    </inner-dropdown>
                </nue-div>
            </nue-div>
        </template>
    </nue-dropdown>
</template>

<style scoped></style>
