<template>
    <nue-container theme="vertical,inner" class="index-ai-view">
        <nue-header>
            <nue-text size="var(--text-lg)">对话大模型</nue-text>
        </nue-header>
        <nue-main>
            <template #content>
                <nue-div
                    theme="card"
                    vertical
                    align="stretch"
                    style="overflow: hidden"
                >
                    <nue-div v-if="thinktext" vertical gap="8px">
                        <nue-button
                            theme="pure"
                            @click="isCollapseThinking = !isCollapseThinking"
                        >
                            {{ isCollapseThinking ? '展开' : '收起' }}推理文本
                        </nue-button>
                        <nue-text
                            theme="completion"
                            color="var(--primary-color-500)"
                            size="var(--text-sm)"
                            :clamped="isCollapseThinking ? 1 : void 0"
                        >
                            {{ thinktext }}
                        </nue-text>
                    </nue-div>
                    <template v-if="markdownContent">
                        <nue-divider
                            border-color="orange"
                            border-width="2px"
                            border-type="dashed"
                        />
                        <nue-button
                            theme="pure"
                            @click="isShowRawText = !isShowRawText"
                        >
                            显示{{ isShowRawText ? 'Markdown' : '原文' }}
                        </nue-button>
                        <div
                            v-html="
                                isShowRawText ? completion : markdownContent
                            "
                            :style="
                                isShowRawText
                                    ? { whiteSpace: 'pre-wrap' }
                                    : void 0
                            "
                        ></div>
                    </template>
                </nue-div>
            </template>
        </nue-main>
        <nue-footer>
            <nue-div align="start">
                <nue-textarea
                    theme="msg-input"
                    v-model="message"
                    :rows="0"
                    autosize
                    placeholder="请输入消息"
                    :disabled="waitingForCompletion"
                />
                <nue-button
                    @click="sendMessage"
                    :loading="waitingForCompletion"
                >
                    {{ waitingForCompletion ? '回复中 ...' : '发送' }}
                </nue-button>
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useSSE } from '@nao-todo/hooks'
import MarkdownIt from 'markdown-it'
import { baseURL } from '@nao-todo/utils/axios'

const { connect, close } = useSSE(`${baseURL}/ai/chat`)

const waitingForCompletion = ref(false)
const message = ref('比较 9.9 和 9.11 哪个大。')
const thinktext = ref('')
const completion = ref('')
const markdownContent = ref('')
const isCollapseThinking = ref(false)
const isShowRawText = ref(false)

const clear = () => {
    completion.value = ''
    thinktext.value = ''
    markdownContent.value = ''
}

const sendMessage = () => {
    const md = new MarkdownIt()
    let state: 1 | 0 = 1
    waitingForCompletion.value = true

    clear()

    const parseResponse = (response: string) => {
        const content = decodeURIComponent(atob(response))
        // const content = response
        if (!content || content === 'null') return
        switch (state) {
            case 1:
                thinktext.value += content
                break
            case 0:
                completion.value += content
                markdownContent.value = md.render(completion.value)
                break
        }
    }

    const messageHandler = (event: MessageEvent) => {
        switch (event.data) {
            case '#--EOC--#':
                waitingForCompletion.value = false
                break
            case '#--SOT--#':
                state = 1
                break
            case '#--EOT--#':
                state = 0
                break
            default:
                parseResponse(event.data)
                break
        }
    }

    const errorHandler = () => {
        waitingForCompletion.value = false
        close()
    }

    connect('?message=' + message.value, messageHandler, errorHandler)
}

onBeforeUnmount(() => {
    close()
})
</script>

<style scoped>
.nue-textarea--msg-input {
    flex: auto;
}

.nue-div--card {
    margin: 1rem;
    width: calc(100% - 2rem);
    font-size: var(--text-sm);

    .nue-button--pure {
        --color: orange;
        --hover-color: orange;
    }
}

.nue-text--completion {
    white-space: pre-wrap;
}
</style>
