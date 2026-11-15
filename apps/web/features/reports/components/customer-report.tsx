"use client";

import { ChartCard } from "@/components/data/chart-card";
import { useApiData } from "@/lib/api/use-api-data";
import { loadCustomerReports } from "../api";
import { customerSheets } from "../export-excel";
import { loadCustomersError } from "./manager-dashboard";
import { day, share } from "./report-parts";
import { ReportPage } from "./report-page";

/** M20 (Báo cáo › Bảng báo cáo): current customer snapshot; these endpoints take no period, so there is no date filter. */
export function CustomerReport() {
  const customers = useApiData(loadCustomerReports, loadCustomersError);
  const people = customers.data ?? undefined;
  const chartState = { loading: customers.loading, error: customers.error, onRetry: customers.retry };
  const sheets = customers.data ? () => customerSheets(customers.data!, { now: new Date() }) : null;

  return (
    <ReportPage title="Bảng báo cáo khách hàng" description="Tỷ lệ nhóm tuổi, cơ cấu giới tính và nhu cầu phổ biến của khách hàng đang hoạt động, theo số liệu hiện tại." section="Bảng báo cáo"
      fileSection="khach-hang" sheets={sheets}>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Tỷ lệ khách hàng theo nhóm tuổi" description={people && `${people.age.totalCustomers} khách hàng đang hoạt động, tính đến ${day(people.age.asOf)}.`}
          type="bar" data={people?.age.items ?? []} categoryKey="group" categoryLabel="Nhóm tuổi" series={[{ key: "percentage", label: "Tỷ lệ khách hàng" }]} formatValue={share} {...chartState} />
        <ChartCard title="Cơ cấu giới tính" description={people && `${people.gender.totalCustomers} khách hàng đang hoạt động.`}
          type="pie" data={people?.gender.items ?? []} categoryKey="gender" categoryLabel="Giới tính" series={[{ key: "customers", label: "Khách hàng" }]} {...chartState} />
        <ChartCard title="Nhu cầu phổ biến" description={people && `Tỷ lệ trên ${people.preferences.consentingCustomers} khách đồng ý chia sẻ dữ liệu. Mỗi khách chọn được nhiều nhu cầu nên tổng có thể vượt 100%.`}
          type="horizontal-bar" data={people?.preferences.items ?? []} categoryKey="preference" categoryLabel="Nhu cầu"
          series={[{ key: "percentage", label: "Tỷ lệ khách hàng" }]} formatValue={share} className="lg:col-span-2" {...chartState} />
      </div>
    </ReportPage>
  );
}
