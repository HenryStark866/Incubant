-- Chat System Tables
-- Esta migración crea las tablas para el sistema de mensajes internos

-- Enum para tipos de conversación
CREATE TYPE "ConversationType" AS ENUM ('PRIVADO', 'REPORTES', 'GENERAL', 'TURNO');

-- Tabla Conversation
CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "titulo" TEXT,
  "tipo" "ConversationType" NOT NULL DEFAULT 'GENERAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- Tabla ConversationParticipant
CREATE TABLE "ConversationParticipant" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConversationParticipant_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationParticipant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationParticipant_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id")
);

-- Tabla Message
CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "contenido" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Índices para optimizar queries
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");
CREATE INDEX "ConversationParticipant_user_id_idx" ON "ConversationParticipant"("user_id");
CREATE INDEX "Message_conversation_id_createdAt_idx" ON "Message"("conversation_id", "createdAt");
CREATE INDEX "Message_sender_id_idx" ON "Message"("sender_id");
