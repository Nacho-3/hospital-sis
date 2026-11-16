async function insertarConTareas(db, pacienteId, { tipo, tareas }) {
  const { rows: [protocolo] } = await db.query(
    `INSERT INTO protocolos (paciente_id, tipo)
     VALUES ($1, $2)
     RETURNING id, paciente_id, tipo, creado_en`,
    [pacienteId, tipo]
  );

  const tareasGuardadas = [];
  for (const tarea of tareas) {
    const { rows: [guardada] } = await db.query(
      `INSERT INTO protocolo_tareas (protocolo_id, descripcion)
       VALUES ($1, $2)
       RETURNING id, descripcion, estado`,
      [protocolo.id, tarea.descripcion]
    );
    tareasGuardadas.push(guardada);
  }

  return {
    id: protocolo.id,
    pacienteId: protocolo.paciente_id,
    tipo: protocolo.tipo,
    creadoEn: protocolo.creado_en,
    tareas: tareasGuardadas,
  };
}

async function listarPorPaciente(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT p.id, p.tipo, p.creado_en,
            t.id AS tarea_id, t.descripcion, t.estado
       FROM protocolos p
       LEFT JOIN protocolo_tareas t ON t.protocolo_id = p.id
      WHERE p.paciente_id = $1
      ORDER BY p.creado_en DESC, p.id DESC, t.id`,
    [pacienteId]
  );

  const protocolos = new Map();
  for (const fila of rows) {
    let protocolo = protocolos.get(fila.id);
    if (!protocolo) {
      protocolo = {
        id: fila.id,
        tipo: fila.tipo,
        creadoEn: fila.creado_en,
        tareas: [],
      };
      protocolos.set(fila.id, protocolo);
    }
    if (fila.tarea_id !== null) {
      protocolo.tareas.push({
        id: fila.tarea_id,
        descripcion: fila.descripcion,
        estado: fila.estado,
      });
    }
  }
  return [...protocolos.values()];
}

async function marcarTareaRealizada(db, tareaId) {
  const { rows: [tarea] } = await db.query(
    `UPDATE protocolo_tareas
        SET estado = 'realizada'
      WHERE id = $1
      RETURNING id, descripcion, estado`,
    [tareaId]
  );
  return tarea ?? null;
}

module.exports = { insertarConTareas, listarPorPaciente, marcarTareaRealizada };
