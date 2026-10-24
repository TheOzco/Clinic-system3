export type CareStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled";
export type TransactionType = "invoice" | "payment" | "refund";

export type PhoneView = {
  id: number;
  phone: string;
  label: string;
  isPrimary: boolean;
};

export type ServiceView = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  defaultPrice: number;
  durationMinutes: number;
  color: string;
  isActive: boolean;
  createdAt: string;
};

export type AssignedServiceView = {
  id: number;
  serviceId: number;
  serviceName: string;
  serviceCategory: string;
  serviceColor: string;
  status: CareStatus;
  agreedPrice: number;
  discountPercent: number;
  assignedAt: string;
  completedAt: string | null;
  notes: string | null;
};

export type TreatmentView = {
  id: number;
  clientServiceId: number | null;
  serviceName: string | null;
  title: string;
  description: string | null;
  status: CareStatus;
  performedAt: string;
  cost: number;
  createdAt: string;
};

export type AppointmentView = {
  id: number;
  clientServiceId: number | null;
  serviceName: string | null;
  startsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: string;
};

export type TransactionView = {
  id: number;
  clientServiceId: number | null;
  serviceName: string | null;
  type: TransactionType;
  amount: number;
  discountPercent: number;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  transactionAt: string;
  createdAt: string;
};

export type ClientView = {
  id: number;
  patientCode: string;
  fullName: string;
  nationalId: string;
  birthDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  phones: PhoneView[];
  services: AssignedServiceView[];
  treatments: TreatmentView[];
  appointments: AppointmentView[];
  transactions: TransactionView[];
};

export type ClinicData = {
  clients: ClientView[];
  services: ServiceView[];
  generatedAt: string;
};

export type MutationAction =
  | "createClient"
  | "updateClient"
  | "assignService"
  | "addTreatment"
  | "addAppointment"
  | "addPayment"
  | "addService";

export type MutationRequest = {
  action: MutationAction;
  payload: Record<string, unknown>;
};
