<template>
    <nue-container id="SettingsPasswordViewContainer">
        <nue-header>
            <nue-text>设置 - 修改密码</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill style="padding: 1rem">
                <settings-password-form />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { SettingsPasswordForm } from '@/components/settings'
</script>

<style scoped></style>
