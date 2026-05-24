<template>
    <rule-hint icon="priority-2" :title="t('component.passwordHint.title')" v-bind="$attrs">
        {{ t('component.passwordHint.content') }}
    </rule-hint>
</template>

<script setup lang="ts">
import RuleHint from './rule-hint.vue'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'PasswordRuleHint' })
</script>

