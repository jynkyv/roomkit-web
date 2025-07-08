<template>
  <icon-button
    v-if="languageConfig.visible"
    :title="title"
    :layout="IconButtonLayout.HORIZONTAL"
    :icon="IconLanguage"
    @click-icon="handleChange"
  />
</template>

<script setup lang="ts">
import IconButton from './base/IconButton.vue';
import { IconButtonLayout } from '../../constants/room';
import { IconLanguage } from '@tencentcloud/uikit-base-component-vue3';
import { useBasicStore } from '../../stores/basic';
import i18n from '../../locales/index';
import { computed } from 'vue';
import { roomService } from '../../services';

const basicStore = useBasicStore();

const title = computed(() => {
  switch (basicStore.lang) {
    case 'ja-JP':
      return '日本語';
    case 'zh-CN':
    default:
      return '中文';
  }
});

const languageConfig = roomService.getComponentConfig('Language');

const handleChange = () => {
  const currentLang = i18n.global.locale.value;
  const nextLang = currentLang === 'zh-CN' ? 'ja-JP' : 'zh-CN';
  roomService.setLanguage(nextLang);
};
</script>

<style></style>
