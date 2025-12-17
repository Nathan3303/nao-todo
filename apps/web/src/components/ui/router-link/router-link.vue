<template>
    <nue-link :theme="themes" v-bind="$attrs">
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

defineOptions({ name: 'NaoRouterLink' })
const props = defineProps<NaoRouterLinkProps>()

const themes = computed(() => ({
    route: true,
    'route-icon': props.iconLink,
    [`route-${props.size}`]: props.size
}))
</script>
