import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onOpenChange, title, children, footer }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-modal-overlay" />
        <Dialog.Content className="ui-modal-content">
          <header className="ui-modal-header">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="ui-modal-close" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </header>
          <div className="ui-modal-body">{children}</div>
          {footer ? <footer className={cn("ui-modal-footer")}>{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
