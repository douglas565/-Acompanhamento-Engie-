# 📊 Sistema de Acompanhamento de Produtividade - ENGIE

Sistema web desenvolvido para gestão e monitorização da produtividade das equipas de projetos (Curitiba e Florianópolis). A aplicação permite o registo diário de atividades, visualização de métricas em tempo real e gestão administrativa completa.

## 🚀 Funcionalidades

### 🔐 Autenticação e Perfis
- **Login Seguro**: Autenticação via Firebase Auth.
- **Controlo de Acesso**:
  - **Usuário Comum**: Regista a produção e visualiza o seu histórico/progresso.
  - **Administrador**: Acesso total a relatórios, gestão de utilizadores e gráficos globais.

### 📝 Módulo 1: Produção Diária (Dashboard Principal)
- **Registo Detalhado**:
  - Dados do projeto (Número, Praça, Tipo).
  - Pontuação por categoria (Retrofit 1-4, Remodelagem V/D).
  - Checkbox para marcar **Revisão de Praça** ⚠️.
  - Seleção de categorias (Luminotécnico, Elétrico, Planilhão, Croqui).
  - **Cálculo Automático** de pontuação total.
  - **Finalização Automática**: O sistema identifica quando um projeto está concluído com base nas categorias obrigatórias.
- **Dashboards Visuais**:
  - 🥧 Gráfico de Produção por Equipe (Curitiba vs Florianópolis).
  - 📈 Gráfico de Evolução Semanal.
  - 📋 Distribuição por Tipos de Projeto.
  - ✅ Gráfico de Projetos Finalizados por Projetista (Semanal).
- **Histórico Individual**: Lista pesquisável e editável das produções do utilizador.

### 🛣️ Módulo 2: Projetos Viários
*Acesso via botão dedicado na dashboard principal.*
- **Registo Específico**: Formulário simplificado para Vias (Nome, Data, Pontos, Revisão).
- **Tabela de Registos**: Visualização completa com opções de edição e exclusão.
- **Gráficos Exclusivos**:
  - Produção Individual Semanal.
  - Produção Geral da Equipa (Admin).
  - Ranking de Projetistas (Admin).
  - Comparativo Revisões vs. Novos (Admin).

### 🛡️ Painel Administrativo (Apenas Admin)
- **Gestão de Utilizadores**: Criar, remover e alterar permissões (promover/rebaixar admins).
- **Exportação de Dados**: Download de relatórios completos em **Excel (.xlsx)**.
- **Alerta de Duplicatas**: Sistema inteligente que deteta e lista projetos registados em duplicado por utilizadores diferentes na mesma praça.
- **Sincronização**: Atualização forçada de dados em tempo real.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3 (Responsivo), JavaScript (ES6+).
- **Backend / Database**: Google Firebase (Firestore Database & Authentication).
- **Bibliotecas**:
  - [Chart.js](https://www.chartjs.org/) - Para geração de gráficos interativos.
  - [SheetJS (xlsx)](https://sheetjs.com/) - Para exportação de relatórios Excel.
  - [Lucide Icons](https://lucide.dev/) - Ícones da interface.

---

## 📂 Estrutura do Projeto

```bash
/
├── index.html                # Dashboard Principal (Login e Produção Diária)
├── projetos-viarios.html     # Módulo de Projetos Viários
├── styles.css                # Estilos globais e responsivos
├── script-firebase.js        # Lógica principal (Auth, CRUD Produção, Admin)
├── projetos-viarios.js       # Lógica específica do módulo Viários
├── firebase-config.js        # Configuração das chaves do Firebase
└── projeto-manager.js        # Regras de negócio (Cálculo de progresso/finalização)
