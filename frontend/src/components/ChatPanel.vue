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
          Спросите, что можно изменить в этом билдере, или попросите поменять параметр —
          например: «какие параметры можно менять?» или «сделай 5 жизней».
        </div>

        <template v-for="(m, i) in messages" :key="i">
          <div v-if="m.role === 'user'" class="msg msg-user">{{ m.content }}</div>
          <div v-else class="msg msg-ai">
            <div v-if="m.content" class="msg-text">{{ m.content }}</div>

            <div v-if="m.proposal && m.proposal.edits.length" class="proposal">
              <div class="proposal-sum">{{ m.proposal.summary }}</div>
              <ul class="proposal-edits">
                <li v-for="(e, j) in m.proposal.edits" :key="j">
                  <div class="edit-reason">{{ e.reason }}</div>
                  <div class="edit-diff">
                    <code class="del">{{ short(e.find) }}</code>
                    <span class="arrow">→</span>
                    <code class="add">{{ short(e.replace) }}</code>
                  </div>
                </li>
              </ul>
              <div v-if="m.applied" class="proposal-done">✅ Применено — новая карточка «{{ page.title }} (AI)» создана.</div>
              <div v-else-if="m.applyError" class="proposal-err">{{ m.applyError }}</div>
              <div v-else class="proposal-actions">
                <button class="btn btn-ghost btn-sm" @click="dismiss(m)">Отклонить</button>
                <button class="btn btn-primary btn-sm" :disabled="applying" @click="apply(m)">
                  <span v-if="applying" class="spinner-sm"></span>{{ applying ? "Применение…" : "Применить" }}
                </button>
              </div>
            </div>
          </div>
        </template>

        <div v-if="busy" class="msg msg-ai"><span class="spinner-sm"></span>Думаю…</div>
        <div v-if="error" class="chat-error">{{ error }}</div>
      </div>

      <form class="chat-input" @submit.prevent="send">
        <input
          v-model="draft"
          type="text"
          placeholder="Напишите сообщение…"
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
const emit = defineEmits(["close", "applied"]);

const messages = ref([]); // { role, content, proposal?, applied?, applyError? }
const draft = ref("");
const busy = ref(false);
const applying = ref(false);
const error = ref("");
const bodyEl = ref(null);

function short(s) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}

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
  busy.value = true;
  scrollDown();
  try {
    // Send only role/content history (no proposal objects) to the server.
    const history = messages.value.map((m) => ({ role: m.role, content: m.content || "" }));
    const res = await api.chatWithBuilder(props.server, props.page.file, history);
    messages.value.push({ role: "assistant", content: res.reply || "", proposal: res.proposal || null });
  } catch (e) {
    error.value = "⚠️ " + e.message;
  } finally {
    busy.value = false;
    scrollDown();
  }
}

function dismiss(m) {
  m.proposal = null;
}

async function apply(m) {
  applying.value = true;
  m.applyError = "";
  try {
    await api.applyChanges(props.server, props.page.file, m.proposal.edits, props.page.title);
    m.applied = true;
    emit("applied");
  } catch (e) {
    m.applyError = "⚠️ " + e.message + " — попробуйте переспросить AI.";
  } finally {
    applying.value = false;
    scrollDown();
  }
}
</script>
