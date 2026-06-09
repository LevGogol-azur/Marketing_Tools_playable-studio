<template>
  <div class="viewer">
    <div class="bar">
      <button @click="$emit('back')">← Назад</button>
      <span class="vtitle">{{ title }}</span>
      <button :disabled="!url" @click="openTab">Открыть в новой вкладке</button>
    </div>
    <div class="viewer-body">
      <div v-if="showLoader" class="loader-overlay">
        <div class="spinner"></div>
        <div class="loader-text">Загрузка страницы…</div>
      </div>
      <iframe v-show="url" :src="url || 'about:blank'" title="Playable" @load="onLoad"></iframe>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  title: { type: String, default: "" },
  url: { type: String, default: "" },
  loading: { type: Boolean, default: false },
});
defineEmits(["back"]);

const frameLoaded = ref(false);

// New page → reset the iframe-loaded flag so the loader shows again.
watch(() => props.url, () => { frameLoaded.value = false; });

// Loader is shown while fetching the blob, and afterwards until the iframe finishes rendering.
const showLoader = computed(() => props.loading || !props.url || !frameLoaded.value);

function onLoad() {
  if (props.url) frameLoaded.value = true;
}
function openTab() {
  if (props.url) window.open(props.url, "_blank", "noopener");
}
</script>
