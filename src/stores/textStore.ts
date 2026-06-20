import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const TEXT_KEY = 'ancientscrutiny_texts_v1';

const SAMPLE_ORIGINAL =
  `道可道，非常道；名可名，非常名。無名天地之始，有名萬物之母。故常無欲以觀其妙，常有欲以觀其徼。此兩者同出而異名，同謂之玄。玄之又玄，衆妙之門。\n` +
  `天地不仁，以萬物爲芻狗；聖人不仁，以百姓爲芻狗。天地之間，其猶橐籥乎？虛而不屈，動而愈出。多言數窮，不如守中。\n` +
  `谷神不死，是謂玄牝。玄牝之門，是謂天地根。綿綿若存，用之不勤。\n` +
  `太上，不知有之；其次，親而譽之；其次，畏之；其次，侮之。信不足焉，有不信焉。悠兮其貴言。功成事遂，百姓皆謂我自然。\n` +
  `大道廢，有仁義；慧智出，有大僞；六親不和，有孝慈；國家昏亂，有忠臣。\n` +
  `絕聖棄智，民利百倍；絕仁棄義，民復孝慈；絕巧棄利，盜賊無有。此三者以爲文不足，故令有所屬：見素抱樸，少私寡欲。\n` +
  `曲則全，枉則直，窪則盈，敝則新，少則得，多則惑。是以聖人抱一爲天下式。不自見，故明；不自是，故彰；不自伐，故有功；不自矜，故長。夫唯不爭，故天下莫能與之爭。古之所謂曲則全者，豈虛言哉！誠全而歸之。\n` +
  `希言自然。故飄風不終朝，驟雨不終日。孰爲此者？天地。天地尚不能久，而況於人乎？故從事於道者，道者同於道，德者同於德，失者同於失。同於道者，道亦樂得之；同於德者，德亦樂得之；同於失者，失亦樂得之。信不足焉，有不信焉。\n` +
  `有物混成，先天地生。寂兮寥兮，獨立不改，周行而不殆，可以爲天下母。吾不知其名，字之曰道，強爲之名曰大。大曰逝，逝曰遠，遠曰反。故道大，天大，地大，王亦大。域中有四大，而王居其一焉。人法地，地法天，天法道，道法自然。`;

const SAMPLE_REVISED =
  `道可道，非常道；名可名，非常名。無名天地之始，有名萬物之母。故常無欲以觀其妙，常有欲以觀其徼。此兩者同出而異名，同謂之元。元之又元，衆妙之門。\n` +
  `天地不仁，以萬物爲芻狗；聖人不仁，以百姓爲芻狗。天地之間，其猶橐籥乎？虛而不屈，動而愈出。多言數窮，不如守中。\n` +
  `谷神不死，是謂元牝。元牝之門，是謂天地根。綿綿若存，用之不勤。\n` +
  `太上，不知有之；其次，親而譽之；其次，畏之；其次，侮之。信不足焉，有不信焉。悠兮其貴言。功成事遂，百姓皆謂我宏然。\n` +
  `大道廢，有仁義；慧智出，有大僞；六親不和，有孝慈；國家昏亂，有忠臣。\n` +
  `絕聖棄智，人利百倍；絕仁棄義，人復孝慈；絕巧棄利，盜賊無有。此三者以爲文不足，故令有所屬：見素抱樸，少私寡欲。\n` +
  `曲則全，枉則直，窪則盈，敝則新，少則得，多則惑。是以聖人抱一爲天下式。不自見，故明；不自是，故彰；不自伐，故有功；不自矜，故長。夫唯不爭，故天下莫能與之爭。古之所謂曲則全者，邱虛言哉！誠全而歸之。\n` +
  `希言自然。故飄風不終朝，驟雨不終日。孰爲此者？天地。天地尚不能久，而況於人乎？故從事於道者，道者同於道，德者同於德，失者同於失。同於道者，道亦樂得之；同於德者，德亦樂得之；同於失者，失亦樂得之。信不足焉，有不信焉。\n` +
  `有物混成，先天地生。寂兮寥兮，獨立不改，周行而不殆，可以爲天下母。吾不知其名，字之曰道，強爲之名曰大。大曰逝，逝曰遠，遠曰反。故道大，天大，地大，代王亦大。域中有四大，而王居其一焉。人法地，地法天，天法道，道法自然。`;

export const useTextStore = defineStore('text', () => {
  const originalText = ref('');
  const revisedText = ref('');
  const loadedAt = ref<number | null>(null);

  function load() {
    try {
      const raw = localStorage.getItem(TEXT_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        originalText.value = data.originalText || '';
        revisedText.value = data.revisedText || '';
        loadedAt.value = data.loadedAt || null;
      } else {
        originalText.value = SAMPLE_ORIGINAL;
        revisedText.value = SAMPLE_REVISED;
        loadedAt.value = Date.now();
        persist();
      }
    } catch {
      originalText.value = SAMPLE_ORIGINAL;
      revisedText.value = SAMPLE_REVISED;
      loadedAt.value = Date.now();
    }
  }

  function persist() {
    localStorage.setItem(
      TEXT_KEY,
      JSON.stringify({
        originalText: originalText.value,
        revisedText: revisedText.value,
        loadedAt: loadedAt.value,
      }),
    );
  }

  function setTexts(original: string, revised: string) {
    originalText.value = original;
    revisedText.value = revised;
    loadedAt.value = Date.now();
    persist();
  }

  function clearTexts() {
    originalText.value = '';
    revisedText.value = '';
    loadedAt.value = null;
    localStorage.removeItem(TEXT_KEY);
  }

  function loadSample() {
    originalText.value = SAMPLE_ORIGINAL;
    revisedText.value = SAMPLE_REVISED;
    loadedAt.value = Date.now();
    persist();
  }

  const originalCharCount = computed(() => originalText.value.length);
  const revisedCharCount = computed(() => revisedText.value.length);
  const hasBothTexts = computed(() => originalText.value.trim().length > 0 && revisedText.value.trim().length > 0);

  return {
    originalText,
    revisedText,
    loadedAt,
    originalCharCount,
    revisedCharCount,
    hasBothTexts,
    load,
    setTexts,
    clearTexts,
    loadSample,
  };
});
