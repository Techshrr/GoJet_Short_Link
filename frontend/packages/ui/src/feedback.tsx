import type { ReactNode } from "react";
import { Toast as BaseToast } from "@base-ui/react/toast";
import { CheckCircle2, Info, TriangleAlert, X } from "@gojet/icons";
import { useLocale } from "./locale";

export type ToastTone = "info" | "success" | "warning" | "danger";
export const toastManager = BaseToast.createToastManager();

export function notify({ title, description, tone = "info" }: { title: string; description?: string; tone?: ToastTone }) {
  return toastManager.add({ title, ...(description ? { description } : {}), type: tone, priority: tone === "danger" ? "high" : "low" });
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") return <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" />;
  if (tone === "warning" || tone === "danger") return <TriangleAlert size={18} strokeWidth={1.75} aria-hidden="true" />;
  return <Info size={18} strokeWidth={1.75} aria-hidden="true" />;
}

function ToastList() {
  const { text } = useLocale();
  const { toasts } = BaseToast.useToastManager();
  return toasts.map((toast) => {
    const tone = (["info", "success", "warning", "danger"] as const).includes(toast.type as ToastTone) ? toast.type as ToastTone : "info";
    return (
      <BaseToast.Root key={toast.id} toast={toast} swipeDirection="right" className="gj-toast" data-tone={tone}>
        <BaseToast.Content className="gj-toast-content">
          <ToastIcon tone={tone} />
          <div className="gj-toast-copy">
            <BaseToast.Title className="gj-toast-title" />
            <BaseToast.Description className="gj-toast-description" />
          </div>
          <BaseToast.Close className="gj-toast-close" aria-label={text("Close notification", "关闭通知")}><X size={16} strokeWidth={1.75} aria-hidden="true" /></BaseToast.Close>
        </BaseToast.Content>
      </BaseToast.Root>
    );
  });
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <BaseToast.Provider toastManager={toastManager} timeout={5000} limit={4}>
      {children}
      <BaseToast.Portal>
        <BaseToast.Viewport className="gj-toast-viewport"><ToastList /></BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}
