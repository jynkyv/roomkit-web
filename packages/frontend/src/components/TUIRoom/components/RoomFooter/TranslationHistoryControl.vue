<template>
  <div class="translation-history-control-container">
    <icon-button
      :title="t('Translation History')"
      :is-active="basicStore.sidebarName === 'translationHistory'"
      @click-icon="toggleTranslationHistorySidebar"
    >
      <IconMore size="24" />
    </icon-button>
  </div>
</template>

<script setup lang="ts">
import { IconMore } from '@tencentcloud/uikit-base-component-vue3';
import IconButton from '../common/base/IconButton.vue';
import { useI18n } from '../../../../locales';
import { useBasicStore } from '../../stores/basic';
import { storeToRefs } from 'pinia';

// 国际化
const { t } = useI18n();

// 使用基础存储
const basicStore = useBasicStore();


// 方法
const toggleTranslationHistorySidebar = () => {
  if (basicStore.sidebarName === 'translationHistory') {
    basicStore.setSidebarName('');
    return;
  }
  basicStore.setSidebarName('translationHistory');
};
</script>

<style scoped>
.translation-history-control-container {
  position: relative;
}
</style>
