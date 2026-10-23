import { Modal } from "@/components/ui";
import { LEGAL } from "@/lib/legal";

export function LegalModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const doc = LEGAL.find((d) => d.id === id);
  return (
    <Modal open={!!doc} onClose={onClose} title={doc?.title} size="lg" layer={95}>
      <div className="whitespace-pre-line text-sm leading-relaxed text-smoke-300">{doc?.body}</div>
    </Modal>
  );
}
