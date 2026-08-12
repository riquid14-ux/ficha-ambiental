# Guia de Utilização — Plataforma Ambiental Start Campus

## 1. Acesso à Plataforma

### Primeiro Acesso (utilizadores existentes)
1. Aceder a `https://<DOMINIO>/login`
2. Introduzir email corporativo e password inicial (`123456`)
3. O sistema obriga a alterar a password no primeiro acesso
4. Após 7 dias, será obrigatório configurar a autenticação de dois fatores (2FA)

### Criar Nova Conta
1. Na página de login, clicar em "Criar conta"
2. Preencher nome, email e password
3. Aguardar aprovação do administrador (Nairana Aguiar)
4. Após aprovação, fazer login normalmente

### Configurar 2FA
1. Instalar Google Authenticator ou Microsoft Authenticator no telemóvel
2. No Perfil (canto inferior esquerdo → Perfil), clicar "Configurar 2FA"
3. Digitalizar o QR code com o Authenticator
4. Introduzir o código de 6 dígitos para confirmar

---

## 2. Roles e Permissões

| Role | Pode fazer |
|---|---|
| **Admin** | Tudo — gerir utilizadores, empresas, projetos, aprovar contas, editar medidas |
| **Dono de Obra** | Gerir permissões, ver tudo, criar fichas com todas as medidas |
| **EE (Entidade Executante)** | Criar/editar fichas semanais (só medidas EE), guardar rascunhos |
| **RAP** | Igual a EE mas com medidas RAP |
| **RAA** | Rever fichas, aprovar/rejeitar com comentários por medida |
| **Observador** | Ver tudo (dashboard, histórico, revisão) sem poder editar |

---

## 3. Ficha Semanal

### Criar nova ficha
1. Selecionar o projeto no menu lateral (ex: SIN02)
2. Ir a "Ficha Semanal" → tab "Nova Ficha"
3. Selecionar a semana e ano
4. Preencher cada medida: estado (I/C/NC/NA) + observações + fotos
5. "Guardar Rascunho" para continuar depois, ou "Submeter" para enviar à RAA

### Rascunhos e Rejeitadas
- Tab "Rascunhos" mostra fichas em progresso e fichas rejeitadas pela RAA
- Fichas rejeitadas aparecem com banner "Ação Imediata" e comentários da RAA

---

## 4. Revisão (RAA)

1. Ir a "Revisão" no menu lateral
2. Selecionar a ficha submetida
3. Para cada medida: marcar ✓ (conforme) ou ✗ (não conforme) + comentário
4. "Aprovar" ou "Rejeitar" a ficha completa
5. Se rejeitada, volta para a empresa com os comentários

---

## 5. Dashboard

- Visão geral com gráficos de cumprimento
- Filtros: por empresa, semana, secção, estado (I/C/NC/NA)
- Evolução semanal e evolução acumulada do projeto

---

## 6. Calendário

- Visualização de 2 meses (atual + próximo)
- Eventos de reporting com cores: Amarelo (prazo), Azul (submetido), Verde (validado), Vermelho (atraso)
- "Gerir" (admin) para criar/editar eventos, atribuir responsáveis

---

## 7. Fases do Projeto

- Cada projeto tem fases: Pré-Licenciamento → Licenciamento → Pré-Construção → Construção → Exploração → Desativação
- Submeter evidências (comentários, fotos, ficheiros) por medida e por ano
- Admin pode editar medidas via ícone ⚙️

---

## 8. MIRR / Gestão de Resíduos

- **SIN01-NEST**: Tab "MIRR" para registo de e-GARs, tracking por código LER, exportação Excel
- **Outros projetos**: Tab "Gestão de Resíduos" com sub-projetos e wastemap

---

## 9. RDCD (Relatório de Demonstração de Cumprimento)

- Disponível em "Todos os Projetos" → RDCD
- Wizard de 4 passos: selecionar projetos → definir período → compilar medidas → gerar Word

---

## 10. Administração

- **Empresas**: criar, editar, atribuir a projetos
- **Utilizadores**: gerir roles, atribuir empresas e projetos
- **Pedidos de Acesso**: aprovar/rejeitar novas contas
- **Melhorias**: ver feedback dos utilizadores
- **Imagens**: configurar imagens do brand por página

