<template>
    <nue-dialog v-model="visible" theme="update-log" title="版本更新日志">
        <nue-div vertical>
            <nue-div align="center">
                <nue-link href="https://github.com/Nathan3303/nao-todo/releases" target="_blank">
                    <nue-text size="24px">NaoTodo v0.2.0</nue-text>
                </nue-link>
            </nue-div>
            <nue-divider />
            <template v-for="(value, key) in logs" :key="key">
                <nue-div v-if="value" vertical gap="8px">
                    <nue-text size="18px">{{ key }}</nue-text>
                    <nue-div vertical gap="4px">
                        <nue-text v-for="(item, idx) in value" :key="idx" size="12px">
                            {{ `- ${item}` }}
                        </nue-text>
                    </nue-div>
                </nue-div>
            </template>
        </nue-div>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'UpdateLogDialog' })

const visible = ref(false)
const logs = {
    Feature: [
        '新增 ProjectSelector 组件',
        '新增标签管理器',
        '新增 Todo 时间过期的检测和更新',
        '新增清单管理器'
    ],
    BugFix: [
        '修复添加 Event 时的若干问题',
        '修复在任务看板中拖拽任务变更其状态时 projectId 变化的问题'
    ],
    'UI/UX': [
        '优化列表视图中已完成 Todo 的样式',
        '优化所有的日期时间显示',
        '优化 TodoEventDetails 中加载、新增以及修改时的用户反馈',
        '创建对话框发送创建请求后处理失败时不关闭对话框'
    ]
}

defineExpose({
    show: () => (visible.value = true)
})
</script>

<style scoped></style>
