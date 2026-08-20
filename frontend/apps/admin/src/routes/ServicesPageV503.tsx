import { useQuery } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Badge, Button, ErrorState, Page, PageHeader, Spinner, useLocale } from "@gojet/ui";

type ServiceState = "healthy" | "degraded" | "offline" | "unavailable" | string;
interface RuntimeService {
  service: string;
  status: ServiceState;
  health: string;
  version: string;
  last_seen_at: string | null;
  started_at: string | null;
  uptime_seconds: number | null;
}
interface RuntimeServicesResponse { data: RuntimeService[]; expected_services: number; generated_at: string; }

const serviceNames: Record<string, { en: string; zh: string }> = {
  platformapi: { en: "Platform API", zh: "平台 API" },
  redirectengine: { en: "Redirect Engine", zh: "短链跳转服务" },
  analyticsworker: { en: "Analytics Worker", zh: "访问分析处理服务" },
  analyticsreconciler: { en: "Analytics Reconciler", zh: "访问分析校验服务" },
  fileworker: { en: "File Worker", zh: "文件安全处理服务" },
  mailworker: { en: "Mail Worker", zh: "邮件投递服务" },
  operationsmonitor: { en: "Operations Monitor", zh: "运行监控服务" },
  logreceiver: { en: "Log Receiver", zh: "日志接收服务" }
};

function stateTone(value: ServiceState): "success" | "warning" | "danger" | "neutral" {
  if (value === "healthy") return "success";
  if (value === "degraded") return "warning";
  if (value === "offline" || value === "unavailable") return "danger";
  return "neutral";
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US");
}

function formatUptime(seconds: number | null, zh: boolean) {
  if (seconds === null || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return zh ? `${days} 天 ${hours} 小时` : `${days}d ${hours}h`;
  if (hours > 0) return zh ? `${hours} 小时 ${minutes} 分钟` : `${hours}h ${minutes}m`;
  return zh ? `${minutes} 分钟` : `${minutes}m`;
}

export default function ServicesPageV503() {
  const { locale } = useLocale();
  const zh = locale === "zh-CN";
  const c = (en: string, cn: string) => zh ? cn : en;
  const query = useQuery({
    queryKey: ["admin", "runtime-services", "v5.0.3"],
    queryFn: () => api.get<RuntimeServicesResponse>("/api/admin/runtime-services"),
    refetchInterval: 15_000
  });

  const stateLabel = (state: ServiceState) => ({
    healthy: c("Healthy", "正常"),
    degraded: c("Delayed", "心跳延迟"),
    offline: c("Offline", "离线"),
    unavailable: c("Unavailable", "状态不可用")
  } as Record<string, string>)[state] ?? c("Unknown", "未知");

  if (query.isPending) return <Page><PageHeader title={c("Service status", "服务状态")} description={c("Reading live heartbeat evidence from the running GoJet services.", "正在读取 GoJet 各运行服务的实时心跳状态。")} /><div className="workspace-centered"><Spinner label={c("Loading service status", "正在加载服务状态")} /></div></Page>;
  if (query.isError) return <Page><PageHeader title={c("Service status", "服务状态")} /><ErrorState title={c("Unable to read service status", "无法读取服务状态")} description={c("The runtime health registry could not be read. This is shown as an error instead of marking services healthy.", "运行状态注册表当前无法读取。系统不会在缺少证据时把服务标记为正常。")} action={<Button type="button" onClick={() => query.refetch()}>{c("Retry", "重试")}</Button>} /></Page>;

  const rows = query.data?.data ?? [];
  return <Page data-v503-service-status>
    <PageHeader
      title={c("Service status", "服务状态")}
      description={c("Live status, version and last heartbeat for every GoJet runtime service. A missing heartbeat is reported as offline, never guessed as healthy.", "查看 GoJet 各运行服务的实时状态、版本和最近心跳。没有心跳证据时会明确显示为离线，不会推测为正常。")} 
      actions={<Button type="button" variant="outline" onClick={() => query.refetch()} loading={query.isFetching}>{c("Refresh", "刷新")}</Button>}
    />
    <div className="workspace-table-wrap">
      <table className="workspace-table">
        <thead><tr><th>{c("Service", "服务")}</th><th>{c("Status", "状态")}</th><th>{c("Runtime evidence", "运行状态")}</th><th>{c("Version", "版本")}</th><th>{c("Last heartbeat", "最近心跳")}</th><th>{c("Uptime", "运行时长")}</th></tr></thead>
        <tbody>{rows.map((item) => {
          const name = serviceNames[item.service];
          return <tr key={item.service}>
            <td><strong>{name ? (zh ? name.zh : name.en) : item.service}</strong><small>{item.service}</small></td>
            <td><Badge tone={stateTone(item.status)}>{stateLabel(item.status)}</Badge></td>
            <td>{item.status === "healthy" ? c("Heartbeat received", "心跳正常") : item.status === "degraded" ? c("Heartbeat delayed", "心跳出现延迟") : item.status === "offline" ? c("No recent heartbeat", "未收到近期心跳") : c("Health registry unavailable", "运行状态注册表不可用")}</td>
            <td>{item.version || "—"}</td>
            <td>{formatDate(item.last_seen_at, locale)}</td>
            <td>{formatUptime(item.uptime_seconds, zh)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="p14-muted">{c(`Expected services: ${query.data?.expected_services ?? rows.length}. The page refreshes every 15 seconds.`, `应运行服务：${query.data?.expected_services ?? rows.length} 个。页面每 15 秒自动刷新。`)}</p>
  </Page>;
}
