<script setup lang="ts">
/**
 * web-only 根（T115b DP-2 = B：端各自挂载点）
 * @description web 端挂载点 = `<App />` + 同步状态（显式 `syncTimeSource='mirrorPulledAt'`，
 *              取 C-60 r5 落盘的**完整拉取**时间；desktop 不挂此根，仍由 AppRoot 挂载并取默认 `'lastSync'`）。
 *              端差异只出现在端自己的挂载点，共享视图内零端条件分支。
 * @see docs/adr/2026-09-23-two-end-sync-status-unification.md
 */
import App from './App.vue'
import SyncStatusBar from './components/sync/sync-status-bar.vue'

defineOptions({ name: 'WebRoot' })
</script>

<template>
    <App />
    <SyncStatusBar :sync-time-source="'mirrorPulledAt'" />
</template>