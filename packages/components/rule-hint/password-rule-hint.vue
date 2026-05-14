<template>
    <rule-hint icon="priority-2" title="密码提示" v-bind="$attrs">
        密码格式要求长度为 8 - 24 位，且包含字母、数字以及特殊符号。<br />
        允许的特殊符号包括：! @ # $ % ^ & * ? .
    </rule-hint>
</template>

<script setup lang="ts">
import RuleHint from './rule-hint.vue'

defineOptions({ name: 'PasswordRuleHint' })
</script>

