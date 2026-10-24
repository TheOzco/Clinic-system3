import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const careStatusEnum = pgEnum("care_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "completed",
  "cancelled",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "invoice",
  "payment",
  "refund",
]);

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    patientCode: varchar("patient_code", { length: 24 }).notNull(),
    fullName: varchar("full_name", { length: 180 }).notNull(),
    nationalId: varchar("national_id", { length: 20 }).notNull(),
    birthDate: varchar("birth_date", { length: 10 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("clients_patient_code_unique").on(table.patientCode),
    uniqueIndex("clients_national_id_unique").on(table.nationalId),
  ],
);

export const clientPhones = pgTable("client_phones", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  phone: varchar("phone", { length: 24 }).notNull(),
  label: varchar("label", { length: 40 }).default("موبایل").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  description: text("description"),
  defaultPrice: integer("default_price").default(0).notNull(),
  durationMinutes: integer("duration_minutes").default(60).notNull(),
  color: varchar("color", { length: 20 }).default("#246BFD").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clientServices = pgTable("client_services", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  serviceId: integer("service_id")
    .references(() => services.id, { onDelete: "restrict" })
    .notNull(),
  status: careStatusEnum("status").default("planned").notNull(),
  agreedPrice: integer("agreed_price").default(0).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 })
    .default("0")
    .notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
});

export const treatmentRecords = pgTable("treatment_records", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  clientServiceId: integer("client_service_id").references(() => clientServices.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description"),
  status: careStatusEnum("status").default("planned").notNull(),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull(),
  cost: integer("cost").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  clientServiceId: integer("client_service_id").references(() => clientServices.id, {
    onDelete: "set null",
  }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").default(60).notNull(),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const financialTransactions = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  clientServiceId: integer("client_service_id").references(() => clientServices.id, {
    onDelete: "set null",
  }),
  type: transactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 })
    .default("0")
    .notNull(),
  paymentMethod: varchar("payment_method", { length: 60 }),
  reference: varchar("reference", { length: 100 }),
  notes: text("notes"),
  transactionAt: timestamp("transaction_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type Service = typeof services.$inferSelect;
