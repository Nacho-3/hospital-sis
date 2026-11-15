import { h } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';

// Cada responsable agrega aca las rutas de su modulo apuntando a sus vistas.
// Ejemplo: { path: '/admision', component: () => import('./modules/admision/views/AgendaView.vue') }
// El build de Vue que usa Vite no compila `template` definido en un objeto.
const Placeholder = { render: () => h('p', 'Pendiente de implementar.') };

const routes = [
  { path: '/', component: () => import('./modules/identidad/views/InicioView.vue') },
  { path: '/login', component: () => import('./modules/identidad/views/LoginView.vue') },
  { path: '/identidad/usuarios/nuevo', component: () => import('./modules/identidad/views/CrearUsuarioView.vue') },
  { path: '/identidad/usuarios', component: () => import('./modules/identidad/views/UsuariosView.vue') },
  { path: '/identidad/roles', component: () => import('./modules/identidad/views/RolesView.vue') },
  { path: '/admision', component: () => import('./modules/admision/views/AgendaView.vue') },
  { path: '/atencion', component: () => import('./modules/atencion/views/atencionView.vue') },
  { path: '/camas', component: () => import('./modules/camas/views/CamasView.vue') },
  { path: '/facturacion', component: () => import('./modules/facturacion/views/FacturacionView.vue') },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
