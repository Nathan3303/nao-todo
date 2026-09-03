import { defineAsyncComponent } from 'vue'
import RuleHint from './rule-hint.vue'

const PasswordRuleHint = defineAsyncComponent(() => import('./password-rule-hint.vue'))
const AccountRuleHint = defineAsyncComponent(() => import('./account-rule-hint.vue'))

export { RuleHint, PasswordRuleHint, AccountRuleHint }