import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import router from './router';
import { useRuleStore } from '@/stores/ruleStore';
import { useTextStore } from '@/stores/textStore';
import { useDiffStore } from '@/stores/diffStore';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.mount('#app');

const ruleStore = useRuleStore();
const textStore = useTextStore();
const diffStore = useDiffStore();
ruleStore.load();
textStore.load();
diffStore.load();
