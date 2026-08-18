import { Fragment, type ReactNode } from "react";
import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { PreviewCard as BasePreviewCard } from "@base-ui/react/preview-card";
import { ChevronDown, MoreHorizontal, X } from "@gojet/icons";
import { IconButton } from "./index";

export interface MenuAction {
  id: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect?: () => void;
}

export function AlertDialog({ triggerLabel, title, description, confirmLabel = "确认", onConfirm }: { triggerLabel: string; title: string; description: string; confirmLabel?: string; onConfirm?: () => void }) {
  return (
    <BaseAlertDialog.Root>
      <BaseAlertDialog.Trigger className="gj-button" data-variant="destructive" data-size="md">{triggerLabel}</BaseAlertDialog.Trigger>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className="gj-dialog-backdrop" />
        <BaseAlertDialog.Viewport className="gj-dialog-positioner">
          <BaseAlertDialog.Popup className="gj-dialog-popup" role="alertdialog">
            <BaseAlertDialog.Title className="gj-dialog-title">{title}</BaseAlertDialog.Title>
            <BaseAlertDialog.Description className="gj-dialog-description">{description}</BaseAlertDialog.Description>
            <div className="gj-dialog-footer">
              <BaseAlertDialog.Close className="gj-button" data-variant="ghost" data-size="md">取消</BaseAlertDialog.Close>
              <BaseAlertDialog.Close className="gj-button" data-variant="destructive" data-size="md" onClick={onConfirm}>{confirmLabel}</BaseAlertDialog.Close>
            </div>
          </BaseAlertDialog.Popup>
        </BaseAlertDialog.Viewport>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}

export function Popover({ trigger, title, description, children }: { trigger: ReactNode; title: string; description?: string; children?: ReactNode }) {
  return (
    <BasePopover.Root>
      <BasePopover.Trigger className="gj-button" data-variant="outline" data-size="md">{trigger}</BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner className="gj-overlay-positioner" sideOffset={8}>
          <BasePopover.Popup className="gj-overlay-popup">
            <BasePopover.Title className="gj-overlay-title">{title}</BasePopover.Title>
            {description ? <BasePopover.Description className="gj-overlay-description">{description}</BasePopover.Description> : null}
            {children ? <div className="gj-overlay-body">{children}</div> : null}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

function MenuItems({ actions, context = false }: { actions: MenuAction[]; context?: boolean }) {
  if (context) {
    return <>{actions.map((action) => <Fragment key={action.id}>{action.separatorBefore ? <BaseContextMenu.Separator className="gj-menu-separator" /> : null}<BaseContextMenu.Item className="gj-menu-item" data-destructive={action.destructive || undefined} disabled={action.disabled} onClick={action.onSelect}>{action.label}</BaseContextMenu.Item></Fragment>)}</>;
  }
  return <>{actions.map((action) => <Fragment key={action.id}>{action.separatorBefore ? <BaseMenu.Separator className="gj-menu-separator" /> : null}<BaseMenu.Item className="gj-menu-item" data-destructive={action.destructive || undefined} disabled={action.disabled} onClick={action.onSelect}>{action.label}</BaseMenu.Item></Fragment>)}</>;
}

export function DropdownMenu({ label = "更多操作", actions }: { label?: string; actions: MenuAction[] }) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger className="gj-icon-button" aria-label={label} title={label}><MoreHorizontal size={16} strokeWidth={1.75} /></BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner className="gj-overlay-positioner" align="end" sideOffset={6}>
          <BaseMenu.Popup className="gj-menu-popup"><MenuItems actions={actions} /></BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export function SelectMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger className="gj-button" data-variant="outline" data-size="md">{label}<ChevronDown size={16} strokeWidth={1.75} /></BaseMenu.Trigger>
      <BaseMenu.Portal><BaseMenu.Positioner className="gj-overlay-positioner" sideOffset={6}><BaseMenu.Popup className="gj-menu-popup"><MenuItems actions={actions} /></BaseMenu.Popup></BaseMenu.Positioner></BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export function ContextMenu({ children, actions }: { children: ReactNode; actions: MenuAction[] }) {
  return (
    <BaseContextMenu.Root>
      <BaseContextMenu.Trigger className="gj-context-trigger">{children}</BaseContextMenu.Trigger>
      <BaseContextMenu.Portal>
        <BaseContextMenu.Positioner className="gj-overlay-positioner"><BaseContextMenu.Popup className="gj-menu-popup"><MenuItems context actions={actions} /></BaseContextMenu.Popup></BaseContextMenu.Positioner>
      </BaseContextMenu.Portal>
    </BaseContextMenu.Root>
  );
}

export function HoverCard({ href, trigger, children }: { href: string; trigger: ReactNode; children: ReactNode }) {
  return (
    <BasePreviewCard.Root>
      <BasePreviewCard.Trigger className="gj-preview-trigger" href={href}>{trigger}</BasePreviewCard.Trigger>
      <BasePreviewCard.Portal><BasePreviewCard.Positioner className="gj-overlay-positioner" sideOffset={8}><BasePreviewCard.Popup className="gj-preview-popup">{children}</BasePreviewCard.Popup></BasePreviewCard.Positioner></BasePreviewCard.Portal>
    </BasePreviewCard.Root>
  );
}

export function MobileDrawer({ triggerLabel = "打开菜单", title, description, children }: { triggerLabel?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <BaseDrawer.Root swipeDirection="left">
      <BaseDrawer.Trigger className="gj-button" data-variant="outline" data-size="md">{triggerLabel}</BaseDrawer.Trigger>
      <BaseDrawer.Portal>
        <BaseDrawer.Backdrop className="gj-dialog-backdrop" />
        <BaseDrawer.Viewport className="gj-drawer-viewport">
          <BaseDrawer.Popup className="gj-drawer-popup">
            <BaseDrawer.Content className="gj-drawer-content">
              <div className="gj-sheet-head"><div><BaseDrawer.Title className="gj-dialog-title">{title}</BaseDrawer.Title>{description ? <BaseDrawer.Description className="gj-dialog-description">{description}</BaseDrawer.Description> : null}</div><BaseDrawer.Close render={<IconButton label="关闭"><X size={16} /></IconButton>} /></div>
              <div className="gj-sheet-body">{children}</div>
            </BaseDrawer.Content>
          </BaseDrawer.Popup>
        </BaseDrawer.Viewport>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  );
}

export function SideSheet({ triggerLabel, title, description, children }: { triggerLabel: string; title: string; description?: string; children: ReactNode }) {
  return (
    <BaseDrawer.Root swipeDirection="right">
      <BaseDrawer.Trigger className="gj-button" data-variant="primary" data-size="md">{triggerLabel}</BaseDrawer.Trigger>
      <BaseDrawer.Portal>
        <BaseDrawer.Backdrop className="gj-dialog-backdrop" />
        <BaseDrawer.Viewport className="gj-sheet-viewport">
          <BaseDrawer.Popup className="gj-side-sheet-popup">
            <BaseDrawer.Content className="gj-side-sheet-content">
              <div className="gj-sheet-head"><div><BaseDrawer.Title className="gj-dialog-title">{title}</BaseDrawer.Title>{description ? <BaseDrawer.Description className="gj-dialog-description">{description}</BaseDrawer.Description> : null}</div><BaseDrawer.Close render={<IconButton label="关闭"><X size={16} /></IconButton>} /></div>
              <div className="gj-side-sheet-body">{children}</div>
            </BaseDrawer.Content>
          </BaseDrawer.Popup>
        </BaseDrawer.Viewport>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  );
}

export function UserMenu({ name, actions }: { name: string; actions: MenuAction[] }) { return <SelectMenu label={name} actions={actions} />; }