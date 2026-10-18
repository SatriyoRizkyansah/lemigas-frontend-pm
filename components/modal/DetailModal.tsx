"use client";

import type { ReactNode } from "react";
import { Modal, ModalDetailGrid, ModalDetailItem, ModalSection } from "@/components/modal/Modal";

export type DetailItem = { label: string; value: ReactNode };
export type DetailSection = { title: string; description?: string; items: DetailItem[]; columns?: 1 | 2 | 3 };

export function DetailModal({
  open,
  onClose,
  title,
  description,
  sections,
  footer,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  sections: DetailSection[];
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size={size} footer={footer} bodyClassName="space-y-4">
      {sections.map((section) => (
        <ModalSection key={section.title} title={section.title} description={section.description}>
          <ModalDetailGrid className={section.columns === 1 ? "sm:grid-cols-1" : section.columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : undefined}>
            {section.items.map((item) => (
              <ModalDetailItem key={item.label} label={item.label} value={item.value} />
            ))}
          </ModalDetailGrid>
        </ModalSection>
      ))}
    </Modal>
  );
}
