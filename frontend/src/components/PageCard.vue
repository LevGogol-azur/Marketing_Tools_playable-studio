<template>
  <div
    class="card"
    draggable="true"
    @click="$emit('open')"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @dragstart="$emit('dragstart')"
    @dragend="$emit('dragend')"
  >
    <div class="card-mark">{{ initials }}</div>
    <div class="card-body">
      <div class="title">{{ page.title || page.file }}</div>
      <div class="card-meta">Открыть →</div>
    </div>
    <div class="card-actions">
      <button class="icon-btn ai-btn" title="AI: изменить параметры" aria-label="AI" @click.stop="$emit('chat')">AI</button>
      <button class="icon-btn" title="Переименовать" aria-label="Переименовать" @click.stop="$emit('rename')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
      <button class="icon-btn" title="Переместить в папку" aria-label="Переместить" @click.stop="$emit('move')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      </button>
      <button class="icon-btn del" title="Удалить" aria-label="Удалить" @click.stop="$emit('remove')">×</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ page: { type: Object, required: true } });
const emit = defineEmits(["open", "remove", "move", "rename", "chat", "prefetch", "dragstart", "dragend"]);

// Prefetch on a deliberate hover (not a quick pass-through).
let hoverTimer = null;
function onEnter() {
  hoverTimer = setTimeout(() => emit("prefetch"), 120);
}
function onLeave() {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

const initials = computed(() => {
  const name = (props.page.title || props.page.file || "?").trim();
  const words = name.split(/[\s_-]+/).filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
});
</script>
