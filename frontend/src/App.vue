<template>
  <header>
    <h1>HIS</h1>
    <nav>
      <router-link to="/">Inicio</router-link>
      <router-link to="/admision">Admisión</router-link>
      <router-link to="/atencion">Atención</router-link>
      <router-link to="/camas">Camas</router-link>
      <router-link to="/facturacion">Facturación</router-link>
    </nav>
  </header>
  <main>
    <router-view />
  </main>
</template>

<style>
nav a { margin-right: 1rem; }
</style>
