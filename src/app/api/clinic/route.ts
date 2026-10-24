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
import { getClinicData } from "@/lib/clinic-data";
import type { MutationAction } from "@/lib/clinic-types";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function text(value: unknown, field: string, required = true) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${field} الزامی است.`);
  return result;
}

function integer(value: unknown, field: string, minimum = 0) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < minimum) {
    throw new Error(`${field} معتبر نیست.`);
  }
  return Math.round(result);
}

function percentage(value: unknown) {
  const result = Number(value ?? 0);
  if (!Number.isFinite(result) || result < 0 || result > 100) {
    throw new Error("درصد تخفیف باید بین صفر تا صد باشد.");
  }
  return String(result);
}

function dateValue(value: unknown, field: string) {
  const result = new Date(String(value));
  if (Number.isNaN(result.getTime())) throw new Error(`${field} معتبر نیست.`);
  return result;
}

function phoneValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function GET() {
  try {
    return NextResponse.json(await getClinicData());
  } catch (error) {
    console.error("clinic:get", error);
    return NextResponse.json({ message: "دریافت اطلاعات با خطا مواجه شد." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: MutationAction;
      payload?: Record<string, unknown>;
    };
    const action = body.action;
    const payload = body.payload ?? {};

    if (!action) throw new Error("نوع عملیات مشخص نشده است.");

    switch (action) {
      case "createClient": {
        const fullName = text(payload.fullName, "نام و نام خانوادگی");
        const nationalId = text(payload.nationalId, "کد ملی");
        const phones = phoneValues(payload.phones);
        if (phones.length === 0) throw new Error("حداقل یک شماره تماس وارد کنید.");

        await db.transaction(async (tx) => {
          const [client] = await tx
            .insert(clients)
            .values({
              patientCode: `CL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
              fullName,
              nationalId,
              birthDate: text(payload.birthDate, "تاریخ تولد", false) || null,
              notes: text(payload.notes, "یادداشت", false) || null,
            })
            .returning();
          await tx.insert(clientPhones).values(
            phones.map((phone, index) => ({
              clientId: client.id,
              phone,
              label: index === 0 ? "موبایل" : "شماره جایگزین",
              isPrimary: index === 0,
            })),
          );
        });
        break;
      }

      case "updateClient": {
        const clientId = integer(payload.clientId, "شناسه کلاینت", 1);
        const phones = phoneValues(payload.phones);
        if (phones.length === 0) throw new Error("حداقل یک شماره تماس وارد کنید.");
        await db.transaction(async (tx) => {
          await tx
            .update(clients)
            .set({
              fullName: text(payload.fullName, "نام و نام خانوادگی"),
              nationalId: text(payload.nationalId, "کد ملی"),
              birthDate: text(payload.birthDate, "تاریخ تولد", false) || null,
              notes: text(payload.notes, "یادداشت", false) || null,
              updatedAt: new Date(),
            })
            .where(eq(clients.id, clientId));
          await tx.delete(clientPhones).where(eq(clientPhones.clientId, clientId));
          await tx.insert(clientPhones).values(
            phones.map((phone, index) => ({
              clientId,
              phone,
              label: index === 0 ? "موبایل" : "شماره جایگزین",
              isPrimary: index === 0,
            })),
          );
        });
        break;
      }

      case "assignService": {
        const clientId = integer(payload.clientId, "شناسه کلاینت", 1);
        const serviceId = integer(payload.serviceId, "خدمت", 1);
        const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
        if (!service) throw new Error("خدمت انتخاب‌شده پیدا نشد.");
        const agreedPrice = integer(payload.agreedPrice ?? service.defaultPrice, "مبلغ خدمت");
        const discountPercent = percentage(payload.discountPercent);

        await db.transaction(async (tx) => {
          const [assignment] = await tx
            .insert(clientServices)
            .values({
              clientId,
              serviceId,
              status: "planned",
              agreedPrice,
              discountPercent,
              notes: text(payload.notes, "توضیحات", false) || null,
            })
            .returning();
          await tx.insert(financialTransactions).values({
            clientId,
            clientServiceId: assignment.id,
            type: "invoice",
            amount: agreedPrice,
            discountPercent,
            notes: `صورتحساب ${service.name}`,
          });
        });
        break;
      }

      case "addTreatment": {
        await db.insert(treatmentRecords).values({
          clientId: integer(payload.clientId, "شناسه کلاینت", 1),
          clientServiceId: payload.clientServiceId
            ? integer(payload.clientServiceId, "خدمت", 1)
            : null,
          title: text(payload.title, "عنوان درمان"),
          description: text(payload.description, "توضیحات", false) || null,
          status:
            payload.status === "completed" || payload.status === "in_progress"
              ? payload.status
              : "planned",
          performedAt: dateValue(payload.performedAt, "تاریخ درمان"),
          cost: integer(payload.cost ?? 0, "هزینه"),
        });
        break;
      }

      case "addAppointment": {
        await db.insert(appointments).values({
          clientId: integer(payload.clientId, "شناسه کلاینت", 1),
          clientServiceId: payload.clientServiceId
            ? integer(payload.clientServiceId, "خدمت", 1)
            : null,
          startsAt: dateValue(payload.startsAt, "زمان جلسه"),
          durationMinutes: integer(payload.durationMinutes ?? 60, "مدت جلسه", 5),
          status: "scheduled",
          notes: text(payload.notes, "یادداشت", false) || null,
        });
        break;
      }

      case "addPayment": {
        await db.insert(financialTransactions).values({
          clientId: integer(payload.clientId, "شناسه کلاینت", 1),
          clientServiceId: payload.clientServiceId
            ? integer(payload.clientServiceId, "خدمت", 1)
            : null,
          type: "payment",
          amount: integer(payload.amount, "مبلغ پرداخت", 1),
          discountPercent: percentage(payload.discountPercent),
          paymentMethod: text(payload.paymentMethod, "روش پرداخت", false) || "کارت‌خوان",
          reference: text(payload.reference, "شماره پیگیری", false) || null,
          notes: text(payload.notes, "یادداشت", false) || null,
          transactionAt: payload.transactionAt
            ? dateValue(payload.transactionAt, "تاریخ پرداخت")
            : new Date(),
        });
        break;
      }

      case "addService": {
        await db.insert(services).values({
          name: text(payload.name, "نام خدمت"),
          category: text(payload.category, "دسته‌بندی"),
          description: text(payload.description, "توضیحات", false) || null,
          defaultPrice: integer(payload.defaultPrice, "تعرفه"),
          durationMinutes: integer(payload.durationMinutes ?? 60, "مدت خدمت", 5),
          color: text(payload.color, "رنگ", false) || "#246BFD",
        });
        break;
      }

      default:
        throw new Error("عملیات درخواستی پشتیبانی نمی‌شود.");
    }

    return NextResponse.json({ ok: true, data: await getClinicData() });
  } catch (error) {
    console.error("clinic:post", error);
    const message = error instanceof Error ? error.message : "ثبت اطلاعات انجام نشد.";
    const isDuplicate = message.includes("duplicate key");
    return NextResponse.json(
      { message: isDuplicate ? "این کد ملی قبلاً ثبت شده است." : message },
      { status: isDuplicate ? 409 : 400 },
    );
  }
}
