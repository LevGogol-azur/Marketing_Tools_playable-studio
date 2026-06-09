<template>
  <div class="viewer">
    <div class="bar">
      <button @click="$emit('back')">← Назад</button>
      <span class="vtitle">{{ title }}</span>
      <button :disabled="!url" @click="openTab">Открыть в новой вкладке</button>
    </div>
    <iframe :src="url || 'about:blank'" title="Playable"></iframe>
  </div>
</template>

<script setup>
const props = defineProps({
  title: { type: String, default: "" },
  url: { type: String, default: "" },
});
defineEmits(["back"]);

function openTab() {
  if (props.url) window.open(props.url, "_blank", "noopener");
}
</script>
