<template>
  <button
    class="upload-card"
    :class="{ over: dragOver }"
    @click="$emit('click')"
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop.prevent="onDrop"
  >
    <span class="plus">+</span>
    <span class="label">{{ dragOver ? "Отпустите файл" : "Загрузить страницу" }}</span>
  </button>
</template>

<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{
  (e: "click"): void;
  (e: "files", file: File): void;
}>();
const dragOver = ref(false);

function onDrop(e: DragEvent) {
  dragOver.value = false;
  const f = e.dataTransfer?.files[0];
  if (f) emit("files", f);
}
</script>
