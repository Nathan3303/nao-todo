<template>
    <nue-div theme="hint">
        <nue-icon name="priority-2" />
        <nue-text>
            密码格式要求长度为 8 - 24 位，且包含字母、数字以及特殊符号。<br />
            允许的特殊符号包括：! @ # $ % ^ & * ? .
        </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
defineOptions({ name: 'PasswordRuleHint' })
</script>

<style scoped></style>
