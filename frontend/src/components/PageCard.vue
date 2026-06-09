<template>
  <div class="card" @click="$emit('open')">
    <div class="card-mark">{{ initials }}</div>
    <div class="card-body">
      <div class="title">{{ page.title || page.file }}</div>
      <div class="card-meta">Открыть →</div>
    </div>
    <button class="del" title="Удалить" aria-label="Удалить" @click.stop="$emit('remove')">×</button>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ page: { type: Object, required: true } });
defineEmits(["open", "remove"]);

const initials = computed(() => {
  const name = (props.page.title || props.page.file || "?").trim();
  const words = name.split(/[\s_-]+/).filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
});
</script>
