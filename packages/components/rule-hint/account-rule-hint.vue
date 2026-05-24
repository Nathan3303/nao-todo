<script setup lang="ts">
import RuleHint from './rule-hint.vue'

defineOptions({ name: 'AccountRuleHint' })
</script>

<template>
    <rule-hint icon="priority-1" title="账号提示" v-bind="$attrs">
        账号可以是用户名或者电子邮箱。<br />
        用户名要求由 6 - 32 位字母、数字或下划线组成；<br />
        电子邮箱需要符合常规的邮箱格式要求。
    </rule-hint>
</template>

