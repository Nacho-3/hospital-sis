<template>
  <header class="barra">
    <h1 class="barra__marca">Chotita</h1>
    <nav class="barra__nav">
      <router-link to="/" class="barra__link" active-class="" exact-active-class="barra__link--activo">Inicio</router-link>
      <router-link to="/admision" class="barra__link" active-class="barra__link--activo">Admisión</router-link>
      <router-link to="/atencion" class="barra__link" active-class="barra__link--activo">Atención</router-link>
      <router-link to="/camas" class="barra__link" active-class="barra__link--activo">Camas</router-link>
      <router-link to="/facturacion" class="barra__link" active-class="barra__link--activo">Facturación</router-link>
    </nav>
  </header>
  <main class="contenido">
    <router-view />
  </main>
</template>
