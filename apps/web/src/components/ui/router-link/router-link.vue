<template>
    <nue-link :theme="theme" :route="route">
        <slot />
        <template v-if="$slots.append" #append>
            <nue-div align="center" justify="end" width="fit-content" flex="1">
                <slot name="append" />
            </nue-div>
        </template>
    </nue-link>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NueLink } from 'nue-ui'
import type { NaoRouterLinkProps } from './types'
import './router-link.css'

defineOptions({ name: 'NaoRouterLink' })
const props = defineProps<NaoRouterLinkProps>()

const theme = computed(() => {
    return {
        route: true,
        'route-ico': props.iconLink,
        [`route-${props.size}`]: props.size
    }
})

const route = computed(() => {
    return props.to ? { path: props.to } : void 0
})
</script>
