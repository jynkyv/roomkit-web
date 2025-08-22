<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { UIKitProvider } from '@tencentcloud/uikit-base-component-vue3';
import SubtitleOverlay from './components/SubtitleOverlay.vue';
import TranslationHistoryDrawer from './components/TranslationHistoryDrawer.vue';

// 历史记录显示状态
const showHistoryDrawer = ref(false);

// 监听历史记录切换事件
const handleToggleHistory = (event: CustomEvent) => {
  showHistoryDrawer.value = event.detail.show;
};

onMounted(() => {
  window.addEventListener('toggle-translation-history', handleToggleHistory as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('toggle-translation-history', handleToggleHistory as EventListener);
});
</script>

<template>
  <UIKitProvider :theme="{ themeStyle: 'light', primaryColor: 'theme' }">
    <div id="app">
      <router-view />
      <!-- 全局字幕组件 - 完全独立，不依赖任何props -->
      <SubtitleOverlay />
      <!-- 全局翻译历史记录组件 -->
      <TranslationHistoryDrawer 
        v-model:showHistoryDrawer="showHistoryDrawer"
      />
    </div>
  </UIKitProvider>
</template>

<style lang="scss">
  html,body,#app{
        height: 100%;
    }
  #app {
    overflow: hidden;
  }
</style>
