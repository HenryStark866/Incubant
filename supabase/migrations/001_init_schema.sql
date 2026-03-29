-- ============================================
-- Incubant - Schema Inicial para Supabase
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase
-- para crear las tablas necesarias

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Enums
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('OPERARIO', 'SUPERVISOR', 'JEFE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MachineType" AS ENUM ('INCUBADORA', 'NACEDORA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLE: User
-- ============================================
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    "nombre" TEXT NOT NULL,
    "pin_acceso" TEXT UNIQUE NOT NULL,
    "rol" "Role" NOT NULL DEFAULT 'OPERARIO',
    "turno" TEXT NOT NULL DEFAULT 'Turno 1',
    "estado" TEXT NOT NULL DEFAULT 'Activo',
    "ultimo_acceso" TIMESTAMP(3),
    "session_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE: Machine
-- ============================================
CREATE TABLE IF NOT EXISTS "Machine" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tipo" "MachineType" NOT NULL,
    "numero_maquina" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("tipo", "numero_maquina")
);

-- ============================================
-- TABLE: HourlyLog
-- ============================================
CREATE TABLE IF NOT EXISTS "HourlyLog" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "photo_url" TEXT,
    "temp_principal_actual" DOUBLE PRECISION NOT NULL,
    "temp_principal_consigna" DOUBLE PRECISION NOT NULL,
    "co2_actual" DOUBLE PRECISION NOT NULL,
    "co2_consigna" DOUBLE PRECISION NOT NULL,
    "fan_speed" DOUBLE PRECISION NOT NULL,
    "temp_secundaria_actual" DOUBLE PRECISION NOT NULL,
    "temp_secundaria_consigna" DOUBLE PRECISION NOT NULL,
    "is_na" BOOLEAN NOT NULL DEFAULT false,
    "temp_superior_actual" DOUBLE PRECISION,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HourlyLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HourlyLog_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================
-- TABLE: Incident
-- ============================================
CREATE TABLE IF NOT EXISTS "Incident" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "machine_id" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Incident_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Incident_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- TABLE: Shift
-- ============================================
CREATE TABLE IF NOT EXISTS "Shift" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    "nombre" TEXT UNIQUE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "color" TEXT DEFAULT '#f5a623',
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE: ScheduleAssignment
-- ============================================
CREATE TABLE IF NOT EXISTS "ScheduleAssignment" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleAssignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAssignment_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE ("user_id", "fecha")
);

-- ============================================
-- TABLE: Session
-- ============================================
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    "token" TEXT UNIQUE NOT NULL,
    "user_id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS "HourlyLog_user_id_idx" ON "HourlyLog"("user_id");
CREATE INDEX IF NOT EXISTS "HourlyLog_machine_id_idx" ON "HourlyLog"("machine_id");
CREATE INDEX IF NOT EXISTS "HourlyLog_fecha_hora_idx" ON "HourlyLog"("fecha_hora");
CREATE INDEX IF NOT EXISTS "Incident_user_id_idx" ON "Incident"("user_id");
CREATE INDEX IF NOT EXISTS "Incident_machine_id_idx" ON "Incident"("machine_id");
CREATE INDEX IF NOT EXISTS "ScheduleAssignment_user_id_idx" ON "ScheduleAssignment"("user_id");
CREATE INDEX IF NOT EXISTS "ScheduleAssignment_shift_id_idx" ON "ScheduleAssignment"("shift_id");
CREATE INDEX IF NOT EXISTS "ScheduleAssignment_fecha_idx" ON "ScheduleAssignment"("fecha");
CREATE INDEX IF NOT EXISTS "Session_token_idx" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_user_id_idx" ON "Session"("user_id");

-- ============================================
-- SEED: Turnos por defecto
-- ============================================
INSERT INTO "Shift" ("nombre", "hora_inicio", "hora_fin", "color") VALUES
    ('Turno 1', '06:00', '14:00', '#f5a623'),
    ('Turno 2', '14:00', '22:00', '#4a90d9'),
    ('Turno 3', '22:00', '06:00', '#9013fe'),
    ('Gestión', '08:00', '17:00', '#00a86b')
ON CONFLICT ("nombre") DO NOTHING;

-- ============================================
-- SEED: Usuarios predefinidos
-- ============================================
INSERT INTO "User" ("id", "nombre", "pin_acceso", "rol", "turno", "estado") VALUES
    ('admin', 'Administrador', '4753', 'JEFE', 'Gestión', 'Activo'),
    ('elkin-cavadia', 'Elkin Cavadia', '11168', 'JEFE', 'Gestión', 'Activo'),
    ('juan-alejandro', 'Juan Alejandro', '1111', 'OPERARIO', 'Turno 3', 'Activo'),
    ('juan-suaza', 'Juan Suaza', '2222', 'OPERARIO', 'Turno 1', 'Activo'),
    ('ferney-tabares', 'Ferney Tabares', '3333', 'OPERARIO', 'Turno 2', 'Activo'),
    ('luis-cortes', 'Luis Cortes', '4444', 'OPERARIO', 'Turno 2', 'Activo'),
    ('jhon-piedrahita', 'Jhon Piedrahita', 'jp2026', 'SUPERVISOR', 'Turno 1', 'Activo')
ON CONFLICT ("id") DO UPDATE SET
    "nombre" = EXCLUDED.nombre,
    "rol" = EXCLUDED.rol,
    "turno" = EXCLUDED.turno;

-- ============================================
-- SEED: Máquinas iniciales (24 incubadoras, 12 nacedoras)
-- ============================================
DO $$
DECLARE
    i INTEGER;
BEGIN
    -- Incubadoras 1-24
    FOR i IN 1..24 LOOP
        INSERT INTO "Machine" ("tipo", "numero_maquina")
        VALUES ('INCUBADORA', i)
        ON CONFLICT ("tipo", "numero_maquina") DO NOTHING;
    END LOOP;

    -- Nacedoras 1-12
    FOR i IN 1..12 LOOP
        INSERT INTO "Machine" ("tipo", "numero_maquina")
        VALUES ('NACEDORA', i)
        ON CONFLICT ("tipo", "numero_maquina") DO NOTHING;
    END LOOP;
END $$;

-- ============================================
-- Trigger: Update timestamp on User
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_updated_at ON "User";
CREATE TRIGGER update_user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_machine_updated_at ON "Machine";
CREATE TRIGGER update_machine_updated_at
    BEFORE UPDATE ON "Machine"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shift_updated_at ON "Shift";
CREATE TRIGGER update_shift_updated_at
    BEFORE UPDATE ON "Shift"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
