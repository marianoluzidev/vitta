// Import Vue
import { createApp } from 'vue';

// Import Framework7
import Framework7 from 'framework7/lite-bundle';

// Import Framework7-Vue Plugin
import Framework7Vue, { registerComponents } from 'framework7-vue/bundle';

// Import Framework7 Styles
import 'framework7/css/bundle';

// Fuentes de iconos (paths resueltos por Vite desde node_modules)
import 'framework7-icons/css/framework7-icons.css';
import 'material-icons/iconfont/material-icons.css';

// App Custom Styles
import '../css/app.css';

// Import App Component
import App from '../components/app.vue';

// Import Vue Router
import router from '../router/index';

// Import Firebase
import { initFirebase } from '../firebase/firebase';

// Import Auth
import { setupAuthListener } from '../auth/session';

// Init Framework7-Vue Plugin
Framework7.use(Framework7Vue);

console.log('ENV CHECK PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
console.log('ENV CHECK API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? 'OK' : 'MISSING');

// Initialize Firebase
initFirebase();

// Setup auth listener
setupAuthListener();

// Init App
const app = createApp(App);

// Register Framework7 Vue components
registerComponents(app);

// Use Vue Router
app.use(router);

// Mount the app
app.mount('#app');