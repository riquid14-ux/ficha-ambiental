export type DocumentLibraryViewRole = "admin" | "dono_obra" | "pm" | "raa" | "ee" | "ee_partner" | "rap" | "observador" | "user" | undefined;

type CentralDocument = {
  id: number;
  isProjectCentral: number;
  isMandatoryRead: number;
};

const READER_ROLES = new Set<Exclude<DocumentLibraryViewRole, undefined>>([
  "admin",
  "dono_obra",
  "pm",
  "raa",
  "ee",
]);

/**
 * Fonte única para a apresentação de consulta. A gestão fica exclusivamente
 * na Administração; esta página nunca expõe ações de criação ou alteração.
 */
export function getDocumentLibraryView<T extends CentralDocument>(role: DocumentLibraryViewRole, documents: T[]) {
  const canRead = !!role && READER_ROLES.has(role);
  return {
    canRead,
    showManagementControls: false,
    centralDocuments: canRead ? documents.filter(document => document.isProjectCentral === 1) : [],
  };
}
