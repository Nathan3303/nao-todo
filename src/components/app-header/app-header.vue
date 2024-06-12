<template>
    <nue-header>
        <template #logo>
            <nue-link href="/">
                <nue-text size="26px">NaoTodo</nue-text>
            </nue-link>
        </template>
        <template #nav>
            <nue-div>
                <nue-link theme="btnlike" icon="board">Dashboard</nue-link>
                <nue-link theme="btnlike,actived" icon="projects">Projects</nue-link>
                <nue-link theme="btnlike" icon="todo">Tasks</nue-link>
            </nue-div>
        </template>
        <template #ops>
            <nue-button theme="icon-only" icon="search"></nue-button>
            <nue-badge dot>
                <nue-button theme="icon-only" icon="ring"></nue-button>
            </nue-badge>
        </template>
        <template #user>
            <nue-dropdown trigger="hover" align="right">
                <nue-avatar
                    src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                ></nue-avatar>
                <template #dropdown>
                    <nue-div vertical align="center" justify="center" width="240px" gap="32px">
                        <nue-div vertical align="center">
                            <nue-avatar
                                src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                                size="64px"
                            ></nue-avatar>
                            <nue-text> HAHAHA </nue-text>
                        </nue-div>
                        <nue-div vertical align="stretch" gap="8px">
                            <nue-link theme="btnlike">Profile</nue-link>
                            <nue-link theme="btnlike">Settings</nue-link>
                            <nue-divider></nue-divider>
                            <nue-link theme="btnlike">Logout</nue-link>
                        </nue-div>
                    </nue-div>
                </template>
            </nue-dropdown>
        </template>
    </nue-header>
</template>

<script setup lang="ts">
defineOptions({ name: 'AppHeader' })
</script>

<style scoped></style>
