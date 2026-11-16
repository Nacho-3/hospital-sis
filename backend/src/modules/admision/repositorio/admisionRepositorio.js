const { DatosInvalidosError } = require('../dominio/errores');

const SELECT_TURNO = `
  SELECT t.id, t.medico_id, t.paciente_id, t.inicio, t.fin, t.estado,
         t.es_entreturno, t.duracion_reducida,
         m.nombre AS medico_nombre, m.apellido AS medico_apellido,
         p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
    FROM turnos t
    JOIN usuarios m ON m.id = t.medico_id
    LEFT JOIN pacientes p ON p.id = t.paciente_id
`;

async function crearPaciente(db, { nombre, apellido, documento }) {
  const { rows } = await db.query(
    `INSERT INTO pacientes (nombre, apellido, documento)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, apellido, documento`,
    [nombre, apellido, documento]
  );
  return rows[0];
}

async function listarPacientes(db) {
  const { rows } = await db.query(
    `SELECT id, nombre, apellido, documento
       FROM pacientes
      ORDER BY apellido, nombre`
  );
  return rows;
}

async function existePaciente(db, pacienteId) {
  const { rowCount } = await db.query('SELECT 1 FROM pacientes WHERE id = $1', [pacienteId]);
  return rowCount > 0;
}

async function listarMedicos(db) {
  const { rows } = await db.query(
    `SELECT u.id, u.nombre, u.apellido
       FROM usuarios u
       JOIN usuario_rol ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
      WHERE r.codigo = 'MEDICO' AND u.activo
      ORDER BY u.apellido, u.nombre`
  );
  return rows;
}

async function crearTurno(db, { medicoId, inicio, fin }) {
  const { rows } = await db.query(
    `INSERT INTO turnos (medico_id, inicio, fin)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [medicoId, inicio, fin]
  );
  return obtenerTurno(db, rows[0].id);
}

async function listarTurnos(db) {
  const { rows } = await db.query(`${SELECT_TURNO} ORDER BY t.inicio, t.id`);
  return rows;
}

async function obtenerTurno(db, turnoId) {
  const { rows } = await db.query(`${SELECT_TURNO} WHERE t.id = $1`, [turnoId]);
  return rows[0] || null;
}

// Bloqueo pesimista. La fila queda tomada hasta el COMMIT o el ROLLBACK
// de esta transaccion. La otra operacion sobre el mismo turno espera aca.
async function bloquearTurno(db, turnoId) {
  const { rows } = await db.query(
    `SELECT id, estado, paciente_id, medico_id, inicio, fin,
            es_entreturno, duracion_reducida
       FROM turnos
      WHERE id = $1
      FOR UPDATE`,
    [turnoId]
  );
  return rows[0] || null;
}

// El WHERE repite la condicion: solo escribe si sigue libre.
// Si la otra transaccion ya lo paso a programado, no devuelve fila.
async function marcarProgramado(db, turnoId, pacienteId) {
  const { rows } = await db.query(
    `UPDATE turnos
        SET paciente_id = $2, estado = 'programado', actualizado_en = NOW()
      WHERE id = $1 AND estado = 'disponible'
      RETURNING id`,
    [turnoId, pacienteId]
  );
  return rows[0] || null;
}

// HU 1.2. Achica el fin del turno que ya estaba. El WHERE exige que el fin
// nuevo quede antes del actual: si otra transaccion ya lo partio, no escribe.
async function achicarTurno(db, turnoId, finNuevo) {
  const { rows } = await db.query(
    `UPDATE turnos
        SET fin = $2, duracion_reducida = TRUE, actualizado_en = NOW()
      WHERE id = $1
        AND fin > $2
        AND estado IN ('disponible', 'programado')
      RETURNING id`,
    [turnoId, finNuevo]
  );
  return rows[0] || null;
}

// El entreturno nace libre. es_entreturno lo marca para la agenda del medico.
async function crearEntreturno(db, { medicoId, inicio, fin }) {
  const { rows } = await db.query(
    `INSERT INTO turnos (medico_id, inicio, fin, es_entreturno)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id`,
    [medicoId, inicio, fin]
  );
  return obtenerTurno(db, rows[0].id);
}

async function existeMedico(db, medicoId) {
  const { rowCount } = await db.query(
    `SELECT 1
       FROM usuarios u
       JOIN usuario_rol ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
      WHERE u.id = $1 AND r.codigo = 'MEDICO' AND u.activo`,
    [medicoId]
  );
  return rowCount > 0;
}

async function listarEnfermeros(db) {
  const { rows } = await db.query(
    `SELECT u.id, u.nombre, u.apellido
       FROM usuarios u
       JOIN usuario_rol ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
      WHERE r.codigo = 'ENFERMERO' AND u.activo
      ORDER BY u.apellido, u.nombre`
  );
  return rows;
}

async function existeEnfermero(db, enfermeroId) {
  const { rowCount } = await db.query(
    `SELECT 1
       FROM usuarios u
       JOIN usuario_rol ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
      WHERE u.id = $1 AND r.codigo = 'ENFERMERO' AND u.activo`,
    [enfermeroId]
  );
  return rowCount > 0;
}

const SELECT_GUARDIA = `
  SELECT c.id, c.paciente_id, c.enfermero_id, c.nivel, c.prioridad, c.posicion, c.estado,
         p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
    FROM cola_guardia c
    JOIN pacientes p ON p.id = c.paciente_id
`;

async function listarGuardia(db) {
  const { rows } = await db.query(
    `${SELECT_GUARDIA}
      WHERE c.estado = 'en_espera'
      ORDER BY c.posicion`
  );
  return rows;
}

async function obtenerIngreso(db, id) {
  const { rows } = await db.query(`${SELECT_GUARDIA} WHERE c.id = $1`, [id]);
  return rows[0] || null;
}

// Una sola cola. El lock cubre tambien el caso vacio, donde no hay filas
// para trabar con FOR UPDATE. Se corre de atras hacia adelante, de a una
// fila: el indice unico no deja sumar todas las posiciones en el mismo UPDATE.
async function encolarGuardia(db, { pacienteId, enfermeroId, nivel, prioridad }) {
  await db.query('SELECT pg_advisory_xact_lock(31, 1)');
  const { rows: cola } = await db.query(
    `SELECT id, paciente_id, prioridad, posicion
       FROM cola_guardia
      WHERE estado = 'en_espera'
      ORDER BY posicion
      FOR UPDATE`
  );
  if (cola.some((fila) => fila.paciente_id === pacienteId)) {
    throw new DatosInvalidosError('Ese paciente ya está en la cola de guardia.');
  }
  const menosUrgente = cola.find((fila) => fila.prioridad > prioridad);
  const posicion = menosUrgente
    ? menosUrgente.posicion
    : (cola.length ? cola[cola.length - 1].posicion + 1 : 1);
  if (menosUrgente) {
    const aCorrer = cola
      .filter((fila) => fila.posicion >= posicion)
      .sort((a, b) => b.posicion - a.posicion);
    for (const fila of aCorrer) {
      await db.query(
        'UPDATE cola_guardia SET posicion = $1 WHERE id = $2',
        [fila.posicion + 1, fila.id]
      );
    }
  }
  const { rows } = await db.query(
    `INSERT INTO cola_guardia (paciente_id, enfermero_id, nivel, prioridad, posicion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [pacienteId, enfermeroId, nivel, prioridad, posicion]
  );
  return obtenerIngreso(db, rows[0].id);
}

// El bloqueo es de la cola, no de una fila: la posicion nueva todavia no existe,
// asi que FOR UPDATE no alcanza para que dos altas no calculen la misma.
async function encolar(db, { pacienteId, medicoId, fecha }) {
  await db.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [medicoId, fecha]);
  const { rows: actuales } = await db.query(
    `SELECT COALESCE(MAX(posicion), 0) AS max
       FROM lista_espera
      WHERE medico_id = $1 AND fecha = $2 AND estado = 'en_espera'`,
    [medicoId, fecha]
  );
  const posicion = Number(actuales[0].max) + 1;
  const { rows } = await db.query(
    `INSERT INTO lista_espera (paciente_id, medico_id, fecha, posicion)
     VALUES ($1, $2, $3, $4)
     RETURNING id, paciente_id, medico_id, fecha, posicion, estado`,
    [pacienteId, medicoId, fecha, posicion]
  );
  return rows[0];
}

async function listarEspera(db) {
  const { rows } = await db.query(
    `SELECT e.id, e.paciente_id, e.medico_id, e.fecha, e.posicion, e.estado,
            p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
            m.nombre AS medico_nombre, m.apellido AS medico_apellido
       FROM lista_espera e
       JOIN pacientes p ON p.id = e.paciente_id
       JOIN usuarios m ON m.id = e.medico_id
      WHERE e.estado = 'en_espera'
      ORDER BY e.fecha, m.apellido, e.posicion`
  );
  return rows;
}

// La segunda cancelacion espera esta fila. Al despertar, el WHERE ya no
// la ve si dejo de estar en_espera, y toma la posicion siguiente.
async function tomarPrimeroEnEspera(db, medicoId, fecha) {
  const { rows } = await db.query(
    `SELECT id, paciente_id, posicion
       FROM lista_espera
      WHERE medico_id = $1 AND fecha = $2 AND estado = 'en_espera'
      ORDER BY posicion
      LIMIT 1
      FOR UPDATE`,
    [medicoId, fecha]
  );
  return rows[0] || null;
}

async function marcarEsperaAsignada(db, esperaId, turnoId) {
  const { rows } = await db.query(
    `UPDATE lista_espera
        SET estado = 'asignado', turno_id = $2
      WHERE id = $1 AND estado = 'en_espera'
      RETURNING id`,
    [esperaId, turnoId]
  );
  return rows[0] || null;
}

async function cambiarEstado(db, turnoId, desde, hacia) {
  const { rows } = await db.query(
    `UPDATE turnos
        SET estado = $3, actualizado_en = NOW()
      WHERE id = $1 AND estado = $2
      RETURNING id`,
    [turnoId, desde, hacia]
  );
  return rows[0] || null;
}

async function marcarCancelado(db, turnoId) {
  const { rows } = await db.query(
    `UPDATE turnos
        SET estado = 'cancelado', actualizado_en = NOW()
      WHERE id = $1 AND estado IN ('programado', 'confirmado')
      RETURNING id`,
    [turnoId]
  );
  return rows[0] || null;
}

// El hueco liberado. Hereda las marcas del turno cancelado: es el mismo horario.
async function crearTurnoAsignado(db, { medicoId, pacienteId, inicio, fin, esEntreturno, duracionReducida }) {
  const { rows } = await db.query(
    `INSERT INTO turnos (
       medico_id, paciente_id, inicio, fin, estado, es_entreturno, duracion_reducida
     )
     VALUES ($1, $2, $3, $4, 'programado', $5, $6)
     RETURNING id`,
    [medicoId, pacienteId, inicio, fin, esEntreturno, duracionReducida]
  );
  return obtenerTurno(db, rows[0].id);
}

async function crearIngresoObservacion(db, { pacienteId, tipo }) {
  const { rows } = await db.query(
    `INSERT INTO ingresos_observacion (paciente_id, tipo)
     VALUES ($1, $2)
     RETURNING id, paciente_id, tipo, creado_en`,
    [pacienteId, tipo]
  );
  return rows[0];
}

module.exports = {
  crearPaciente,
  listarPacientes,
  existePaciente,
  listarMedicos,
  crearTurno,
  listarTurnos,
  obtenerTurno,
  bloquearTurno,
  marcarProgramado,
  achicarTurno,
  crearEntreturno,
  existeMedico,
  listarEnfermeros,
  existeEnfermero,
  listarGuardia,
  encolarGuardia,
  encolar,
  listarEspera,
  tomarPrimeroEnEspera,
  marcarEsperaAsignada,
  marcarCancelado,
  cambiarEstado,
  crearTurnoAsignado,
  crearIngresoObservacion,
};
