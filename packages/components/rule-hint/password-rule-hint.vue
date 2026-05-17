<template>
    <rule-hint icon="priority-2" :title="t('settings.passwordRuleHintTitle')" v-bind="$attrs">
        {{ t('settings.passwordRuleHintContent') }}
    </rule-hint>
</template>

<script setup lang="ts">
import RuleHint from './rule-hint.vue'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'PasswordRuleHint' })
</script>

