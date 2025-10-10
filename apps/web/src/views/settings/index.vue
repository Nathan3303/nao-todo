<template>
    <nue-container id="SettingsViewContainer">
        <nue-main>
            <nue-aside>
                <nue-link
                    v-for="(link, idx) in routeLinks"
                    :icon="(link.icon as never)"
                    :key="idx"
                    :route="link.route"
                    theme="route"
                >
                    {{ link.name }}
                </nue-link>
            </nue-aside>
            <nue-content fill>
                <router-view />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { SettingsViewRouteLinks as routeLinks } from './routes'
</script>

<style>
.settings-view__form-row {
    gap: 0.5rem;
    flex-direction: column;
    width: min(100%, 32rem);
    align-items: stretch;
}
</style>
