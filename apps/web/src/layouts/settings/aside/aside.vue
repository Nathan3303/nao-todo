<script setup lang="ts">
import { SettingsViewRouteLinks as routeLinks } from '@/views/index/settings/routes'

defineOptions({ name: 'SettingsAside' })
</script>

<template>
    <nue-aside>
        <nue-div vertical gap=".5rem">
            <nue-link
                v-for="(link, idx) in routeLinks"
                :icon="link.icon as never"
                :key="idx"
                :route="link.route"
                theme="route,route-small"
            >
                {{ link.name }}
            </nue-link>
        </nue-div>
    </nue-aside>
</template>

