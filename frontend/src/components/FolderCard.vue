<template>
  <div
    class="card folder-card"
    :class="{ 'drop-over': dragOver }"
    @click="$emit('open')"
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop.prevent="onDrop"
  >
    <div class="card-mark folder-mark">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    </div>
    <div class="card-body">
      <div class="title">{{ name }}</div>
      <div class="card-meta">Открыть папку →</div>
    </div>
    <span class="count count-right">{{ count }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(defineProps<{ name: string; count?: number }>(), { count: 0 });
const emit = defineEmits<{
  (e: "open"): void;
  (e: "drop-page", name: string): void;
}>();

const dragOver = ref(false);
function onDrop() {
  dragOver.value = false;
  emit("drop-page", props.name);
}
</script>
