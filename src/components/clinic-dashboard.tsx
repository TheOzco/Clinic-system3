"use client";

import type {
  CareStatus,
  ClientView,
  ClinicData,
  MutationRequest,
  ServiceView,
} from "@/lib/clinic-types";
import { exportExcel, type ExcelRow } from "@/lib/export-excel";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  CircleCheck,
  Clock3,
  Cloud,
  CloudOff,
  ContactRound,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  History,
  LayoutDashboard,
  ListFilter,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Stethoscope,
  Trash2,
  UserPlus,
  Users,
  WalletCards,
  Wifi,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type PageMode = "clients" | "services";
type CaseTab = "history" | "finance" | "appointments";
type ModalName =
  | "new-client"
  | "edit-client"
  | "assign-service"
  | "treatment"
  | "payment"
  | "appointment"
  | "new-service"
  | "server"
  | null;
type ConnectionMode = "cloud" | "local" | "offline";

const numberFormat = new Intl.NumberFormat("fa-IR");
const dateFormat = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const shortDateFormat = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
});

const statusMeta: Record<CareStatus, { label: string; className: string }> = {
  planned: { label: "برنامه‌ریزی شده", className: "status-planned" },
  in_progress: { label: "در حال درمان", className: "status-progress" },
  completed: { label: "انجام شده", className: "status-done" },
  cancelled: { label: "لغو شده", className: "status-cancelled" },
};

function money(value: number) {
  return `${numberFormat.format(Math.round(value))} تومان`;
}

function faDate(value: string) {
  return shortDateFormat.format(new Date(value));
}

function faLongDate(value: string) {
  return dateFormat.format(new Date(value));
}

function faTime(value: string) {
  return timeFormat.format(new Date(value));
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک");
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function StatusBadge({ status }: { status: CareStatus }) {
  const item = statusMeta[status];
  return (
    <span className={`status-badge ${item.className}`}>
      <i /> {item.label}
    </span>
  );
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, wide = false }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-card ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function getFormValue(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "").trim();
}

function getFinancials(client: ClientView) {
  const invoice = client.transactions
    .filter((item) => item.type === "invoice")
    .reduce((total, item) => total + item.amount, 0);
  const discount = client.transactions
    .filter((item) => item.type === "invoice")
    .reduce((total, item) => total + item.amount * (item.discountPercent / 100), 0);
  const paid = client.transactions
    .filter((item) => item.type === "payment")
    .reduce((total, item) => total + item.amount, 0);
  const refunded = client.transactions
    .filter((item) => item.type === "refund")
    .reduce((total, item) => total + item.amount, 0);
  return {
    invoice,
    discount,
    paid: paid - refunded,
    due: Math.max(0, invoice - discount - paid + refunded),
  };
}

export default function ClinicDashboard({ initialData }: { initialData: ClinicData }) {
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState<number | null>(initialData.clients[0]?.id ?? null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(initialData.services[0]?.id ?? null);
  const [pageMode, setPageMode] = useState<PageMode>("clients");
  const [caseTab, setCaseTab] = useState<CaseTab>("history");
  const [modal, setModal] = useState<ModalName>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [nameSearch, setNameSearch] = useState("");
  const [codeSearch, setCodeSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [clientSort, setClientSort] = useState("recent");
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "planned">("all");
  const [sectionSort, setSectionSort] = useState<"date-desc" | "date-asc" | "alpha">("date-desc");
  const [serviceSort, setServiceSort] = useState<"date-desc" | "date-asc" | "alpha">("date-desc");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [phoneInputs, setPhoneInputs] = useState<string[]>([""]);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("cloud");
  const [localServerUrl, setLocalServerUrl] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  const selectedClient = data.clients.find((client) => client.id === selectedId) ?? null;
  const selectedService = data.services.find((service) => service.id === selectedServiceId) ?? null;

  useEffect(() => {
    const mode = (localStorage.getItem("clinic-connection-mode") as ConnectionMode | null) ?? "cloud";
    const url = localStorage.getItem("clinic-local-server") ?? "";
    const queue = JSON.parse(localStorage.getItem("clinic-outbox") ?? "[]") as MutationRequest[];
    setConnectionMode(["cloud", "local", "offline"].includes(mode) ? mode : "cloud");
    setLocalServerUrl(url);
    setPendingCount(queue.length);
    setIsOnline(navigator.onLine);
    localStorage.setItem("clinic-cache", JSON.stringify(initialData));

    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [initialData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const apiUrl = useCallback(() => {
    if (connectionMode === "local" && localServerUrl.trim()) {
      return `${localServerUrl.trim().replace(/\/$/, "")}/api/clinic`;
    }
    return "/api/clinic";
  }, [connectionMode, localServerUrl]);

  const queueMutation = useCallback((request: MutationRequest) => {
    const queue = JSON.parse(localStorage.getItem("clinic-outbox") ?? "[]") as MutationRequest[];
    queue.push(request);
    localStorage.setItem("clinic-outbox", JSON.stringify(queue));
    setPendingCount(queue.length);
    setToast({ type: "success", text: "در حالت آفلاین ذخیره شد؛ پس از اتصال همگام می‌شود." });
  }, []);

  const mutate = useCallback(async (request: MutationRequest) => {
    if (connectionMode === "offline" || !navigator.onLine) {
      queueMutation(request);
      setModal(null);
      return true;
    }

    setIsSaving(true);
    try {
      const response = await fetch(apiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const result = (await response.json()) as { data?: ClinicData; message?: string };
      if (!response.ok || !result.data) throw new Error(result.message || "ثبت اطلاعات انجام نشد.");
      setData(result.data);
      localStorage.setItem("clinic-cache", JSON.stringify(result.data));
      setModal(null);
      setToast({ type: "success", text: "اطلاعات با موفقیت ثبت شد." });
      return true;
    } catch (error) {
      setToast({
        type: "error",
        text: error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد.",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [apiUrl, connectionMode, queueMutation]);

  const syncPending = useCallback(async () => {
    if (!navigator.onLine || connectionMode === "offline") {
      setToast({ type: "error", text: "برای همگام‌سازی، اتصال سرور را روی آنلاین قرار دهید." });
      return;
    }
    const queue = JSON.parse(localStorage.getItem("clinic-outbox") ?? "[]") as MutationRequest[];
    if (!queue.length) {
      setToast({ type: "success", text: "همه اطلاعات همگام هستند." });
      return;
    }
    setIsSaving(true);
    try {
      let latest: ClinicData | undefined;
      for (const item of queue) {
        const response = await fetch(apiUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        const result = (await response.json()) as { data?: ClinicData; message?: string };
        if (!response.ok) throw new Error(result.message || "بخشی از اطلاعات همگام نشد.");
        latest = result.data;
      }
      localStorage.removeItem("clinic-outbox");
      setPendingCount(0);
      if (latest) {
        setData(latest);
        localStorage.setItem("clinic-cache", JSON.stringify(latest));
      }
      setToast({ type: "success", text: `${numberFormat.format(queue.length)} مورد همگام شد.` });
    } catch (error) {
      setToast({ type: "error", text: error instanceof Error ? error.message : "همگام‌سازی انجام نشد." });
    } finally {
      setIsSaving(false);
    }
  }, [apiUrl, connectionMode]);

  const filteredClients = useMemo(() => {
    const name = normalize(nameSearch);
    const code = normalize(codeSearch);
    const phone = normalize(phoneSearch);
    return [...data.clients]
      .filter((client) => {
        return (
          (!name || normalize(client.fullName).includes(name)) &&
          (!code || normalize(`${client.patientCode} ${client.nationalId}`).includes(code)) &&
          (!phone || client.phones.some((item) => normalize(item.phone).includes(phone)))
        );
      })
      .sort((a, b) => {
        if (clientSort === "name") return a.fullName.localeCompare(b.fullName, "fa");
        if (clientSort === "code") return a.patientCode.localeCompare(b.patientCode, "fa");
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [clientSort, codeSearch, data.clients, nameSearch, phoneSearch]);

  const serviceClients = useMemo(() => {
    if (!selectedService) return [];
    const rows = data.clients.flatMap((client) =>
      client.services
        .filter((item) => item.serviceId === selectedService.id)
        .map((item) => ({ client, assignment: item })),
    );
    return rows.sort((a, b) => {
      if (serviceSort === "alpha") return a.client.fullName.localeCompare(b.client.fullName, "fa");
      const direction = serviceSort === "date-asc" ? 1 : -1;
      return (new Date(a.assignment.assignedAt).getTime() - new Date(b.assignment.assignedAt).getTime()) * direction;
    });
  }, [data.clients, selectedService, serviceSort]);

  const openNewClient = () => {
    setPhoneInputs([""]);
    setModal("new-client");
  };

  const openEditClient = () => {
    if (!selectedClient) return;
    setPhoneInputs(selectedClient.phones.map((item) => item.phone).length ? selectedClient.phones.map((item) => item.phone) : [""]);
    setModal("edit-client");
  };

  const submitClient = async (event: FormEvent<HTMLFormElement>, edit = false) => {
    event.preventDefault();
    const form = event.currentTarget;
    const phones = phoneInputs.map((_, index) => getFormValue(form, `phone-${index}`)).filter(Boolean);
    const request: MutationRequest = {
      action: edit ? "updateClient" : "createClient",
      payload: {
        ...(edit && selectedClient ? { clientId: selectedClient.id } : {}),
        fullName: getFormValue(form, "fullName"),
        nationalId: getFormValue(form, "nationalId"),
        birthDate: getFormValue(form, "birthDate"),
        notes: getFormValue(form, "notes"),
        phones,
      },
    };
    await mutate(request);
  };

  const submitSimple = async (
    event: FormEvent<HTMLFormElement>,
    action: MutationRequest["action"],
    payload: Record<string, unknown>,
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    await mutate({ action, payload: { ...values, ...payload } });
  };

  const exportClients = () => {
    const rows: ExcelRow[] = filteredClients.map((client) => ({
      "کد پرونده": client.patientCode,
      "نام و نام خانوادگی": client.fullName,
      "کد ملی": client.nationalId,
      "شماره تماس": client.phones.map((item) => item.phone).join("، "),
      "تعداد خدمات": client.services.length,
      "تاریخ ثبت": faDate(client.createdAt),
    }));
    void exportExcel("لیست-کلاینت‌ها", [{ name: "کلاینت‌ها", rows }]);
  };

  const exportServiceReport = () => {
    if (!selectedService) return;
    void exportExcel(`گزارش-${selectedService.name}`, [{
      name: selectedService.name,
      rows: serviceClients.map(({ client, assignment }) => ({
        "نام کلاینت": client.fullName,
        "کد پرونده": client.patientCode,
        "شماره تماس": client.phones[0]?.phone ?? "-",
        وضعیت: statusMeta[assignment.status].label,
        مبلغ: assignment.agreedPrice,
        "درصد تخفیف": assignment.discountPercent,
        "تاریخ تخصیص": faDate(assignment.assignedAt),
      })),
    }]);
  };

  const exportClient = (section: "all" | CaseTab) => {
    if (!selectedClient) return;
    const profile: ExcelRow[] = [{
      "کد پرونده": selectedClient.patientCode,
      نام: selectedClient.fullName,
      "کد ملی": selectedClient.nationalId,
      "تاریخ تولد": selectedClient.birthDate ?? "-",
      تلفن: selectedClient.phones.map((item) => item.phone).join("، "),
      یادداشت: selectedClient.notes ?? "-",
    }];
    const history: ExcelRow[] = selectedClient.treatments.map((item) => ({
      "عنوان درمان": item.title,
      خدمت: item.serviceName ?? "-",
      وضعیت: statusMeta[item.status].label,
      تاریخ: faDate(item.performedAt),
      هزینه: item.cost,
      توضیحات: item.description ?? "-",
    }));
    const finance: ExcelRow[] = selectedClient.transactions.map((item) => ({
      نوع: item.type === "invoice" ? "صورتحساب" : item.type === "payment" ? "پرداخت" : "بازپرداخت",
      خدمت: item.serviceName ?? "-",
      مبلغ: item.amount,
      "درصد تخفیف": item.discountPercent,
      "روش پرداخت": item.paymentMethod ?? "-",
      "شماره پیگیری": item.reference ?? "-",
      تاریخ: faDate(item.transactionAt),
    }));
    const sessions: ExcelRow[] = selectedClient.appointments.map((item) => ({
      خدمت: item.serviceName ?? "-",
      تاریخ: faDate(item.startsAt),
      ساعت: faTime(item.startsAt),
      "مدت (دقیقه)": item.durationMinutes,
      وضعیت: item.status === "scheduled" ? "رزرو شده" : item.status === "completed" ? "انجام شده" : "لغو شده",
      یادداشت: item.notes ?? "-",
    }));
    const allSheets = [
      { name: "پروفایل", rows: profile },
      { name: "سوابق درمان", rows: history },
      { name: "گزارش مالی", rows: finance },
      { name: "جلسات", rows: sessions },
    ];
    const sheets = section === "all" ? allSheets : allSheets.filter((_, index) => index === ({ history: 1, finance: 2, appointments: 3 }[section]));
    void exportExcel(`پرونده-${selectedClient.fullName}`, sheets);
  };

  const sortedTreatments = useMemo(() => {
    if (!selectedClient) return [];
    return [...selectedClient.treatments]
      .filter((item) => historyFilter === "all" || item.status === historyFilter)
      .sort((a, b) => {
        if (sectionSort === "alpha") return a.title.localeCompare(b.title, "fa");
        const direction = sectionSort === "date-asc" ? 1 : -1;
        return (new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()) * direction;
      });
  }, [historyFilter, sectionSort, selectedClient]);

  const sortedTransactions = useMemo(() => {
    if (!selectedClient) return [];
    return [...selectedClient.transactions].sort((a, b) => {
      if (sectionSort === "alpha") return (a.serviceName ?? "").localeCompare(b.serviceName ?? "", "fa");
      const direction = sectionSort === "date-asc" ? 1 : -1;
      return (new Date(a.transactionAt).getTime() - new Date(b.transactionAt).getTime()) * direction;
    });
  }, [sectionSort, selectedClient]);

  const sortedAppointments = useMemo(() => {
    if (!selectedClient) return [];
    return [...selectedClient.appointments].sort((a, b) => {
      if (sectionSort === "alpha") return (a.serviceName ?? "").localeCompare(b.serviceName ?? "", "fa");
      const direction = sectionSort === "date-asc" ? 1 : -1;
      return (new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()) * direction;
    });
  }, [sectionSort, selectedClient]);

  const financials = selectedClient ? getFinancials(selectedClient) : null;
  const nextAppointment = selectedClient?.appointments
    .filter((item) => item.status === "scheduled" && new Date(item.startsAt) > new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  return (
    <div className="clinic-app" dir="rtl">
      <header className="top-area">
        <div className="top-nav shell-width">
          <button className="brand" onClick={() => setPageMode("clients")} type="button">
            <span className="brand-mark"><Stethoscope size={24} /></span>
            <span><strong>درمان‌یار</strong><small>سامانه مدیریت کلینیک</small></span>
          </button>
          <nav className="main-nav" aria-label="ناوبری اصلی">
            <button className={pageMode === "clients" ? "active" : ""} type="button" onClick={() => setPageMode("clients")}>
              <LayoutDashboard size={18} /> مراجعین
            </button>
            <button className={pageMode === "services" ? "active" : ""} type="button" onClick={() => setPageMode("services")}>
              <Activity size={18} /> خدمات
            </button>
          </nav>
          <div className="top-actions">
            <button className="sync-status" type="button" onClick={pendingCount ? syncPending : () => setModal("server")}>
              {connectionMode === "offline" || !isOnline ? <CloudOff size={17} /> : <Wifi size={17} />}
              <span>{connectionMode === "offline" ? "حالت آفلاین" : connectionMode === "local" ? "سرور محلی" : "متصل به سرور"}</span>
              {pendingCount ? <b>{numberFormat.format(pendingCount)}</b> : <i />}
            </button>
            <button className="header-icon-button" type="button" onClick={() => setModal("server")} aria-label="تنظیمات سرور">
              <Settings2 size={20} />
            </button>
          </div>
        </div>

        <div className="header-content shell-width">
          <div className="header-title-row">
            <div>
              <span className="eyebrow"><FolderOpen size={15} /> مدیریت پرونده‌ها</span>
              <h1>{pageMode === "clients" ? "کنترل اطلاعات کلاینت" : "نمای خدمات کلینیک"}</h1>
              <p>{pageMode === "clients" ? "جستجو، ثبت و پیگیری تمام مراحل درمان در یک‌جا" : "مشاهده مراجعین هر خدمت؛ انجام‌شده و برنامه‌ریزی‌شده"}</p>
            </div>
            <button className="new-client-button desktop-new" type="button" onClick={pageMode === "clients" ? openNewClient : () => setModal("new-service")}>
              <Plus size={19} /> {pageMode === "clients" ? "کلاینت جدید" : "خدمت جدید"}
            </button>
          </div>

          {pageMode === "clients" ? (
            <div className="search-profile-row">
              <section className="search-card">
                <label>
                  <span>نام کلاینت</span>
                  <div><ContactRound size={18} /><input value={nameSearch} onChange={(event) => setNameSearch(event.target.value)} placeholder="مثلاً مریم احمدی" /></div>
                </label>
                <label>
                  <span>کد ملی یا ID</span>
                  <div><BadgeCheck size={18} /><input value={codeSearch} onChange={(event) => setCodeSearch(event.target.value)} placeholder="کد پرونده یا کد ملی" dir="auto" /></div>
                </label>
                <label>
                  <span>شماره تماس</span>
                  <div><Phone size={18} /><input value={phoneSearch} onChange={(event) => setPhoneSearch(event.target.value)} placeholder="09..." dir="ltr" /></div>
                </label>
                <button className="search-button" type="button"><Search size={19} /><span>جستجو</span></button>
                <button className="mobile-new-button" type="button" onClick={openNewClient}><UserPlus size={20} /></button>
              </section>

              {selectedClient ? (
                <section className="selected-profile">
                  <span className="profile-avatar">{initials(selectedClient.fullName)}</span>
                  <div className="profile-identity">
                    <small>پرونده انتخاب‌شده</small>
                    <strong>{selectedClient.fullName}</strong>
                    <span>{selectedClient.patientCode}</span>
                  </div>
                  <div className="profile-contact">
                    <span><Phone size={14} /> {selectedClient.phones[0]?.phone ?? "بدون شماره"}</span>
                    <span><BadgeCheck size={14} /> {selectedClient.nationalId}</span>
                  </div>
                  <button type="button" onClick={openEditClient}><Pencil size={16} /> ویرایش</button>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="services-header-summary">
              <div><strong>{numberFormat.format(data.services.length)}</strong><span>خدمت فعال</span></div>
              <div><strong>{numberFormat.format(data.clients.reduce((sum, client) => sum + client.services.length, 0))}</strong><span>تخصیص خدمت</span></div>
              <div><strong>{numberFormat.format(data.clients.flatMap((client) => client.services).filter((item) => item.status === "planned").length)}</strong><span>در انتظار انجام</span></div>
            </div>
          )}
        </div>
      </header>

      {pendingCount > 0 ? (
        <button className="offline-banner" type="button" onClick={syncPending}>
          <CloudOff size={18} /> {numberFormat.format(pendingCount)} تغییر در صف آفلاین است.
          <span><RefreshCw size={15} /> همگام‌سازی</span>
        </button>
      ) : null}

      <main className="shell-width main-content">
        {pageMode === "clients" ? (
          <div className={`dashboard-grid ${mobileDetail ? "mobile-detail" : ""}`}>
            <aside className="client-list-panel">
              <div className="panel-heading">
                <div>
                  <h2><Users size={20} /> لیست کلاینت‌ها</h2>
                  <span>{numberFormat.format(filteredClients.length)} پرونده</span>
                </div>
                <button className="excel-mini" type="button" onClick={exportClients} title="خروجی اکسل لیست"><FileSpreadsheet size={18} /></button>
              </div>
              <div className="list-filter-row">
                <ListFilter size={16} />
                <select value={clientSort} onChange={(event) => setClientSort(event.target.value)}>
                  <option value="recent">آخرین تغییرات</option>
                  <option value="name">مرتب‌سازی الفبا</option>
                  <option value="code">مرتب‌سازی کد پرونده</option>
                </select>
              </div>
              <div className="client-scroll-list">
                {filteredClients.map((client) => {
                  const clientNext = client.appointments
                    .filter((item) => item.status === "scheduled" && new Date(item.startsAt) > new Date())
                    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
                  const active = client.services.some((item) => item.status === "in_progress");
                  return (
                    <button
                      className={`client-row ${client.id === selectedId ? "selected" : ""}`}
                      type="button"
                      key={client.id}
                      onClick={() => { setSelectedId(client.id); setMobileDetail(true); }}
                    >
                      <span className={`client-avatar ${active ? "avatar-active" : ""}`}>{initials(client.fullName)}</span>
                      <span className="client-row-main">
                        <strong>{client.fullName}</strong>
                        <small>{client.patientCode} · {client.phones[0]?.phone ?? "بدون شماره"}</small>
                        <em>{clientNext ? <><CalendarDays size={13} /> {faDate(clientNext.startsAt)}، {faTime(clientNext.startsAt)}</> : "جلسه آینده ثبت نشده"}</em>
                      </span>
                      <ChevronLeft size={18} />
                    </button>
                  );
                })}
                {!filteredClients.length ? (
                  <EmptyState icon={<Search size={25} />} title="نتیجه‌ای پیدا نشد" text="عبارت جستجو را تغییر دهید یا کلاینت جدید ثبت کنید." />
                ) : null}
              </div>
              <button className="sidebar-add" type="button" onClick={openNewClient}><Plus size={18} /> افزودن کلاینت جدید</button>
            </aside>

            <section className="case-panel">
              {selectedClient ? (
                <>
                  <button className="mobile-back" type="button" onClick={() => setMobileDetail(false)}><ArrowRight size={18} /> بازگشت به لیست</button>
                  <div className="case-titlebar">
                    <div>
                      <span className="case-kicker"><CircleCheck size={15} /> پرونده فعال</span>
                      <h2>پرونده درمانی {selectedClient.fullName}</h2>
                      <p>آخرین بروزرسانی {faLongDate(selectedClient.updatedAt)}</p>
                    </div>
                    <button className="export-button" type="button" onClick={() => exportClient("all")}><Download size={17} /> خروجی کامل Excel</button>
                  </div>

                  <div className="case-stats">
                    <div className="stat-card stat-blue"><span><Activity size={19} /></span><div><small>خدمات پرونده</small><strong>{numberFormat.format(selectedClient.services.length)} مورد</strong></div></div>
                    <div className="stat-card stat-green"><span><CircleCheck size={19} /></span><div><small>درمان انجام‌شده</small><strong>{numberFormat.format(selectedClient.treatments.filter((item) => item.status === "completed").length)} مورد</strong></div></div>
                    <div className="stat-card stat-orange"><span><CalendarDays size={19} /></span><div><small>جلسه بعدی</small><strong>{nextAppointment ? faDate(nextAppointment.startsAt) : "ثبت نشده"}</strong></div></div>
                    <div className="stat-card stat-purple"><span><WalletCards size={19} /></span><div><small>مانده حساب</small><strong>{financials ? money(financials.due) : "۰ تومان"}</strong></div></div>
                  </div>

                  <section className="service-ribbon">
                    <div className="section-title-inline">
                      <div><span className="section-icon blue"><Stethoscope size={18} /></span><div><h3>خدمات پرونده</h3><p>انتخاب و وضعیت خدمات درمانی</p></div></div>
                      <button type="button" onClick={() => setModal("assign-service")}><Plus size={17} /> انتخاب خدمت</button>
                    </div>
                    <div className="assigned-services">
                      {selectedClient.services.map((service) => (
                        <article className="assigned-service" key={service.id} style={{ "--service-color": service.serviceColor } as CSSProperties}>
                          <i />
                          <div><strong>{service.serviceName}</strong><small>{service.serviceCategory} · {faDate(service.assignedAt)}</small></div>
                          <StatusBadge status={service.status} />
                        </article>
                      ))}
                      {!selectedClient.services.length ? <p className="inline-empty">هنوز خدمتی به پرونده اضافه نشده است.</p> : null}
                    </div>
                  </section>

                  <nav className="case-tabs" aria-label="بخش‌های پرونده">
                    <button className={caseTab === "history" ? "active" : ""} type="button" onClick={() => { setCaseTab("history"); setSectionSort("date-desc"); }}><History size={18} /> سوابق درمان <b>{numberFormat.format(selectedClient.treatments.length)}</b></button>
                    <button className={caseTab === "finance" ? "active" : ""} type="button" onClick={() => { setCaseTab("finance"); setSectionSort("date-desc"); }}><ReceiptText size={18} /> گزارش مالی</button>
                    <button className={caseTab === "appointments" ? "active" : ""} type="button" onClick={() => { setCaseTab("appointments"); setSectionSort("date-asc"); }}><CalendarDays size={18} /> جلسات درمان <b>{numberFormat.format(selectedClient.appointments.length)}</b></button>
                  </nav>

                  <div className="tab-content">
                    {caseTab === "history" ? (
                      <>
                        <div className="content-toolbar">
                          <div className="filter-pills">
                            <button className={historyFilter === "all" ? "active" : ""} type="button" onClick={() => setHistoryFilter("all")}>همه</button>
                            <button className={historyFilter === "completed" ? "active" : ""} type="button" onClick={() => setHistoryFilter("completed")}>انجام‌شده</button>
                            <button className={historyFilter === "planned" ? "active" : ""} type="button" onClick={() => setHistoryFilter("planned")}>برنامه آینده</button>
                          </div>
                          <div className="toolbar-actions">
                            <select value={sectionSort} onChange={(event) => setSectionSort(event.target.value as typeof sectionSort)} aria-label="مرتب‌سازی سوابق">
                              <option value="date-desc">جدیدترین تاریخ</option><option value="date-asc">قدیمی‌ترین تاریخ</option><option value="alpha">ترتیب الفبا</option>
                            </select>
                            <button className="icon-text-button" type="button" onClick={() => exportClient("history")}><FileSpreadsheet size={17} /><span>Excel</span></button>
                            <button className="primary-small" type="button" onClick={() => setModal("treatment")}><Plus size={17} /> ثبت سابقه</button>
                          </div>
                        </div>
                        <div className="data-table-wrap">
                          <table className="data-table">
                            <thead><tr><th>شرح درمان</th><th>خدمت</th><th>تاریخ</th><th>هزینه</th><th>وضعیت</th></tr></thead>
                            <tbody>
                              {sortedTreatments.map((item) => (
                                <tr key={item.id}>
                                  <td><strong>{item.title}</strong><small>{item.description ?? "بدون توضیحات"}</small></td>
                                  <td>{item.serviceName ?? "عمومی"}</td>
                                  <td><span className="date-cell">{faDate(item.performedAt)}</span></td>
                                  <td>{item.cost ? money(item.cost) : "—"}</td>
                                  <td><StatusBadge status={item.status} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {!sortedTreatments.length ? <EmptyState icon={<History size={26} />} title="سابقه‌ای در این بخش نیست" text="یک سابقه درمان جدید برای کلاینت ثبت کنید." /> : null}
                        </div>
                      </>
                    ) : null}

                    {caseTab === "finance" && financials ? (
                      <>
                        <div className="finance-summary">
                          <article><span className="finance-icon blue"><ReceiptText size={20} /></span><div><small>جمع صورتحساب</small><strong>{money(financials.invoice)}</strong></div></article>
                          <article><span className="finance-icon green"><CreditCard size={20} /></span><div><small>پرداختی کلاینت</small><strong>{money(financials.paid)}</strong></div></article>
                          <article><span className="finance-icon orange"><BadgeCheck size={20} /></span><div><small>تخفیف اعمال‌شده</small><strong>{money(financials.discount)}</strong></div></article>
                          <article className="due-card"><span className="finance-icon red"><Banknote size={20} /></span><div><small>مانده قابل پرداخت</small><strong>{money(financials.due)}</strong></div></article>
                        </div>
                        <div className="content-toolbar">
                          <div><h3 className="toolbar-title">تراکنش‌های مالی</h3><p className="toolbar-subtitle">تمام صورتحساب‌ها و پرداخت‌های ثبت‌شده</p></div>
                          <div className="toolbar-actions">
                            <select value={sectionSort} onChange={(event) => setSectionSort(event.target.value as typeof sectionSort)} aria-label="مرتب‌سازی مالی"><option value="date-desc">جدیدترین تاریخ</option><option value="date-asc">قدیمی‌ترین تاریخ</option><option value="alpha">نام خدمت</option></select>
                            <button className="icon-text-button" type="button" onClick={() => exportClient("finance")}><FileSpreadsheet size={17} /><span>Excel</span></button>
                            <button className="primary-small" type="button" onClick={() => setModal("payment")}><Plus size={17} /> ثبت پرداخت</button>
                          </div>
                        </div>
                        <div className="data-table-wrap">
                          <table className="data-table finance-table">
                            <thead><tr><th>نوع تراکنش</th><th>خدمت / شرح</th><th>تاریخ</th><th>روش پرداخت</th><th>مبلغ</th></tr></thead>
                            <tbody>
                              {sortedTransactions.map((item) => (
                                <tr key={item.id}>
                                  <td><span className={`transaction-type ${item.type}`}>{item.type === "invoice" ? <ReceiptText size={15} /> : <CreditCard size={15} />}{item.type === "invoice" ? "صورتحساب" : item.type === "payment" ? "پرداخت" : "بازپرداخت"}</span></td>
                                  <td><strong>{item.serviceName ?? item.notes ?? "تراکنش عمومی"}</strong><small>{item.reference ? `پیگیری: ${item.reference}` : item.notes ?? "—"}</small></td>
                                  <td>{faDate(item.transactionAt)}</td>
                                  <td>{item.paymentMethod ?? "—"}</td>
                                  <td><strong className={item.type === "payment" ? "amount-positive" : ""}>{item.type === "payment" ? "+ " : ""}{money(item.amount)}</strong>{item.discountPercent > 0 ? <small>{numberFormat.format(item.discountPercent)}٪ تخفیف</small> : null}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : null}

                    {caseTab === "appointments" ? (
                      <>
                        <div className="content-toolbar">
                          <div><h3 className="toolbar-title">برنامه جلسات درمان</h3><p className="toolbar-subtitle">روز و ساعت جلسات ثبت‌شده برای این پرونده</p></div>
                          <div className="toolbar-actions">
                            <select value={sectionSort} onChange={(event) => setSectionSort(event.target.value as typeof sectionSort)} aria-label="مرتب‌سازی جلسات"><option value="date-asc">نزدیک‌ترین تاریخ</option><option value="date-desc">دورترین تاریخ</option><option value="alpha">نام خدمت</option></select>
                            <button className="icon-text-button" type="button" onClick={() => exportClient("appointments")}><FileSpreadsheet size={17} /><span>Excel</span></button>
                            <button className="primary-small" type="button" onClick={() => setModal("appointment")}><CalendarPlus size={17} /> جلسه جدید</button>
                          </div>
                        </div>
                        <div className="appointment-list">
                          {sortedAppointments.map((item) => (
                            <article className="appointment-row" key={item.id}>
                              <div className="date-tile"><strong>{new Intl.DateTimeFormat("fa-IR", { day: "numeric" }).format(new Date(item.startsAt))}</strong><span>{new Intl.DateTimeFormat("fa-IR", { month: "short" }).format(new Date(item.startsAt))}</span></div>
                              <div className="appointment-info"><strong>{item.serviceName ?? "جلسه درمان عمومی"}</strong><span><Clock3 size={15} /> ساعت {faTime(item.startsAt)} · {numberFormat.format(item.durationMinutes)} دقیقه</span>{item.notes ? <small>{item.notes}</small> : null}</div>
                              <span className={`appointment-state ${item.status}`}>{item.status === "scheduled" ? "رزرو شده" : item.status === "completed" ? "انجام شده" : "لغو شده"}</span>
                            </article>
                          ))}
                          {!sortedAppointments.length ? <EmptyState icon={<CalendarDays size={26} />} title="جلسه‌ای ثبت نشده" text="روز و ساعت اولین جلسه را برای این کلاینت ثبت کنید." /> : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              ) : (
                <EmptyState icon={<FolderOpen size={30} />} title="یک پرونده انتخاب کنید" text="از فهرست کلاینت‌ها، پرونده مورد نظر را باز کنید." />
              )}
            </section>
          </div>
        ) : (
          <section className="services-workspace">
            <aside className="service-catalog">
              <div className="panel-heading"><div><h2><Activity size={20} /> لیست خدمات</h2><span>{numberFormat.format(data.services.length)} خدمت</span></div><button className="excel-mini" type="button" onClick={() => setModal("new-service")}><Plus size={18} /></button></div>
              <div className="service-catalog-list">
                {data.services.map((service) => {
                  const count = data.clients.reduce((sum, client) => sum + client.services.filter((item) => item.serviceId === service.id).length, 0);
                  return (
                    <button className={service.id === selectedServiceId ? "selected" : ""} type="button" key={service.id} onClick={() => setSelectedServiceId(service.id)}>
                      <span style={{ background: `${service.color}18`, color: service.color }}><Stethoscope size={19} /></span>
                      <div><strong>{service.name}</strong><small>{service.category} · {numberFormat.format(count)} کلاینت</small></div>
                      <ChevronLeft size={17} />
                    </button>
                  );
                })}
              </div>
            </aside>
            <div className="service-detail-panel">
              {selectedService ? (
                <>
                  <div className="service-detail-head">
                    <div className="service-hero-icon" style={{ background: `${selectedService.color}16`, color: selectedService.color }}><Stethoscope size={27} /></div>
                    <div><span>{selectedService.category}</span><h2>{selectedService.name}</h2><p>{selectedService.description ?? "بدون توضیحات"}</p></div>
                    <div className="service-price"><small>تعرفه پایه</small><strong>{money(selectedService.defaultPrice)}</strong><span>{numberFormat.format(selectedService.durationMinutes)} دقیقه</span></div>
                  </div>
                  <div className="service-report-stats">
                    <article><strong>{numberFormat.format(serviceClients.length)}</strong><span>کل دریافت‌کنندگان</span></article>
                    <article><strong>{numberFormat.format(serviceClients.filter((row) => row.assignment.status === "completed").length)}</strong><span>انجام‌شده</span></article>
                    <article><strong>{numberFormat.format(serviceClients.filter((row) => row.assignment.status === "planned").length)}</strong><span>برنامه آینده</span></article>
                    <article><strong>{numberFormat.format(serviceClients.filter((row) => row.assignment.status === "in_progress").length)}</strong><span>در حال درمان</span></article>
                  </div>
                  <div className="content-toolbar service-toolbar">
                    <div><h3 className="toolbar-title">کلاینت‌های این خدمت</h3><p className="toolbar-subtitle">تمام افرادی که خدمت را گرفته‌اند یا خواهند گرفت</p></div>
                    <div className="toolbar-actions"><select value={serviceSort} onChange={(event) => setServiceSort(event.target.value as typeof serviceSort)}><option value="date-desc">جدیدترین تاریخ</option><option value="date-asc">قدیمی‌ترین تاریخ</option><option value="alpha">ترتیب الفبا</option></select><button className="icon-text-button" type="button" onClick={exportServiceReport}><FileSpreadsheet size={17} /> Excel</button></div>
                  </div>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead><tr><th>کلاینت</th><th>شماره تماس</th><th>تاریخ تخصیص</th><th>مبلغ توافقی</th><th>وضعیت</th></tr></thead>
                      <tbody>
                        {serviceClients.map(({ client, assignment }) => (
                          <tr key={assignment.id} className="clickable-row" onClick={() => { setSelectedId(client.id); setPageMode("clients"); }}>
                            <td><div className="table-client"><span>{initials(client.fullName)}</span><div><strong>{client.fullName}</strong><small>{client.patientCode}</small></div></div></td>
                            <td dir="ltr">{client.phones[0]?.phone ?? "—"}</td><td>{faDate(assignment.assignedAt)}</td><td>{money(assignment.agreedPrice)}</td><td><StatusBadge status={assignment.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!serviceClients.length ? <EmptyState icon={<Users size={26} />} title="هنوز کلاینتی وجود ندارد" text="این خدمت هنوز به هیچ پرونده‌ای تخصیص داده نشده است." /> : null}
                  </div>
                </>
              ) : null}
            </div>
          </section>
        )}
      </main>

      {modal === "new-client" ? (
        <Modal title="ثبت کلاینت جدید" subtitle="اطلاعات هویتی و شماره‌های تماس را وارد کنید." onClose={() => setModal(null)} wide>
          <form className="modal-form" onSubmit={(event) => submitClient(event)}>
            <div className="form-grid two-column"><label><span>نام و نام خانوادگی *</span><input name="fullName" required placeholder="مثلاً علی رضایی" autoFocus /></label><label><span>کد ملی *</span><input name="nationalId" required inputMode="numeric" placeholder="۱۰ رقم" dir="ltr" /></label><label><span>تاریخ تولد</span><input name="birthDate" placeholder="۱۳۷۵/۰۵/۱۲" dir="ltr" /></label><label className="span-two"><span>یادداشت پرونده</span><textarea name="notes" rows={2} placeholder="حساسیت‌ها یا توضیحات مهم..." /></label></div>
            <PhoneFields values={phoneInputs} onChange={setPhoneInputs} />
            <ModalActions saving={isSaving} onClose={() => setModal(null)} label="ثبت و ایجاد پرونده" />
          </form>
        </Modal>
      ) : null}

      {modal === "edit-client" && selectedClient ? (
        <Modal title="ویرایش پروفایل کلاینت" subtitle={`کد پرونده ${selectedClient.patientCode}`} onClose={() => setModal(null)} wide>
          <form className="modal-form" onSubmit={(event) => submitClient(event, true)}>
            <div className="form-grid two-column"><label><span>نام و نام خانوادگی *</span><input name="fullName" required defaultValue={selectedClient.fullName} autoFocus /></label><label><span>کد ملی *</span><input name="nationalId" required defaultValue={selectedClient.nationalId} dir="ltr" /></label><label><span>تاریخ تولد</span><input name="birthDate" defaultValue={selectedClient.birthDate ?? ""} dir="ltr" /></label><label className="span-two"><span>یادداشت پرونده</span><textarea name="notes" rows={2} defaultValue={selectedClient.notes ?? ""} /></label></div>
            <PhoneFields values={phoneInputs} onChange={setPhoneInputs} />
            <ModalActions saving={isSaving} onClose={() => setModal(null)} label="ذخیره تغییرات" />
          </form>
        </Modal>
      ) : null}

      {modal === "assign-service" && selectedClient ? (
        <Modal title="انتخاب خدمت" subtitle={`افزودن خدمت به پرونده ${selectedClient.fullName}`} onClose={() => setModal(null)}>
          <form className="modal-form" onSubmit={(event) => submitSimple(event, "assignService", { clientId: selectedClient.id })}>
            <div className="form-grid"><label><span>خدمت درمانی *</span><select name="serviceId" required defaultValue=""><option value="" disabled>یک خدمت انتخاب کنید</option>{data.services.map((service) => <option value={service.id} key={service.id}>{service.name} — {money(service.defaultPrice)}</option>)}</select></label><label><span>مبلغ توافقی (تومان) *</span><input name="agreedPrice" required type="number" min="0" placeholder="مثلاً 12000000" /></label><label><span>درصد تخفیف</span><div className="input-suffix"><input name="discountPercent" type="number" min="0" max="100" defaultValue="0" /><span>٪</span></div></label><label><span>توضیحات</span><textarea name="notes" rows={2} placeholder="توضیحات تکمیلی خدمت..." /></label></div>
            <ModalActions saving={isSaving} onClose={() => setModal(null)} label="افزودن خدمت" />
          </form>
        </Modal>
      ) : null}

      {modal === "treatment" && selectedClient ? (
        <Modal title="ثبت سابقه درمان" subtitle="کار انجام‌شده یا برنامه آینده را ثبت کنید." onClose={() => setModal(null)} wide>
          <form className="modal-form" onSubmit={(event) => submitSimple(event, "addTreatment", { clientId: selectedClient.id })}>
            <div className="form-grid two-column"><label><span>عنوان درمان *</span><input name="title" required placeholder="مثلاً مرحله دوم عصب‌کشی" autoFocus /></label><label><span>خدمت مرتبط</span><select name="clientServiceId"><option value="">درمان عمومی</option>{selectedClient.services.map((service) => <option value={service.id} key={service.id}>{service.serviceName}</option>)}</select></label><label><span>تاریخ و ساعت *</span><input name="performedAt" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} /></label><label><span>وضعیت</span><select name="status" defaultValue="completed"><option value="completed">انجام شده</option><option value="planned">برنامه آینده</option><option value="in_progress">در حال انجام</option></select></label><label><span>هزینه این مرحله (تومان)</span><input name="cost" type="number" min="0" defaultValue="0" /></label><label className="span-two"><span>شرح درمان</span><textarea name="description" rows={3} placeholder="جزئیات اقدامات انجام‌شده..." /></label></div>
            <ModalActions saving={isSaving} onClose={() => setModal(null)} label="ثبت سابقه" />
          </form>
        </Modal>
      ) : null}

      {modal === "payment" && selectedClient ? (
        <Modal title="ثبت پرداخت کلاینت" subtitle={`مانده فعلی: ${financials ? money(financials.due) : "۰ تومان"}`} onClose={() => setModal(null)} wide>
          <form className="modal-form" onSubmit={(event) => submitSimple(event, "addPayment", { clientId: selectedClient.id })}>
            <div className="form-grid two-column"><label><span>مبلغ پرداخت (تومان) *</span><input name="amount" type="number" min="1" required placeholder="مبلغ را وارد کنید" autoFocus /></label><label><span>خدمت مرتبط</span><select name="clientServiceId"><option value="">پرداخت عمومی</option>{selectedClient.services.map((service) => <option value={service.id} key={service.id}>{service.serviceName}</option>)}</select></label><label><span>روش پرداخت</span><select name="paymentMethod" defaultValue="کارت‌خوان"><option>کارت‌خوان</option><option>انتقال بانکی</option><option>نقدی</option><option>درگاه آنلاین</option><option>چک</option></select></label><label><span>درصد تخفیف این پرداخت</span><div className="input-suffix"><input name="discountPercent" type="number" min="0" max="100" defaultValue="0" /><span>٪</span></div></label><label><span>تاریخ پرداخت</span><input name="transactionAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /></label><label><span>شماره پیگیری</span><input name="reference" placeholder="اختیاری" dir="ltr" /></label><label className="span-two"><span>یادداشت</span><textarea name="notes" rows={2} placeholder="توضیحات پرداخت..." /></label></div>
            <ModalActions saving={isSaving} onClose={() => setModal(null)} label="ثبت پرداخت" />
          </form>
        </Modal>
      ) : null}

      {modal === "appointment" && selectedClient ? (
        <Modal title="ثبت جلسه درمان" subtitle="روز، ساعت و مدت جلسه را مشخص کنید." onClose={() => setModal(null)}>
          <form className="modal-form" onSubmit={(event) => submitSimple(event, "addAppointment", { clientId: selectedClient.id })}>
            <div className="form-grid"><label><span>تاریخ و ساعت جلسه *</span><input name="startsAt" type="datetime-local" required defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 16)} autoFocus /></label><label><span>خدمت مرتبط</span><select name="clientServiceId"><option value="">جلسه عمومی</option>{selectedClient.services.map((service) => <option value={service.id} key={service.id}>{service.serviceName}</option>)}</select></label><label><span>مدت جلسه</span><select name="durationMinutes" defaultValue="60"><option value="30">۳۰ دقیقه</option><option value="45">۴۵ دقیقه</option><option value="60">۶۰ دقیقه</option><option value="90">۹۰ دقیقه</option><option value="120">۱۲۰ دقیقه</option></select></label><label><span>یادداشت جلسه</span><textarea name="notes" rows={3} placeholder="مثلاً یادآوری تلفنی یک روز قبل" /></label></div>
            <ModalActions saving={isSaving} onClose={() => setModal(null)} label="ثبت جلسه" />
          </form>
        </Modal>
      ) : null}

      {modal === "new-service" ? (
        <Modal title="تعریف خدمت جدید" subtitle="خدمت پس از ثبت در همه پرونده‌ها قابل انتخاب است." onClose={() => setModal(null)} wide>
          <form className="modal-form" onSubmit={(event) => submitSimple(event, "addService", {})}>
            <div className="form-grid two-column"><label><span>نام خدمت *</span><input name="name" required placeholder="نام خدمت" autoFocus /></label><label><span>دسته‌بندی *</span><input name="category" required placeholder="مثلاً زیبایی" /></label><label><span>تعرفه پایه (تومان) *</span><input name="defaultPrice" type="number" min="0" required /></label><label><span>مدت معمول (دقیقه)</span><input name="durationMinutes" type="number" min="5" defaultValue="60" /></label><label><span>رنگ نمایش</span><input name="color" type="color" defaultValue="#246BFD" className="color-input" /></label><label className="span-two"><span>توضیحات</span><textarea name="description" rows={2} /></label></div>
            <ModalActions saving={isSaving} onClose={() => setModal(null)} label="ثبت خدمت" />
          </form>
        </Modal>
      ) : null}

      {modal === "server" ? (
        <Modal title="اتصال و همگام‌سازی" subtitle="نحوه اتصال دستگاه به سرور اطلاعات را انتخاب کنید." onClose={() => setModal(null)}>
          <form className="modal-form" onSubmit={(event) => {
            event.preventDefault();
            localStorage.setItem("clinic-connection-mode", connectionMode);
            localStorage.setItem("clinic-local-server", localServerUrl);
            setModal(null);
            setToast({ type: "success", text: "تنظیمات اتصال ذخیره شد." });
          }}>
            <div className="connection-options">
              <button className={connectionMode === "cloud" ? "selected" : ""} type="button" onClick={() => setConnectionMode("cloud")}><span><Cloud size={22} /></span><div><strong>سرور آنلاین</strong><small>اتصال امن به سرور همین سامانه</small></div>{connectionMode === "cloud" ? <Check size={18} /> : null}</button>
              <button className={connectionMode === "local" ? "selected" : ""} type="button" onClick={() => setConnectionMode("local")}><span><Server size={22} /></span><div><strong>سرور محلی</strong><small>اتصال به سرور داخل شبکه کلینیک</small></div>{connectionMode === "local" ? <Check size={18} /> : null}</button>
              <button className={connectionMode === "offline" ? "selected" : ""} type="button" onClick={() => setConnectionMode("offline")}><span><HardDrive size={22} /></span><div><strong>کار آفلاین</strong><small>ذخیره تغییرات روی این دستگاه و همگام‌سازی بعدی</small></div>{connectionMode === "offline" ? <Check size={18} /> : null}</button>
            </div>
            {connectionMode === "local" ? <label><span>آدرس سرور محلی</span><input value={localServerUrl} onChange={(event) => setLocalServerUrl(event.target.value)} placeholder="http://192.168.1.10:3000" dir="ltr" /></label> : null}
            <div className="connection-note"><Database size={18} /><p><strong>{pendingCount ? `${numberFormat.format(pendingCount)} تغییر در صف همگام‌سازی` : "اطلاعات همگام است"}</strong><span>در حالت آفلاین، اطلاعات فرم‌ها از بین نمی‌رود.</span></p></div>
            <div className="modal-actions"><button className="secondary-button" type="button" onClick={syncPending} disabled={!pendingCount || connectionMode === "offline" || !isOnline}><RefreshCw size={16} /> همگام‌سازی حالا</button><button className="submit-button" type="submit">ذخیره تنظیمات</button></div>
          </form>
        </Modal>
      ) : null}

      {toast ? <div className={`toast ${toast.type}`}><span>{toast.type === "success" ? <Check size={18} /> : <X size={18} />}</span>{toast.text}</div> : null}
      {isSaving ? <div className="saving-bar"><i /></div> : null}
    </div>
  );
}

function PhoneFields({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return (
    <fieldset className="phone-fieldset">
      <legend>شماره‌های تماس *</legend>
      <p>می‌توانید چند شماره موبایل، منزل یا محل کار ثبت کنید.</p>
      <div className="phone-inputs">
        {values.map((value, index) => (
          <div className="phone-input-row" key={`${index}-${values.length}`}>
            <Phone size={17} />
            <input name={`phone-${index}`} defaultValue={value} required={index === 0} placeholder={index === 0 ? "شماره اصلی" : "شماره جایگزین"} dir="ltr" inputMode="tel" />
            {values.length > 1 ? <button type="button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} aria-label="حذف شماره"><Trash2 size={16} /></button> : null}
          </div>
        ))}
      </div>
      <button className="add-phone" type="button" onClick={() => onChange([...values, ""])}><Plus size={16} /> افزودن شماره دیگر</button>
    </fieldset>
  );
}

function ModalActions({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) {
  return (
    <div className="modal-actions">
      <button className="secondary-button" type="button" onClick={onClose}>انصراف</button>
      <button className="submit-button" type="submit" disabled={saving}>{saving ? <><RefreshCw className="spin" size={17} /> در حال ثبت...</> : label}</button>
    </div>
  );
}
