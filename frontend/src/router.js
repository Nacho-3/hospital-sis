import { createRouter, createWebHistory } from 'vue-router';

// Cada responsable agrega aca las rutas de su modulo apuntando a sus vistas.
// Ejemplo: { path: '/admision', component: () => import('./modules/admision/views/AgendaView.vue') }
const Placeholder = { template: '<p>Pendiente de implementar.</p>' };

const routes = [
  { path: '/', component: { template: '<p>Hospital Information System</p>' } },
  { path: '/identidad', component: Placeholder },
  { path: '/admision', component: Placeholder },
  { path: '/atencion', component: Placeholder },
  { path: '/camas', component: Placeholder },
  { path: '/facturacion', component: Placeholder },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
