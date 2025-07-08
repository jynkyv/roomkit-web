import i18n from '../../../locales/index';
import { computed } from 'vue';
import { useI18n } from '../../../locales';
export default function useRoomControl() {
  const isJA = computed(() => i18n.global.locale.value === 'ja-JP');

  const { t } = useI18n();

  return {
    isJA,
    t,
  };
}
