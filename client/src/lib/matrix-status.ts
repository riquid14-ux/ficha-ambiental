export type MatrixStatusDisplay = {
  label: string;
  color: string;
  textColor: string;
  description: string;
};

export function getMatrixStatusDisplay(status: string): MatrixStatusDisplay {
  switch (status) {
    case "draft":
      return { label: "Criada", color: "bg-amber-400", textColor: "text-amber-900", description: "Ficha criada (rascunho)" };
    case "submitted":
    case "under_review":
      return { label: "Em Revisão", color: "bg-blue-400", textColor: "text-blue-900", description: "Em processo de revisão" };
    case "approved":
      return { label: "Aprovada", color: "bg-emerald-500", textColor: "text-white", description: "Ficha aprovada" };
    case "rejected":
      return { label: "Rejeitada", color: "bg-red-500", textColor: "text-white", description: "Rejeitada — necessita correção" };
    default:
      return { label: "—", color: "bg-muted", textColor: "text-muted-foreground", description: "" };
  }
}
