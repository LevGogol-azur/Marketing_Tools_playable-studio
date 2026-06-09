<template>
  <div class="card" @click="$emit('open')">
    <div class="title">{{ page.title || page.file }}</div>
    <button class="del" title="Удалить" @click.stop="$emit('remove')">×</button>
  </div>
</template>

<script setup>
defineProps({ page: { type: Object, required: true } });
defineEmits(["open", "remove"]);
</script>
