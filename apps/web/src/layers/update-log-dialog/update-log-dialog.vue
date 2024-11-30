<template>
    <nue-dialog v-model="visible" theme="update-log" title="版本更新日志">
        <nue-div vertical>
            <nue-div align="center">
                <nue-link href="https://github.com/Nathan3303/nao-todo/releases" target="_blank">
                    <nue-text size="24px">NaoTodo v0.3.2</nue-text>
                </nue-link>
            </nue-div>
            <nue-divider />
            <template v-for="(value, key) in logs" :key="key">
                <nue-div v-if="value" vertical gap="8px">
                    <nue-text size="18px">{{ key }}</nue-text>
                    <nue-div vertical gap="4px">
                        <nue-text v-for="(item, idx) in value" :key="idx" size="12px">
                            {{ `-&nbsp;&nbsp;${item}` }}
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
        '实现标签管理中的标签颜色修改',
        '实现 TagManager 中的标签颜色修改功能',
        '实现列表的多项选择以及对应操作',
        '实现 TodoTagBar 的 “溢出隐藏” 功能'
    ],
    'BugFix & Patch': [
        '在创建待办事项对话框中点击日期清除按钮时无响应',
        '在创建待办事项对话框中选择清单时能够选择已删除的清单',
        '修复相对时间的显示错误（天数小于一个月但显示 1 月前）',
        '修复 TodoDetailsV2 中清除结束日期时的错误',
        '为 TodoDetailsV2 中的 “设置结束时间” 功能增加防抖机制',
        '修复了标签栏添加标签时的显示问题',
        '修复了列表视图排序后点击打开待办详细时数据错乱的问题',
        '修复 TodoTagBar Clamped 时显示错误的问题',
        '完善 TodoMultiDetails 中 “取消选择” 按钮的功能',
        '优化多项选择的逻辑，修复多项选择的内存使用问题',
        '修复批量更新后出现多项选择取消的问题',
        '修复清单偏好无法保存的问题'
    ],
    'UI/UX': ['“任务看板” 中的过期任务结束时间需要显示为红色']
}

defineExpose({
    show: () => (visible.value = true)
})
</script>
