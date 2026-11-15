import { h } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { haySesion } from './modules/identidad/services/sesion.js';

// Cada responsable agrega aca las rutas de su modulo apuntando a sus vistas.
// Ejemplo: { path: '/admision', component: () => import('./modules/admision/views/AgendaView.vue') }
// El build de Vue que usa Vite no compila `template` definido en un objeto.
const Placeholder = { render: () => h('p', 'Pendiente de implementar.') };

const routes = [
  { path: '/', component: () => import('./modules/identidad/views/InicioView.vue') },
  { path: '/login', component: () => import('./modules/identidad/views/LoginView.vue'), meta: { publica: true } },
  { path: '/identidad', component: () => import('./modules/identidad/views/IdentidadView.vue') },
  { path: '/admision', component: () => import('./modules/admision/views/AgendaView.vue') },
  { path: '/atencion', component: () => import('./modules/atencion/views/atencionView.vue') },
  { path: '/camas', component: () => import('./modules/camas/views/CamasView.vue') },
  { path: '/facturacion', component: () => import('./modules/facturacion/views/FacturacionView.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  if (to.meta.publica) {
    return haySesion.value ? '/' : true;
  }
  return haySesion.value ? true : { path: '/login', query: { volver: to.fullPath } };
});

export default router;
