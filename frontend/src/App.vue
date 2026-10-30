<template>
  <header>
    <h1>Chotita</h1>
    <nav class="nav-navegacion">
      <router-link to="/" class="btn-inicio">Inicio</router-link>
      <router-link to="/admision" class="btn-inicio">Admisión</router-link>
      <router-link to="/atencion" class="btn-inicio">Atención</router-link>
      <router-link to="/camas" class="btn-inicio">Camas</router-link>
      <router-link to="/facturacion" class="btn-inicio">Facturación</router-link>
    </nav>
  </header>
  <main>
    <router-view />
  </main>
</template>

<style>
.nav-navegacion {
  display: flex;
  
  margin: 1rem;
}

.btn-inicio {
  font-family: "Poppins", sans-serif, monospace;
  font-weight: bold;
  color: #030303;
  background: #afc9f8;
  padding: 0.5rem 1.78rem;
  border-radius: 0.57rem;
  text-decoration: none;
}
.btn-inicio:hover {
  background: #fd0061;
  color: #fff;
}
nav a { margin-right: 1rem; }
body {
  background: #dfe9f3;
  margin: 1rem;
}
</style>
