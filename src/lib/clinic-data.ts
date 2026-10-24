import "server-only";

import { db } from "@/db";
import {
  appointments,
  clientPhones,
  clients,
  clientServices,
  financialTransactions,
  services,
  treatmentRecords,
} from "@/db/schema";
import type { ClinicData } from "@/lib/clinic-types";
import { asc } from "drizzle-orm";

const DAY = 24 * 60 * 60 * 1000;

function atDay(offset: number, hour = 10, minute = 0) {
  const date = new Date(Date.now() + offset * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export async function ensureClinicSeeded() {
  let serviceRows = await db.select().from(services).orderBy(asc(services.id));

  if (serviceRows.length === 0) {
    serviceRows = await db
      .insert(services)
      .values([
        {
          name: "ارتودنسی ثابت",
          category: "ارتودنسی",
          description: "درمان کامل ارتودنسی ثابت دو فک",
          defaultPrice: 48_000_000,
          durationMinutes: 60,
          color: "#246BFD",
        },
        {
          name: "جرم‌گیری و بروساژ",
          category: "بهداشت دهان",
          description: "جرم‌گیری کامل و پالیش دندان‌ها",
          defaultPrice: 2_400_000,
          durationMinutes: 45,
          color: "#12A594",
        },
        {
          name: "ترمیم کامپوزیت",
          category: "ترمیمی",
          description: "ترمیم همرنگ دندان برای هر واحد",
          defaultPrice: 3_800_000,
          durationMinutes: 50,
          color: "#F59E0B",
        },
        {
          name: "عصب‌کشی",
          category: "اندو",
          description: "درمان ریشه دندان",
          defaultPrice: 6_500_000,
          durationMinutes: 75,
          color: "#E75975",
        },
        {
          name: "ایمپلنت",
          category: "جراحی",
          description: "کاشت ایمپلنت و مراحل پروتزی",
          defaultPrice: 35_000_000,
          durationMinutes: 90,
          color: "#7C5CFC",
        },
        {
          name: "بلیچینگ",
          category: "زیبایی",
          description: "سفید کردن دندان در مطب",
          defaultPrice: 7_500_000,
          durationMinutes: 60,
          color: "#06A9C7",
        },
      ])
      .returning();
  }

  const existingClients = await db.select({ id: clients.id }).from(clients).limit(1);
  if (existingClients.length > 0) return;

  const samples = [
    {
      patientCode: "CL-1403-031",
      fullName: "مریم احمدی",
      nationalId: "0012345678",
      birthDate: "1374/06/12",
      phones: ["09121234567", "02188776655"],
      notes: "حساسیت به پنی‌سیلین",
    },
    {
      patientCode: "CL-1403-032",
      fullName: "سامان محمدی",
      nationalId: "0023456789",
      birthDate: "1368/11/03",
      phones: ["09351239876"],
      notes: null,
    },
    {
      patientCode: "CL-1403-033",
      fullName: "سارا کریمی",
      nationalId: "0034567890",
      birthDate: "1380/02/24",
      phones: ["09197865432"],
      notes: "ارجاع از دکتر رضایی",
    },
    {
      patientCode: "CL-1403-034",
      fullName: "امیرحسین رضایی",
      nationalId: "0045678901",
      birthDate: "1371/09/17",
      phones: ["09021223344", "02632221100"],
      notes: null,
    },
    {
      patientCode: "CL-1403-035",
      fullName: "نگین نادری",
      nationalId: "0056789012",
      birthDate: "1378/04/08",
      phones: ["09103334455"],
      notes: null,
    },
  ];

  await db.transaction(async (tx) => {
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];
      const [client] = await tx
        .insert(clients)
        .values({
          patientCode: sample.patientCode,
          fullName: sample.fullName,
          nationalId: sample.nationalId,
          birthDate: sample.birthDate,
          notes: sample.notes,
          createdAt: atDay(-(22 - index * 4)),
          updatedAt: atDay(-index),
        })
        .returning();

      await tx.insert(clientPhones).values(
        sample.phones.map((phone, phoneIndex) => ({
          clientId: client.id,
          phone,
          label: phoneIndex === 0 ? "موبایل" : "منزل",
          isPrimary: phoneIndex === 0,
        })),
      );

      const service = serviceRows[index % serviceRows.length];
      const secondService = serviceRows[(index + 2) % serviceRows.length];
      const [primaryAssignment] = await tx
        .insert(clientServices)
        .values({
          clientId: client.id,
          serviceId: service.id,
          status: index % 3 === 0 ? "completed" : index % 2 === 0 ? "planned" : "in_progress",
          agreedPrice: service.defaultPrice,
          discountPercent: index === 0 ? "10" : "0",
          assignedAt: atDay(-(18 - index * 3)),
          completedAt: index % 3 === 0 ? atDay(-3) : null,
        })
        .returning();

      if (index < 3) {
        await tx.insert(clientServices).values({
          clientId: client.id,
          serviceId: secondService.id,
          status: "planned",
          agreedPrice: secondService.defaultPrice,
          discountPercent: "0",
          assignedAt: atDay(-2 + index),
        });
      }

      await tx.insert(treatmentRecords).values([
        {
          clientId: client.id,
          clientServiceId: primaryAssignment.id,
          title: index % 2 === 0 ? "معاینه و طرح درمان" : "مرحله اول درمان",
          description: "بررسی کامل، ثبت تصاویر و توضیح مراحل درمان به مراجعه‌کننده",
          status: "completed",
          performedAt: atDay(-(14 - index * 2)),
          cost: index % 2 === 0 ? 750_000 : 1_500_000,
        },
        {
          clientId: client.id,
          clientServiceId: primaryAssignment.id,
          title: index % 2 === 0 ? "ادامه درمان" : "کنترل و ارزیابی",
          description: "مرحله بعدی مطابق برنامه درمان",
          status: "planned",
          performedAt: atDay(5 + index * 2),
          cost: 0,
        },
      ]);

      await tx.insert(appointments).values({
        clientId: client.id,
        clientServiceId: primaryAssignment.id,
        startsAt: atDay(2 + index, 9 + index, index % 2 === 0 ? 0 : 30),
        durationMinutes: service.durationMinutes,
        status: "scheduled",
        notes: index === 0 ? "یادآوری تلفنی یک روز قبل" : null,
      });

      await tx.insert(financialTransactions).values([
        {
          clientId: client.id,
          clientServiceId: primaryAssignment.id,
          type: "invoice",
          amount: service.defaultPrice,
          discountPercent: index === 0 ? "10" : "0",
          transactionAt: atDay(-(18 - index * 3)),
          notes: `صورتحساب ${service.name}`,
        },
        {
          clientId: client.id,
          clientServiceId: primaryAssignment.id,
          type: "payment",
          amount: Math.min(Math.round(service.defaultPrice * 0.45), 12_000_000),
          paymentMethod: index % 2 === 0 ? "کارت‌خوان" : "انتقال بانکی",
          reference: `TRX-${48320 + index}`,
          transactionAt: atDay(-(10 - index)),
          notes: "پرداخت مرحله‌ای",
        },
      ]);
    }
  });
}

export async function getClinicData(): Promise<ClinicData> {
  await ensureClinicSeeded();

  const [clientRows, phoneRows, serviceRows, assignmentRows, treatmentRows, appointmentRows, transactionRows] =
    await Promise.all([
      db.select().from(clients),
      db.select().from(clientPhones),
      db.select().from(services),
      db.select().from(clientServices),
      db.select().from(treatmentRecords),
      db.select().from(appointments),
      db.select().from(financialTransactions),
    ]);

  const serviceById = new Map(serviceRows.map((service) => [service.id, service]));
  const assignmentById = new Map(assignmentRows.map((assignment) => [assignment.id, assignment]));

  return {
    generatedAt: new Date().toISOString(),
    services: serviceRows.map((service) => ({
      ...service,
      createdAt: service.createdAt.toISOString(),
    })),
    clients: clientRows.map((client) => ({
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      phones: phoneRows
        .filter((phone) => phone.clientId === client.id)
        .map(({ clientId: _clientId, ...phone }) => phone),
      services: assignmentRows
        .filter((assignment) => assignment.clientId === client.id)
        .map((assignment) => {
          const service = serviceById.get(assignment.serviceId);
          return {
            id: assignment.id,
            serviceId: assignment.serviceId,
            serviceName: service?.name ?? "خدمت حذف‌شده",
            serviceCategory: service?.category ?? "بدون دسته",
            serviceColor: service?.color ?? "#64748B",
            status: assignment.status,
            agreedPrice: assignment.agreedPrice,
            discountPercent: Number(assignment.discountPercent),
            assignedAt: assignment.assignedAt.toISOString(),
            completedAt: assignment.completedAt?.toISOString() ?? null,
            notes: assignment.notes,
          };
        }),
      treatments: treatmentRows
        .filter((record) => record.clientId === client.id)
        .map((record) => {
          const assignment = record.clientServiceId
            ? assignmentById.get(record.clientServiceId)
            : undefined;
          return {
            id: record.id,
            clientServiceId: record.clientServiceId,
            serviceName: assignment ? serviceById.get(assignment.serviceId)?.name ?? null : null,
            title: record.title,
            description: record.description,
            status: record.status,
            performedAt: record.performedAt.toISOString(),
            cost: record.cost,
            createdAt: record.createdAt.toISOString(),
          };
        }),
      appointments: appointmentRows
        .filter((appointment) => appointment.clientId === client.id)
        .map((appointment) => {
          const assignment = appointment.clientServiceId
            ? assignmentById.get(appointment.clientServiceId)
            : undefined;
          return {
            id: appointment.id,
            clientServiceId: appointment.clientServiceId,
            serviceName: assignment ? serviceById.get(assignment.serviceId)?.name ?? null : null,
            startsAt: appointment.startsAt.toISOString(),
            durationMinutes: appointment.durationMinutes,
            status: appointment.status,
            notes: appointment.notes,
            createdAt: appointment.createdAt.toISOString(),
          };
        }),
      transactions: transactionRows
        .filter((transaction) => transaction.clientId === client.id)
        .map((transaction) => {
          const assignment = transaction.clientServiceId
            ? assignmentById.get(transaction.clientServiceId)
            : undefined;
          return {
            id: transaction.id,
            clientServiceId: transaction.clientServiceId,
            serviceName: assignment ? serviceById.get(assignment.serviceId)?.name ?? null : null,
            type: transaction.type,
            amount: transaction.amount,
            discountPercent: Number(transaction.discountPercent),
            paymentMethod: transaction.paymentMethod,
            reference: transaction.reference,
            notes: transaction.notes,
            transactionAt: transaction.transactionAt.toISOString(),
            createdAt: transaction.createdAt.toISOString(),
          };
        }),
    })),
  };
}
