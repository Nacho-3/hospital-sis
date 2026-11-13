require('dotenv').config();
const pool = require('../../../shared/db/pool');
const usuariosServicio = require('../servicio/usuarios.servicio');
const { UsuarioExistenteError } = require('../dominio/errores');

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Faltan ADMIN_EMAIL y ADMIN_PASSWORD en el .env');
  }

  const roles = await usuariosServicio.listarRoles();
  const rolAdmin = roles.find((r) => r.codigo === 'ADMINISTRADOR');
  if (!rolAdmin) {
    throw new Error('No existe el rol ADMINISTRADOR. Levantá el servidor una vez para aplicar el esquema.');
  }

  try {
    const admin = await usuariosServicio.crear({
      email: ADMIN_EMAIL,
      nombre: 'Administrador',
      apellido: 'Sistema',
      password: ADMIN_PASSWORD,
      roles: [rolAdmin.id],
    });
    console.log('Admin creado:', admin);
  } catch (err) {
    if (err instanceof UsuarioExistenteError) {
      console.log('El admin ya existe');
    } else {
      throw err;
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());