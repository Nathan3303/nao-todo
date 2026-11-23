<script setup lang="ts">
import { CommandPalette, ShortcutsHelp } from './components/command-palette'
import useApp from './app'

defineOptions({ name: 'AppView' })

useApp()
</script>

<template>
    <router-view />
    <!-- 全局命令的两个可见面（T766 / Issue #371）：Ctrl/⌘+K 命令面板 · ? 快捷键帮助 -->
    <CommandPalette />
    <ShortcutsHelp />
</template>