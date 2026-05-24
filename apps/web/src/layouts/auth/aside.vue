<script setup lang="ts">
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'AuthViewAside' })
</script>

<template>
    <nue-aside min-width="256px" max-width="512px" width="480px">
        <nue-div flex="1" justify="space-between" vertical>
            <nue-text color="var(--nue-primary-color-0)" size="2rem">NaoTodo</nue-text>
            <nue-text color="var(--nue-primary-color-0)" size="1rem">
                {{ t('auth.aside.tagline') }}
            </nue-text>
        </nue-div>
    </nue-aside>
</template>

<style scoped>
.nue-aside {
    background-color: var(--nue-primary-color-900);
    padding: 2rem;
    width: 36%;
    min-width: unset;
    max-width: unset;
}
</style>
