import ClinicDashboard from "@/components/clinic-dashboard";
import { getClinicData } from "@/lib/clinic-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getClinicData();
  return <ClinicDashboard initialData={data} />;
}
