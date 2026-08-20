import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { AlertCircle, AlertTriangle, Check, Info, LoaderCircle } from "@gojet/icons";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "hero";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  loading?: boolean | undefined;
}

export function Button({ variant = "primary", size = "md", loading = false, disabled, children, ...props }: ButtonProps) {
  return (
    <button className="gj-button" data-variant={variant} data-size={size} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <LoaderCircle aria-hidden="true" size={16} strokeWidth={1.75} className="gj-spinner" /> : null}
      <span>{children}</span>
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { label: string; }
export function IconButton({ label, children, ...props }: IconButtonProps) {
  return <button type="button" className="gj-icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}

export interface FieldProps { label: string; htmlFor: string; help?: string | undefined; error?: string | undefined; required?: boolean | undefined; children: ReactNode; }
export function Field({ label, htmlFor, help, error, required, children }: FieldProps) {
  return (
    <div className="gj-field">
      <label className="gj-label" htmlFor={htmlFor}>{label}{required ? " *" : ""}</label>
      {children}
      {error ? <div className="gj-error" role="alert">{error}</div> : help ? <div className="gj-help">{help}</div> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className="gj-input" {...props} />; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className="gj-textarea" {...props} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select className="gj-select" {...props} />; }

export interface CheckboxProps { checked?: boolean | undefined; defaultChecked?: boolean | undefined; onCheckedChange?: ((checked: boolean) => void) | undefined; label: ReactNode; disabled?: boolean | undefined; }
export function Checkbox({ label, ...props }: CheckboxProps) {
  return (
    <label className="gj-check-row">
      <BaseCheckbox.Root className="gj-checkbox" {...props}>
        <BaseCheckbox.Indicator><Check aria-hidden="true" size={14} strokeWidth={2} /></BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <span>{label}</span>
    </label>
  );
}

export interface SwitchProps { checked?: boolean | undefined; defaultChecked?: boolean | undefined; onCheckedChange?: ((checked: boolean) => void) | undefined; label: string; disabled?: boolean | undefined; }
export function Switch({ label, ...props }: SwitchProps) {
  return (
    <label className="gj-check-row">
      <BaseSwitch.Root className="gj-switch" aria-label={label} {...props}><BaseSwitch.Thumb className="gj-switch-thumb" /></BaseSwitch.Root>
      <span>{label}</span>
    </label>
  );
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";
export function Badge({ tone = "neutral", children }: { tone?: Tone | undefined; children: ReactNode }) { return <span className="gj-badge" data-tone={tone}>{children}</span>; }
export const StatusBadge = Badge;

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger" | undefined; title: string; children: ReactNode }) {
  const Icon = tone === "danger" ? AlertCircle : tone === "warning" ? AlertTriangle : Info;
  return <div className="gj-alert" data-tone={tone} role={tone === "danger" ? "alert" : "status"}><Icon aria-hidden="true" size={18} strokeWidth={1.75} /><div><p className="gj-alert-title">{title}</p><p className="gj-alert-description">{children}</p></div></div>;
}

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) { return <span className={`gj-skeleton ${className}`.trim()} aria-hidden="true" {...props} />; }
export function Spinner({ label = "正在加载" }: { label?: string | undefined }) { return <LoaderCircle className="gj-spinner" role="status" aria-label={label} size={18} strokeWidth={1.75} />; }

export interface EmptyStateProps { icon?: ReactNode | undefined; title: string; description: string; action?: ReactNode | undefined; }
export function EmptyState({ icon, title, description, action }: EmptyStateProps) { return <div className="gj-empty">{icon}<h3>{title}</h3><p>{description}</p>{action}</div>; }
export function ErrorState({ title = "无法加载内容", description, action }: Omit<EmptyStateProps, "icon">) { return <EmptyState icon={<AlertCircle aria-hidden="true" size={30} strokeWidth={1.75} />} title={title} description={description} action={action} />; }

export function Page(props: HTMLAttributes<HTMLElement>) { return <main className="gj-page" {...props} />; }
export function PageHeader({ title, description, actions }: { title: string; description?: string | undefined; actions?: ReactNode | undefined }) { return <header className="gj-page-header"><div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{actions ? <div className="gj-page-actions">{actions}</div> : null}</header>; }
export function PageSection({ title, children }: { title?: string | undefined; children: ReactNode }) { return <section className="gj-section">{title ? <h2 className="gj-section-title">{title}</h2> : null}{children}</section>; }

export function DataRegion({ title, description, actions, children }: { title?: string | undefined; description?: string | undefined; actions?: ReactNode | undefined; children: ReactNode }) {
  return <section className="gj-section gj-data-region"><header className="gj-region-header"><div>{title ? <h2 className="gj-section-title">{title}</h2> : null}{description ? <p>{description}</p> : null}</div>{actions}</header>{children}</section>;
}
export function SettingsSection({ title, description, children }: { title: string; description?: string | undefined; children: ReactNode }) {
  return <section className="gj-section gj-settings-section"><header><h2 className="gj-section-title">{title}</h2>{description ? <p>{description}</p> : null}</header><div className="gj-section-body">{children}</div></section>;
}
export function FormSection({ title, description, children }: { title: string; description?: string | undefined; children: ReactNode }) {
  return <fieldset className="gj-section gj-form-section"><legend className="gj-section-title">{title}</legend>{description ? <p>{description}</p> : null}<div className="gj-section-body">{children}</div></fieldset>;
}

export function Table({ children, label }: { children: ReactNode; label: string }) { return <div className="gj-table-wrap"><table className="gj-table" aria-label={label}>{children}</table></div>; }

export interface TabItem { value: string; label: string; content: ReactNode; }
export function Tabs({ items, defaultValue }: { items: TabItem[]; defaultValue: string }) {
  return <BaseTabs.Root defaultValue={defaultValue}><BaseTabs.List className="gj-tabs-list">{items.map((item) => <BaseTabs.Tab key={item.value} className="gj-tab" value={item.value}>{item.label}</BaseTabs.Tab>)}</BaseTabs.List>{items.map((item) => <BaseTabs.Panel key={item.value} className="gj-tab-panel" value={item.value}>{item.content}</BaseTabs.Panel>)}</BaseTabs.Root>;
}

export interface DialogProps { triggerLabel: string; title: string; description?: string | undefined; children: ReactNode; confirmLabel?: string | undefined; onConfirm?: (() => void) | undefined; destructive?: boolean | undefined; }
export function Dialog({ triggerLabel, title, description, children, confirmLabel = "确认", onConfirm, destructive = false }: DialogProps) {
  return <BaseDialog.Root><BaseDialog.Trigger className="gj-button" data-variant="outline" data-size="md">{triggerLabel}</BaseDialog.Trigger><BaseDialog.Portal><BaseDialog.Backdrop className="gj-dialog-backdrop" /><BaseDialog.Viewport className="gj-dialog-positioner"><BaseDialog.Popup className="gj-dialog-popup"><BaseDialog.Title className="gj-dialog-title">{title}</BaseDialog.Title>{description ? <BaseDialog.Description className="gj-dialog-description">{description}</BaseDialog.Description> : null}<div className="gj-dialog-body">{children}</div><div className="gj-dialog-footer"><BaseDialog.Close className="gj-button" data-variant="ghost" data-size="md">取消</BaseDialog.Close><BaseDialog.Close className="gj-button" data-variant={destructive ? "destructive" : "primary"} data-size="md" onClick={onConfirm}>{confirmLabel}</BaseDialog.Close></div></BaseDialog.Popup></BaseDialog.Viewport></BaseDialog.Portal></BaseDialog.Root>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return <BaseTooltip.Provider><BaseTooltip.Root><BaseTooltip.Trigger render={<span />}>{children}</BaseTooltip.Trigger><BaseTooltip.Portal><BaseTooltip.Positioner className="gj-tooltip-positioner" sideOffset={6}><BaseTooltip.Popup className="gj-tooltip-popup">{label}</BaseTooltip.Popup></BaseTooltip.Positioner></BaseTooltip.Portal></BaseTooltip.Root></BaseTooltip.Provider>;
}

export interface BreadcrumbItem { label: string; href?: string | undefined; }
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) { return <nav className="gj-breadcrumb" aria-label="面包屑">{items.map((item, index) => <span key={`${item.label}-${index}`}>{index > 0 ? <span aria-hidden="true">/ </span> : null}{item.href ? <a href={item.href}>{item.label}</a> : <span aria-current="page">{item.label}</span>}</span>)}</nav>; }

export { LocaleProvider, LocaleSwitch, LocalizedSurface, localized, localizedError, useLocale, type GoJetLocale } from "./locale";