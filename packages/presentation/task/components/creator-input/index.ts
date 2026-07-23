// ============== 类型导出 ==============
export type {
  Token,
  TokenType,
  SuggestionItem,
  SuggestionResult,
  ParsedResult,
  TaskCreatorInputValue,
  TaskCreatorInputProps,
  TaskCreatorInputEmits,
  SelectOption,
  TriggerConfig,
  CursorPosition,
  PriorityValue,
  StateValue
} from './types'

// ============== 常量导出 ==============
export {
  TRIGGER_CONFIGS,
  CHAR_TO_TYPE,
  TYPE_TO_CHAR,
  PRIORITY_ALIASES,
  STATE_ALIASES,
  TOKEN_REGEX,
  TRIGGER_CHARS,
  BOUNDARY_REGEX,
  DEBOUNCE_DELAY,
  AUTOCOMPLETE_CONFIG,
  TOKEN_COLORS,
  NAV_KEYS
} from './constants'

// ============== 工具函数导出 ==============
export {
  tokenize,
  detectCursorPosition,
  replaceRange,
  deleteTokenAtCursor
} from './utils/tokenizer'

export {
  TaskParser,
  parseTaskText,
  reconstructInputText,
  getSuggestions
} from './utils/parser'

export {
  renderHighlightedHTML,
  getTokenTextColor,
  getTokenBgColor,
  getHighlightRanges,
  getTokenDisplayConfig,
  getUniqueChips,
  extractPlainText,
  getSyntaxHintPlaceholder
} from './utils/highlighter'

// ============== 组件导出 ==============
export { default as TaskCreatorInput } from './TaskCreatorInput.vue'
export { default as SmartInput } from './components/SmartInput.vue'
export { default as AutocompletePopover } from './components/AutocompletePopover.vue'
export { default as ParsedChips } from './components/ParsedChips.vue'

// ============== Composable 导出 ==============
export { default as useSmartParser } from './composables/useSmartParser'
export { default as useAutocomplete } from './composables/useAutocomplete'
export { default as useKeyboardNav } from './composables/useKeyboardNav'
