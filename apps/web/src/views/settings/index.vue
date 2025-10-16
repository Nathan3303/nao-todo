<script lang="ts" setup>
import { SettingsAside } from '@/layouts/settings'
</script>

<template>
    <nue-container id="SettingsViewContainer">
        <nue-main>
            <settings-aside />
            <nue-content fill>
                <router-view />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style>
.settings-view__form-row {
    gap: 0.5rem;
    flex-direction: column;
    width: min(100%, 32rem);
    align-items: stretch;
}
</style>
