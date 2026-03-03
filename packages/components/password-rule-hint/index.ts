import { defineAsyncComponent } from 'vue'

const PasswordRuleHint = defineAsyncComponent(() => import('./password-rule-hint.vue'))

export { PasswordRuleHint }
