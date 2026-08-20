<script lang="ts" setup>
import { assetUrl } from '@nao-todo/shared'
import { useSearchView } from './search-view'

defineOptions({ name: 'SearchView' })

useSearchView()
</script>

<template>
    <nue-container>
        <nue-main>
            <nue-content fill>
                <nue-empty
                    :image-src="assetUrl('/images/feature.webp')"
                    image-size="8rem"
                    description="搜索页面还在规划中，敬请期待"
                    style="height: 100%"
                >
                    <nue-button theme="small,primary" @click="$router.back()">返回</nue-button>
                </nue-empty>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped></style>