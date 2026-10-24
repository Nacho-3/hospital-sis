-- Extensiones de PostgreSQL. Lo toca el equipo solo si hay que agregar otra.
-- btree_gist permite la restriccion que impide turnos solapados del mismo medico.

CREATE EXTENSION IF NOT EXISTS btree_gist;
