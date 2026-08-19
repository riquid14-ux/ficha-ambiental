import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "pt" | "en";

// Full translation dictionary
const translations: Record<string, Record<Lang, string>> = {
  // ─── Navigation / Sidebar ───
  "Dashboard": { pt: "Dashboard", en: "Dashboard" },
  "Matriz": { pt: "Matriz", en: "Tracking Matrix" },
  "Planos": { pt: "Planos", en: "Monitoring Plans" },
  "Calendário": { pt: "Calendário", en: "Calendar" },
  "Timeline": { pt: "Timeline", en: "Timeline" },
  "RDCD": { pt: "RDCD", en: "RDCD Report" },
  "GAMMA": { pt: "GAMMA", en: "GAMMA" },
  "Administração": { pt: "Administração", en: "Administration" },
  "Workflow": { pt: "Workflow", en: "Workflow" },
  "Ficha Semanal": { pt: "Ficha Semanal", en: "Weekly Form" },
  "Fases": { pt: "Fases", en: "Phases" },
  "Gestão de Resíduos": { pt: "Gestão de Resíduos", en: "Waste Management" },
  "KPI's": { pt: "KPI's", en: "KPIs" },
  "Certificações": { pt: "Certificações", en: "Certifications" },
  "MIRR": { pt: "MIRR", en: "MIRR" },
  "Perfil": { pt: "Perfil", en: "Profile" },
  "Deixar Feedback": { pt: "Deixar Feedback", en: "Leave Feedback" },
  "Terminar Sessão": { pt: "Terminar Sessão", en: "Sign Out" },
  "PROJETO": { pt: "PROJETO", en: "PROJECT" },
  "Todos os Projetos": { pt: "Todos os Projetos", en: "All Projects" },

  // ─── Dashboard ───
  "Visão geral do cumprimento ambiental": { pt: "Visão geral do cumprimento ambiental", en: "Environmental compliance overview" },
  "Fichas Aprovadas": { pt: "Fichas Aprovadas", en: "Approved Forms" },
  "Em Revisão": { pt: "Em Revisão", en: "Under Review" },
  "Projetos Ativos": { pt: "Projetos Ativos", en: "Active Projects" },
  "Em Incumprimento": { pt: "Em Incumprimento", en: "Non-Compliant" },
  "Cumprimento por Projeto": { pt: "Cumprimento por Projeto", en: "Compliance by Project" },
  "Entregáveis & Prazos": { pt: "Entregáveis & Prazos", en: "Deliverables & Deadlines" },
  "Validados": { pt: "Validados", en: "Validated" },
  "Total Eventos": { pt: "Total Eventos", en: "Total Events" },
  "Atrasados": { pt: "Atrasados", en: "Overdue" },
  "Resumo Geral": { pt: "Resumo Geral", en: "General Summary" },
  "Total de Fichas": { pt: "Total de Fichas", en: "Total Forms" },
  "Taxa de Aprovação": { pt: "Taxa de Aprovação", en: "Approval Rate" },
  "Empresas Ativas": { pt: "Empresas Ativas", en: "Active Companies" },
  "Próximo RDCD": { pt: "Próximo RDCD", en: "Next RDCD" },
  "Actividade de Submissão": { pt: "Actividade de Submissão", en: "Submission Activity" },
  "Evolução Semanal": { pt: "Evolução Semanal", en: "Weekly Evolution" },
  "Evolução do Projeto": { pt: "Evolução do Projeto", en: "Project Evolution" },
  "Distribuição por Entidade Executante": { pt: "Distribuição por Entidade Executante", en: "Distribution by Contractor" },
  "Distribuição por Estado": { pt: "Distribuição por Estado", en: "Distribution by Status" },
  "No prazo": { pt: "No prazo", en: "On track" },
  "Em atraso": { pt: "Em atraso", en: "Overdue" },
  "Sem data": { pt: "Sem data", en: "No date" },

  // ─── Ficha Semanal ───
  "Nova Ficha": { pt: "Nova Ficha", en: "New Form" },
  "Rascunhos": { pt: "Rascunhos", en: "Drafts" },
  "Histórico": { pt: "Histórico", en: "History" },
  "Revisão": { pt: "Revisão", en: "Review" },
  "Submeter": { pt: "Submeter", en: "Submit" },
  "Resubmeter": { pt: "Resubmeter", en: "Resubmit" },
  "Guardar": { pt: "Guardar", en: "Save" },
  "Cancelar": { pt: "Cancelar", en: "Cancel" },
  "Eliminar": { pt: "Eliminar", en: "Delete" },
  "Editar": { pt: "Editar", en: "Edit" },
  "Adicionar": { pt: "Adicionar", en: "Add" },
  "Exportar": { pt: "Exportar", en: "Export" },
  "Importar": { pt: "Importar", en: "Import" },
  "Guardado com sucesso": { pt: "Guardado com sucesso", en: "Saved successfully" },
  "Ficha submetida com sucesso!": { pt: "Ficha submetida com sucesso!", en: "Form submitted successfully!" },
  "Selecione a semana": { pt: "Selecione a semana", en: "Select week" },
  "Iniciar Ficha": { pt: "Iniciar Ficha", en: "Start Form" },
  "Conforme": { pt: "Conforme", en: "Compliant" },
  "Não Conforme": { pt: "Não Conforme", en: "Non-Compliant" },
  "Implementado": { pt: "Implementado", en: "Implemented" },
  "Não Aplicável": { pt: "Não Aplicável", en: "Not Applicable" },
  "Observações": { pt: "Observações", en: "Observations" },
  "Responsável": { pt: "Responsável", en: "Responsible" },
  "Mostrar todas as fases": { pt: "Mostrar todas as fases", en: "Show all phases" },
  "Mostrar só fase atual": { pt: "Mostrar só fase atual", en: "Show current phase only" },
  "Fase atual": { pt: "Fase atual", en: "Current phase" },
  "A mostrar todas as fases": { pt: "A mostrar todas as fases", en: "Showing all phases" },
  "medidas": { pt: "medidas", en: "measures" },
  "Submetida — Aguarda Revisão": { pt: "Submetida — Aguarda Revisão", en: "Submitted — Awaiting Review" },

  // ─── Matriz ───
  "Visão Agregada por Empresa": { pt: "Visão Agregada por Empresa", en: "Aggregated View by Company" },
  "Cada linha representa uma empresa": { pt: "Cada linha representa uma empresa", en: "Each row represents a company" },
  "Entregue": { pt: "Entregue", en: "Delivered" },
  "Criada (Rascunho)": { pt: "Criada (Rascunho)", en: "Created (Draft)" },
  "Rejeitada": { pt: "Rejeitada", en: "Rejected" },
  "Sem ficha": { pt: "Sem ficha", en: "No form" },
  "Parcialmente entregue": { pt: "Parcialmente entregue", en: "Partially delivered" },

  // ─── Review ───
  "Fichas Pendentes de Revisão": { pt: "Fichas Pendentes de Revisão", en: "Forms Pending Review" },
  "Já Revistas": { pt: "Já Revistas", en: "Already Reviewed" },
  "Aprovar Ficha": { pt: "Aprovar Ficha", en: "Approve Form" },
  "Rejeitar Ficha": { pt: "Rejeitar Ficha", en: "Reject Form" },
  "Revisão submetida com sucesso": { pt: "Revisão submetida com sucesso", en: "Review submitted successfully" },
  "Não pode aprovar uma ficha que criou ou submeteu.": { pt: "Não pode aprovar uma ficha que criou ou submeteu.", en: "You cannot approve a form you created or submitted." },
  "Separação de funções: peça a outro revisor para avaliar esta ficha.": { pt: "Separação de funções: peça a outro revisor para avaliar esta ficha.", en: "Separation of duties: ask another reviewer to evaluate this form." },

  // ─── Admin ───
  "Empresas": { pt: "Empresas", en: "Companies" },
  "Utilizadores": { pt: "Utilizadores", en: "Users" },
  "Convites": { pt: "Convites", en: "Invitations" },
  "Melhorias": { pt: "Melhorias", en: "Improvements" },
  "Pedidos de Acesso": { pt: "Pedidos de Acesso", en: "Access Requests" },
  "Auditoria": { pt: "Auditoria", en: "Audit Log" },
  "Nova Empresa": { pt: "Nova Empresa", en: "New Company" },
  "Criar": { pt: "Criar", en: "Create" },
  "Nome completo": { pt: "Nome completo", en: "Full name" },
  "Sigla / Nome curto": { pt: "Sigla / Nome curto", en: "Abbreviation / Short name" },
  "Tipo": { pt: "Tipo", en: "Type" },
  "Estado": { pt: "Estado", en: "Status" },
  "Ativa": { pt: "Ativa", en: "Active" },
  "Inativa": { pt: "Inativa", en: "Inactive" },
  "Empresa atualizada": { pt: "Empresa atualizada", en: "Company updated" },
  "Empresa eliminada": { pt: "Empresa eliminada", en: "Company deleted" },
  "Convidar Utilizador": { pt: "Convidar Utilizador", en: "Invite User" },

  // ─── Workflow ───
  "Workflow do Projeto": { pt: "Workflow do Projeto", en: "Project Workflow" },
  "Notas do Projeto": { pt: "Notas do Projeto", en: "Project Notes" },
  "Adicionar Nota": { pt: "Adicionar Nota", en: "Add Note" },
  "Nenhuma nota adicional definida para este projeto.": { pt: "Nenhuma nota adicional definida para este projeto.", en: "No additional notes defined for this project." },

  // ─── Calendar ───
  "Prazo Regulatório de Submissão": { pt: "Prazo Regulatório de Submissão", en: "Regulatory Submission Deadline" },
  "Prazo Interno de Preparação": { pt: "Prazo Interno de Preparação", en: "Internal Preparation Deadline" },
  "Submetido": { pt: "Submetido", en: "Submitted" },
  "Validado pela Entidade": { pt: "Validado pela Entidade", en: "Validated by Entity" },
  "Elementos a Reportar": { pt: "Elementos a Reportar", en: "Reporting Elements" },

  // ─── Phases / Timeline ───
  "Pré-Licenciamento": { pt: "Pré-Licenciamento", en: "Pre-Licensing" },
  "Licenciamento": { pt: "Licenciamento", en: "Licensing" },
  "Pré-Construção": { pt: "Pré-Construção", en: "Pre-Construction" },
  "Preparação Prévia": { pt: "Preparação Prévia", en: "Prior Preparation" },
  "Execução da Obra": { pt: "Execução da Obra", en: "Construction Execution" },
  "Fase Final de Construção": { pt: "Fase Final de Construção", en: "Final Construction Phase" },
  "Final de Construção": { pt: "Final de Construção", en: "End of Construction" },
  "Exploração / Operação": { pt: "Exploração / Operação", en: "Operation" },
  "Desativação": { pt: "Desativação", en: "Decommissioning" },
  "Concluído": { pt: "Concluído", en: "Completed" },
  "Em Curso": { pt: "Em Curso", en: "In Progress" },
  "Pendente": { pt: "Pendente", en: "Pending" },

  // ─── KPI ───
  "Submeter Dados": { pt: "Submeter Dados", en: "Submit Data" },
  "Metas": { pt: "Metas", en: "Targets" },
  "Incidentes Ambientais": { pt: "Incidentes Ambientais", en: "Environmental Incidents" },
  "Trabalhadores": { pt: "Trabalhadores", en: "Workers" },
  "Energia e CO₂": { pt: "Energia e CO₂", en: "Energy & CO₂" },
  "Água": { pt: "Água", en: "Water" },
  "Semana": { pt: "Semana", en: "Week" },
  "Mês": { pt: "Mês", en: "Month" },
  "Semestre": { pt: "Semestre", en: "Semester" },
  "Ano": { pt: "Ano", en: "Year" },
  "Projeto": { pt: "Projeto", en: "Project" },

  // ─── RDCD ───
  "Definir Período": { pt: "Definir Período", en: "Define Period" },
  "Selecionar Medidas": { pt: "Selecionar Medidas", en: "Select Measures" },
  "Pré-visualização": { pt: "Pré-visualização", en: "Preview" },
  "Incluir Planos de Monitorização": { pt: "Incluir Planos de Monitorização", en: "Include Monitoring Plans" },
  "Gerar Relatório": { pt: "Gerar Relatório", en: "Generate Report" },

  // ─── Common ───
  "Carregar": { pt: "Carregar", en: "Upload" },
  "Descarregar": { pt: "Descarregar", en: "Download" },
  "Pesquisar": { pt: "Pesquisar", en: "Search" },
  "Filtrar": { pt: "Filtrar", en: "Filter" },
  "Todos": { pt: "Todos", en: "All" },
  "Nenhum resultado": { pt: "Nenhum resultado", en: "No results" },
  "A carregar...": { pt: "A carregar...", en: "Loading..." },
  "Erro": { pt: "Erro", en: "Error" },
  "Sucesso": { pt: "Sucesso", en: "Success" },
  "Confirmar": { pt: "Confirmar", en: "Confirm" },
  "Voltar": { pt: "Voltar", en: "Back" },
  "Fechar": { pt: "Fechar", en: "Close" },
  "Sim": { pt: "Sim", en: "Yes" },
  "Não": { pt: "Não", en: "No" },
  "Selecionar projeto": { pt: "Selecionar projeto", en: "Select project" },
  "Plataforma Ambiental — Start Campus": { pt: "Plataforma Ambiental — Start Campus", en: "Environmental Platform — Start Campus" },

  // ─── Login ───
  "Iniciar Sessão": { pt: "Iniciar Sessão", en: "Sign In" },
  "Email": { pt: "Email", en: "Email" },
  "Palavra-passe": { pt: "Palavra-passe", en: "Password" },
  "Entrar": { pt: "Entrar", en: "Sign In" },
  "Criar Conta": { pt: "Criar Conta", en: "Create Account" },
  "Esqueceu a palavra-passe?": { pt: "Esqueceu a palavra-passe?", en: "Forgot password?" },
  "Entrar com Autodesk": { pt: "Entrar com Autodesk", en: "Sign in with Autodesk" },

  // ─── Certifications ───
  "Próximos Prazos": { pt: "Próximos Prazos", en: "Upcoming Deadlines" },
  "Submissões": { pt: "Submissões", en: "Submissions" },

  // ─── GAMMA ───
  "Necessidades": { pt: "Necessidades", en: "Needs Assessment" },
  "Scorecard": { pt: "Scorecard", en: "Scorecard" },
  "Vencedores": { pt: "Vencedores", en: "Winners" },
  "Definições": { pt: "Definições", en: "Settings" },
  "Candidatura": { pt: "Candidatura", en: "Application" },
  // ─── Dashboard (individual project) ───
  "Visão geral do cumprimento ambiental": { pt: "Visão geral do cumprimento ambiental", en: "Environmental compliance overview" },
  "Todas as empresas": { pt: "Todas as empresas", en: "All companies" },
  "Todas as semanas": { pt: "Todas as semanas", en: "All weeks" },
  "Todos os estados": { pt: "Todos os estados", en: "All statuses" },
  "Todas as secções": { pt: "Todas as secções", en: "All sections" },
  "Próximo RDCD": { pt: "Próximo RDCD", en: "Next RDCD" },
  "Gerar RDCD": { pt: "Gerar RDCD", en: "Generate RDCD" },
  "Fase de Operação": { pt: "Fase de Operação", en: "Operation Phase" },
  "Próximos Reportings": { pt: "Próximos Reportings", en: "Upcoming Reports" },
  "Responsáveis pelo Reporting": { pt: "Responsáveis pelo Reporting", en: "Reporting Owners" },
  "Sem responsável": { pt: "Sem responsável", en: "No owner assigned" },
  // ─── KPI ───
  "Indicadores de sustentabilidade": { pt: "Indicadores de sustentabilidade", en: "Sustainability indicators" },
  "Exportar": { pt: "Exportar", en: "Export" },
  "Período": { pt: "Período", en: "Period" },
  "Semana": { pt: "Semana", en: "Week" },
  "Mês": { pt: "Mês", en: "Month" },
  "Semestre": { pt: "Semestre", en: "Semester" },
  "Ano": { pt: "Ano", en: "Year" },
  "Projeto": { pt: "Projeto", en: "Project" },
  "Energia & CO2": { pt: "Energia & CO2", en: "Energy & CO2" },
  "Água": { pt: "Água", en: "Water" },
  "Trabalhadores": { pt: "Trabalhadores", en: "Workers" },
  "Incidentes": { pt: "Incidentes", en: "Incidents" },
  "Incidentes Ambientais": { pt: "Incidentes Ambientais", en: "Environmental Incidents" },
  "Água Construção": { pt: "Água Construção", en: "Construction Water" },
  "Combustível Total": { pt: "Combustível Total", en: "Total Fuel" },
  "Eletricidade": { pt: "Eletricidade", en: "Electricity" },
  "Submeter": { pt: "Submeter", en: "Submit" },
  "Submeter dados": { pt: "Submeter dados", en: "Submit Data" },
  "Metas": { pt: "Metas", en: "Targets" },
  "Consumo Combustível (L)": { pt: "Consumo Combustível (L)", en: "Fuel Consumption (L)" },
  "Eletricidade (kWh)": { pt: "Eletricidade (kWh)", en: "Electricity (kWh)" },
  // ─── Common ───
  "Guardar": { pt: "Guardar", en: "Save" },
  "Cancelar": { pt: "Cancelar", en: "Cancel" },
  "Eliminar": { pt: "Eliminar", en: "Delete" },
  "Editar": { pt: "Editar", en: "Edit" },
  "Criar": { pt: "Criar", en: "Create" },
  "Fechar": { pt: "Fechar", en: "Close" },
  "Confirmar": { pt: "Confirmar", en: "Confirm" },
  "Voltar": { pt: "Voltar", en: "Back" },
  "Pesquisar": { pt: "Pesquisar", en: "Search" },
  "Sem dados": { pt: "Sem dados", en: "No data" },
  "Carregando...": { pt: "Carregando...", en: "Loading..." },
  "Sem ficha": { pt: "Sem ficha", en: "No form" },
  "Entregue": { pt: "Entregue", en: "Delivered" },
  "Em Revisão": { pt: "Em Revisão", en: "Under Review" },
  "Criada (Rascunho)": { pt: "Criada (Rascunho)", en: "Created (Draft)" },
  "Rejeitada": { pt: "Rejeitada", en: "Rejected" },
  "Parcialmente entregue": { pt: "Parcialmente entregue", en: "Partially delivered" },
// ─── Dashboard extended ───
  "Actividade de Submissão (últimas 12 semanas)": { pt: "Actividade de Submissão (últimas 12 semanas)", en: "Submission Activity (last 12 weeks)" },
  "Cumprimento por Secção": { pt: "Cumprimento por Secção", en: "Compliance by Section" },
  "Distribuição por Entidade Executante": { pt: "Distribuição por Entidade Executante", en: "Distribution by Contractor" },
  "Distribuição por Estado": { pt: "Distribuição por Estado", en: "Distribution by Status" },
  "Empresas Ativas": { pt: "Empresas Ativas", en: "Active Companies" },
  "Evolução Semanal": { pt: "Evolução Semanal", en: "Weekly Evolution" },
  "Evolução do Projeto (Acumulado)": { pt: "Evolução do Projeto (Acumulado)", en: "Project Evolution (Cumulative)" },
  "Implementado": { pt: "Implementado", en: "Implemented" },
  "Conforme": { pt: "Conforme", en: "Compliant" },
  "Não Conforme": { pt: "Não Conforme", en: "Non-Compliant" },
  "Não Aplicável": { pt: "Não Aplicável", en: "Not Applicable" },
  "Limpar": { pt: "Limpar", en: "Clear" },
  "Sem dados disponíveis": { pt: "Sem dados disponíveis", en: "No data available" },
  "No prazo": { pt: "No prazo", en: "On time" },
  "Sem data": { pt: "Sem data", en: "No date" },
  "Monitorização contínua de medidas ambientais e gestão de resíduos": { pt: "Monitorização contínua de medidas ambientais e gestão de resíduos", en: "Continuous monitoring of environmental measures and waste management" },
  // ─── KPI extended ───
  "Aberto": { pt: "Aberto", en: "Open" },
  "Alto": { pt: "Alto", en: "High" },
  "Baixo": { pt: "Baixo", en: "Low" },
  "Crítico": { pt: "Crítico", en: "Critical" },
  "Médio": { pt: "Médio", en: "Medium" },
  "Calculado": { pt: "Calculado", en: "Calculated" },
  "Atingir": { pt: "Atingir", en: "Target" },
  "Anual": { pt: "Anual", en: "Annual" },
  // ─── Calendario extended ───
  "Ação": { pt: "Ação", en: "Action" },
  "Ações": { pt: "Ações", en: "Actions" },
  "Categoria": { pt: "Categoria", en: "Category" },
  "Data Limite": { pt: "Data Limite", en: "Deadline" },
  "Data": { pt: "Data", en: "Date" },
  "Editar Evento": { pt: "Editar Evento", en: "Edit Event" },
  "Em Atraso": { pt: "Em Atraso", en: "Overdue" },
  "Gerir": { pt: "Gerir", en: "Manage" },
  "Novo Evento": { pt: "Novo Evento", en: "New Event" },
  "Hoje": { pt: "Hoje", en: "Today" },
  "Calendário de Reporting": { pt: "Calendário de Reporting", en: "Reporting Calendar" },
  "Datas de entrega de reportings": { pt: "Datas de entrega de reportings", en: "Reporting delivery dates" },
  "Legenda": { pt: "Legenda", en: "Legend" },
  "Prazo Regulatório de Submissão": { pt: "Prazo Regulatório de Submissão", en: "Regulatory Submission Deadline" },
  "Prazo Interno de Preparação": { pt: "Prazo Interno de Preparação", en: "Internal Preparation Deadline" },
  "Submetido": { pt: "Submetido", en: "Submitted" },
  "Validado pela Entidade": { pt: "Validado pela Entidade", en: "Validated by Authority" },
  // ─── WeeklyForm extended ───
  "Anexar ficheiro": { pt: "Anexar ficheiro", en: "Attach file" },
  "Aprovada": { pt: "Aprovada", en: "Approved" },
  "Selecionar Semana": { pt: "Selecionar Semana", en: "Select Week" },
  "Submetida — Aguarda Revisão": { pt: "Submetida — Aguarda Revisão", en: "Submitted — Awaiting Review" },
  // ─── ReviewPage ───
  "Empresa": { pt: "Empresa", en: "Company" },
  "Estado": { pt: "Estado", en: "Status" },
  "Fichas Já Revistas": { pt: "Fichas Já Revistas", en: "Already Reviewed Forms" },
  "Nenhuma ficha pendente de revisão": { pt: "Nenhuma ficha pendente de revisão", en: "No forms pending review" },
  "Notas gerais da revisão": { pt: "Notas gerais da revisão", en: "General review notes" },
  "Notas": { pt: "Notas", en: "Notes" },
  // ─── Timeline ───
  "Ciclo de vida dos projetos Start Campus": { pt: "Ciclo de vida dos projetos Start Campus", en: "Start Campus project lifecycle" },
  "Concluída": { pt: "Concluída", en: "Completed" },
  "Em Curso": { pt: "Em Curso", en: "In Progress" },
  "Pendente": { pt: "Pendente", en: "Pending" },
  "Operação": { pt: "Operação", en: "Operation" },
  "Progresso Global": { pt: "Progresso Global", en: "Overall Progress" },
  "Pipeline de Fases": { pt: "Pipeline de Fases", en: "Phase Pipeline" },
  "Detalhe por Fase": { pt: "Detalhe por Fase", en: "Detail by Phase" },
  "Vista Geral": { pt: "Vista Geral", en: "Overview" },
  // ─── Admin ───
  "Administrador": { pt: "Administrador", en: "Administrator" },
  "Aprovar": { pt: "Aprovar", en: "Approve" },
  "Rejeitar": { pt: "Rejeitar", en: "Reject" },
  "Empresas": { pt: "Empresas", en: "Companies" },
  "Utilizadores": { pt: "Utilizadores", en: "Users" },
  "Convites": { pt: "Convites", en: "Invitations" },
  "Auditoria": { pt: "Auditoria", en: "Audit Log" },
  "Melhorias": { pt: "Melhorias", en: "Improvements" },
  "Pedidos de Acesso": { pt: "Pedidos de Acesso", en: "Access Requests" },
  "Imagens": { pt: "Imagens", en: "Images" },
  // ─── Workflow ───
  "Decisão da RAA": { pt: "Decisão da RAA", en: "RAA Decision" },
  "Dono de Obra": { pt: "Dono de Obra", en: "Project Owner" },
  "Entidade Executante": { pt: "Entidade Executante", en: "Contractor" },
  // ─── Planos ───
  "Planos de Monitorização": { pt: "Planos de Monitorização", en: "Monitoring Plans" },
  "Criar Novo Plano": { pt: "Criar Novo Plano", en: "Create New Plan" },
  "Entrega este mês": { pt: "Entrega este mês", en: "Due this month" },
  // ─── RDCD ───
  "Compilação de Medidas": { pt: "Compilação de Medidas", en: "Measures Compilation" },
  "Definir Período": { pt: "Definir Período", en: "Set Period" },
  "Fichas analisadas": { pt: "Fichas analisadas", en: "Forms analyzed" },
  "Incluir Planos de Monitorização no RDCD": { pt: "Incluir Planos de Monitorização no RDCD", en: "Include Monitoring Plans in RDCD" },
  "Medidas no relatório": { pt: "Medidas no relatório", en: "Measures in report" },
};

interface LanguageContextType {
  language: Lang;
  setLanguage: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "pt",
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Lang>(() =>
    (localStorage.getItem("app_lang") as Lang) || "pt"
  );

  useEffect(() => {
    localStorage.setItem("app_lang", language);
  }, [language]);

  const t = (key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export default LanguageContext;
