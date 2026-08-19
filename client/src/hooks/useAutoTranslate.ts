import { useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";

// Comprehensive PT -> EN dictionary for ALL visible text
const PT_TO_EN: Record<string, string> = {
  // Navigation & Layout
  "PROJETO": "PROJECT",
  "Todos os Projetos": "All Projects",
  "Plataforma de Gestão Ambiental": "Environmental Management Platform",
  "Plataforma de Gestão A...": "Environmental Mgmt P...",
  "Plataforma d...": "Env. Mgmt P...",
  
  // Dashboard
  "Visão geral do cumprimento ambiental": "Environmental compliance overview",
  "Fichas Aprovadas": "Approved Forms",
  "Em Revisão": "Under Review",
  "Rascunhos": "Drafts",
  "Projetos Ativos": "Active Projects",
  "Em Incumprimento": "Non-Compliant",
  "Cumprimento por Projeto": "Compliance by Project",
  "Entregáveis & Prazos": "Deliverables & Deadlines",
  "Validados": "Validated",
  "Total Eventos": "Total Events",
  "Atrasados": "Overdue",
  "No prazo": "On time",
  "Sem data": "No date",
  "Próximos Prazos": "Upcoming Deadlines",
  "Ver calendário →": "View calendar →",
  "Fases do Projeto": "Project Phases",
  "Ver timeline →": "View timeline →",
  "Próximo RDCD": "Next RDCD",
  "Gerar RDCD →": "Generate RDCD →",
  "Todas as empresas": "All companies",
  "Todas as semanas": "All weeks",
  "Todos os estados": "All statuses",
  "Todas as secções": "All sections",
  "Implementado": "Implemented",
  "Conforme": "Compliant",
  "Não Conforme": "Non-Compliant",
  "Não Aplicável": "Not Applicable",
  "Em curso": "In progress",
  "Por iniciar": "Not started",
  "Concluída": "Completed",
  
  // Phases
  "Pré-Licenciamento": "Pre-Licensing",
  "Licenciamento": "Licensing",
  "Pré-Construção": "Pre-Construction",
  "Preparação": "Preparation",
  "Preparação Prévia": "Preliminary Preparation",
  "Execução da Obra": "Construction Execution",
  "Finalização": "Finalization",
  "Final Construção": "End of Construction",
  "Exploração": "Operation",
  "Operação": "Operation",
  "Desativação": "Decommissioning",
  "Construção (Preparação)": "Construction (Preparation)",
  "Construção (Execução)": "Construction (Execution)",
  "Final da Construção": "End of Construction",
  "Prévias Licenciamento": "Pre-Licensing",
  
  // Sidebar items
  "Matriz Acompanhamento": "Tracking Matrix",
  "Planos": "Plans",
  "Calendário": "Calendar",
  "Ficha Semanal": "Weekly Form",
  "Gestão de Resíduos": "Waste Management",
  "Certificações": "Certifications",
  "Administração": "Administration",
  
  // Ficha Semanal
  "Nova Ficha": "New Form",
  "Histórico": "History",
  "Revisão": "Review",
  "Matriz": "Matrix",
  "Selecionar Semana": "Select Week",
  "Selecione a semana e o ano para a qual pretende preencher a ficha de controlo.": "Select the week and year for which you want to fill the control form.",
  "Semana": "Week",
  "Ano": "Year",
  "Período:": "Period:",
  "Iniciar Ficha": "Start Form",
  "As respostas da sua última ficha submetida serão carregadas automaticamente como ponto de partida.": "Responses from your last submitted form will be automatically loaded as a starting point.",
  "Guardar": "Save",
  "Submeter": "Submit",
  "Eliminar": "Delete",
  "Adicionar Foto": "Add Photo",
  "Anexar Ficheiro": "Attach File",
  "Comentários": "Comments",
  "Fotos": "Photos",
  "Ficheiros": "Files",
  "Adicionar comentário...": "Add comment...",
  "Mostrar todas as fases": "Show all phases",
  "Apenas fase atual": "Current phase only",
  "Medidas com resposta": "Measures with response",
  "Todas as medidas": "All measures",
  
  // Calendar
  "Calendário de Reporting": "Reporting Calendar",
  "Datas de entrega de reportings": "Reporting delivery dates",
  "Gerir": "Manage",
  "Novo Evento": "New Event",
  "Hoje": "Today",
  "Legenda:": "Legend:",
  "Prazo Regulatório de Submissão": "Regulatory Submission Deadline",
  "Prazo Interno de Preparação": "Internal Preparation Deadline",
  "Submetido": "Submitted",
  "Validado pela Entidade": "Validated by Authority",
  "Em Incumprimento": "Non-Compliant",
  "Elementos a Reportar": "Elements to Report",
  
  // Timeline
  "Timeline do Projeto": "Project Timeline",
  "Vista Geral": "Overview",
  "Fases": "Phases",
  "Definições da Timeline": "Timeline Settings",
  
  // Workflow
  "Fluxo de Submissão": "Submission Workflow",
  "Notas do Projeto": "Project Notes",
  "Adicionar Nota": "Add Note",
  
  // KPI
  "Submeter Dados": "Submit Data",
  "Metas": "Targets",
  "Definições": "Settings",
  "Energia e CO₂": "Energy & CO₂",
  "Água": "Water",
  "Trabalhadores": "Workers",
  "Incidentes": "Incidents",
  "Exportar": "Export",
  "Nova Métrica": "New Metric",
  "Nova Meta": "New Target",
  "Período": "Period",
  "Semestre": "Semester",
  "Projeto": "Project",
  "Mês": "Month",
  
  // Admin
  "Empresas": "Companies",
  "Utilizadores": "Users",
  "Convites": "Invitations",
  "Imagens": "Images",
  "Auditoria": "Audit",
  "Melhorias": "Improvements",
  "Pedidos de Acesso": "Access Requests",
  "Nova Empresa": "New Company",
  "Convidar Novo Utilizador": "Invite New User",
  "Nome completo": "Full Name",
  "Sigla": "Abbreviation",
  "Tipo": "Type",
  "Estado": "Status",
  "Ativa": "Active",
  "Inativa": "Inactive",
  "Cargo": "Role",
  "Projetos": "Projects",
  
  // MIRR / Waste
  "Gestão e rastreio de resíduos de construção": "Construction waste management and tracking",
  "Nova e-GAR": "New e-GAR",
  "Importar e-GAR": "Import e-GAR",
  "Exportar Excel MIRR": "Export MIRR Excel",
  "Resíduos por Mês": "Waste by Month",
  "Reciclado": "Recycled",
  "Incinerado": "Incinerated",
  "Aterro": "Landfill",
  "e-GARs Registadas": "Registered e-GARs",
  "Nenhuma e-GAR registada": "No e-GAR registered",
  
  // RDCD
  "Definir Período": "Define Period",
  "Selecionar Medidas": "Select Measures",
  "Pré-visualizar": "Preview",
  "Gerar Documento": "Generate Document",
  "Indique o intervalo de semanas a incluir no RDCD": "Indicate the week range to include in the RDCD",
  "Semana de início": "Start week",
  "Semana de fim": "End week",
  "Incluir Planos de Monitorização": "Include Monitoring Plans",
  
  // GAMMA
  "Candidatura": "Application",
  "Avaliação": "Assessment",
  "Necessidades": "Needs",
  "Scorecard": "Scorecard",
  "Vencedores": "Winners",
  "Plano de Apoio": "Support Plan",
  "Nova Edição": "New Edition",
  "Nova Candidatura": "New Application",
  
  // Common
  "Guardar Alterações": "Save Changes",
  "Cancelar": "Cancel",
  "Confirmar": "Confirm",
  "Editar": "Edit",
  "Voltar": "Back",
  "Anterior": "Previous",
  "Seguinte": "Next",
  "Pesquisar...": "Search...",
  "Sem prazos definidos": "No deadlines defined",
  "Nenhum resultado": "No results",
  "Carregando...": "Loading...",
  "Erro": "Error",
  "Sucesso": "Success",
  "Atenção": "Warning",
  "Terminar Sessão": "Sign Out",
  "Perfil": "Profile",
  "Deixar Feedback": "Leave Feedback",
  "Modo Escuro": "Dark Mode",
  "Modo Claro": "Light Mode",
  "Português": "Portuguese",
  "English": "English",
  
  // Months
  "Janeiro": "January", "Fevereiro": "February", "Março": "March",
  "Abril": "April", "Maio": "May", "Junho": "June",
  "Julho": "July", "Agosto": "August", "Setembro": "September",
  "Outubro": "October", "Novembro": "November", "Dezembro": "December",
  
  // Days
  "Seg": "Mon", "Ter": "Tue", "Qua": "Wed", "Qui": "Thu",
  "Sex": "Fri", "Sáb": "Sat", "Dom": "Sun",
  
  // Status badges
  "Pendente": "Pending",
  "Aprovada": "Approved",
  "Rejeitada": "Rejected",
  "Submetida": "Submitted",
  "Entregue": "Delivered",
  "Criada": "Created",
};

// Sort by length descending so longer phrases are matched first
const sortedKeys = Object.keys(PT_TO_EN).sort((a, b) => b.length - a.length);

function translateTextNode(node: Text) {
  let text = node.textContent || "";
  let changed = false;
  
  for (const pt of sortedKeys) {
    if (text.includes(pt)) {
      text = text.split(pt).join(PT_TO_EN[pt]);
      changed = true;
    }
  }
  
  if (changed) {
    node.textContent = text;
  }
}

function translatePlaceholder(el: HTMLElement) {
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) {
    for (const pt of sortedKeys) {
      if (placeholder.includes(pt)) {
        el.setAttribute("placeholder", placeholder.split(pt).join(PT_TO_EN[pt]));
        break;
      }
    }
  }
}

function walkAndTranslate(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.hasAttribute("placeholder")) {
        translatePlaceholder(el);
      }
    }
    node = walker.nextNode();
  }
}

export function useAutoTranslate() {
  const { language } = useLanguage();
  
  useEffect(() => {
    if (language !== "en") return;
    
    // Initial translation
    const timer = setTimeout(() => walkAndTranslate(document.body), 100);
    
    // Observe DOM changes and re-translate
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
              walkAndTranslate(node);
            }
          });
        } else if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
          translateTextNode(mutation.target as Text);
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [language]);
}
