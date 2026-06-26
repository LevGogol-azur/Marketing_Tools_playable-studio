<template>
  <div class="chat-overlay" @click.self="$emit('close')">
    <aside class="chat-panel">
      <header class="chat-head">
        <div class="chat-title">
          <span class="chat-ai">AI</span>
          <span class="chat-name">{{ page.title || page.file }}</span>
        </div>
        <button class="icon-btn" title="Закрыть" @click="$emit('close')">×</button>
      </header>

      <div class="chat-body" ref="bodyEl">
        <div v-if="!messages.length" class="chat-hint">
          Опишите, что изменить в этом билдере — например: «сделай надпись
          вертикальной» или «поменяй CTA на “Играть”». Агент создаст новый AI-вариант.
        </div>

        <template v-for="(m, i) in messages" :key="i">
          <div v-if="m.role === 'user'" class="msg msg-user">{{ m.content }}</div>
          <div v-else class="msg msg-ai">
            <div v-if="m.content" class="msg-text">{{ m.content }}</div>

            <!-- Result of an agent run: open the new -ai copy in the viewer. -->
            <div v-if="m.page" class="proposal-actions">
              <button class="btn btn-primary btn-sm" @click="$emit('open', m.page)">
                Открыть результат
              </button>
            </div>
          </div>
        </template>

        <div v-if="busy" class="msg msg-ai"><span class="spinner-sm"></span>Агент работает…</div>
        <div v-if="error" class="chat-error">{{ error }}</div>
      </div>

      <form class="chat-input" @submit.prevent="send">
        <input
          v-model="draft"
          type="text"
          placeholder="Что изменить в билдере…"
          :disabled="busy"
        />
        <button class="btn btn-primary" type="submit" :disabled="busy || !draft.trim()">→</button>
      </form>
    </aside>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import * as api from "../api.js";

const props = defineProps({
  server: { type: String, required: true },
  page: { type: Object, required: true },
});
const emit = defineEmits(["close", "open", "created"]);

const messages = ref([]); // { role, content, page? }
const draft = ref("");
const busy = ref(false);
const error = ref("");
const bodyEl = ref(null);

async function scrollDown() {
  await nextTick();
  if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight;
}

async function send() {
  const content = draft.value.trim();
  if (!content || busy.value) return;
  draft.value = "";
  error.value = "";
  messages.value.push({ role: "user", content });

  messages.value.push({ role: "assistant", content: "" });
  const aiMsg = messages.value[messages.value.length - 1];

  busy.value = true;
  scrollDown();
  try {
    const newPage = await api.runAgent(props.server, props.page.file, content, {
      onTextCallback: (text) => {
        aiMsg.content += text;
        scrollDown();
      },
    });
    if (newPage) {
      aiMsg.page = newPage; // page.file -> open this in the viewer
      emit("created", newPage); // let the parent refresh the list
    }
  } catch (e) {
    error.value = "⚠️ " + e.message;
  } finally {
    busy.value = false;
    scrollDown();
  }
}
</script>
