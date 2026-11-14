import { h } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';

// Cada responsable agrega aca las rutas de su modulo apuntando a sus vistas.
// Ejemplo: { path: '/admision', component: () => import('./modules/admision/views/AgendaView.vue') }
// El build de Vue que usa Vite no compila `template` definido en un objeto.
const Placeholder = { render: () => h('p', 'Pendiente de implementar.') };

const routes = [
  { path: '/', component: { render: () => h('p', 'Hospital Information System') } },
  { path: '/identidad', component: Placeholder },
  { path: '/admision', component: () => import('./modules/admision/views/AgendaView.vue') },
  { path: '/atencion', component: () => import('./modules/atencion/views/atencionView.vue') },
  { path: '/camas', component: () => import('./modules/camas/views/CamasView.vue') },
  { path: '/facturacion', component: () => import('./modules/facturacion/views/FacturacionView.vue') },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
