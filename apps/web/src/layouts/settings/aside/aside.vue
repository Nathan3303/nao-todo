<script setup lang="ts">
import { SettingsViewRouteLinks as routeLinks } from '@/views/settings/routes'

defineOptions({ name: 'SettingsAside' })
</script>

<template>
    <nue-aside>
        <nue-div vertical align="stretch" gap=".5rem">
            <nue-link
                v-for="(link, idx) in routeLinks"
                :icon="(link.icon as never)"
                :key="idx"
                :route="link.route"
                theme="route"
            >
                {{ link.name }}
            </nue-link>
        </nue-div>
    </nue-aside>
</template>

<style scoped></style>
