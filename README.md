# Sistema de Produtividade - Equipe de Projetos 📊

Sistema web para gerenciamento de produtividade das equipes de projetistas de Curitiba e Florianópolis.

## 🚀 Funcionalidades

### 👥 Sistema de Usuários
- **Login seguro** com usuário e senha
- **Níveis de acesso**: Usuário comum e Administrador
- **Equipes separadas**: Curitiba e Florianópolis
- **Gerenciamento de usuários** (apenas admins)

### 📝 Registro de Produção
- Formulário completo baseado no informe diário
- Campos para:
  - Data do projeto
  - Praças trabalhadas
  - Tipo de projeto (descrição detalhada)
  - Pontos por categoria:
    - Retrofit 1, 2, 3, 4
    - Remodelamento V e D
- **Cálculo automático** do total de pontos

### 📈 Dashboard e Estatísticas
- **Estatísticas gerais**:
  - Pontos do dia atual
  - Pontos do mês
  - Média diária
  - Total de projetos registrados

- **4 Gráficos interativos**:
  - 🥧 Produção por equipe (Curitiba vs Florianópolis)
  - 📊 Produção mensal ao longo do tempo
  - 🏆 Ranking individual de produtividade
  - 📋 Distribuição por tipos de projeto

### 🔧 Recursos Administrativos
- **Gerenciamento completo de usuários**
- **Exportação para Excel** com dados detalhados
- **Sistema de backup/restauração**
- **Controle de permissões**
- **Exclusão de registros**

### 👤 Recursos do Usuário
- **Histórico pessoal** de produções
- **Busca no histórico** por praça, projeto ou data
- **Interface responsiva** e intuitiva

## 🔐 Usuários Padrão

| Usuário | Senha | Nível | Equipe |
|---------|-------|-------|--------|
| admin | admin123 | Administrador | Curitiba |
| eduarda | 123456 | Usuário | Curitiba |
| joao | 123456 | Usuário | Florianópolis |

## 📁 Estrutura de Arquivos

```
sistema-produtividade/
├── index.html          # Página principal
├── styles.css          # Estilos CSS
├── script.js           # JavaScript principal
└── README.md           # Esta documentação
```

## 🚀 Como Usar no GitHub Pages

### 1. Criar Repositório
```bash
# Criar novo repositório no GitHub
# Nome sugerido: sistema-produtividade
```

### 2. Upload dos Arquivos
- Faça upload dos 4 arquivos para o repositório
- Certifique-se que o arquivo principal se chama `index.html`

### 3. Ativar GitHub Pages
1. Vá em **Settings** > **Pages**
2. Em **Source**, selecione **Deploy from a branch**
3. Em **Branch**, selecione **main** (ou master)
4. Clique em **Save**

### 4. Acessar o Sistema
- URL será: `https://seuusuario.github.io/sistema-produtividade`
- O sistema estará disponível em poucos minutos

## 💾 Armazenamento de Dados

⚠️ **Importante**: Como o GitHub Pages é estático, os dados são armazenados localmente no navegador usando `localStorage`.

### Características:
- ✅ **Dados persistem** enquanto usar o mesmo navegador
- ✅ **Backup/Restauração** disponível para admins
- ⚠️ **Dados são locais** por dispositivo/navegador
- ⚠️ **Limpar cache** do navegador apaga os dados

### Para Produção Real:
Para um ambiente empresarial, considere integrar com:
- **Firebase** (gratuito até certo limite)
- **MongoDB Atlas** (banco na nuvem)
- **Servidor próprio** com PHP/MySQL

## 📊 Exemplo de Uso

### Registro de Produção:
```
Data: 14/08/2025
Projetista: Eduarda Militz
Praças: Praça Elias Abdo Bittar
Tipo de projeto: Finalizado Luminotécnico, preenchido planilhão e feito croqui
Pontos:
- Retrofit 1: 4
- Retrofit 2: 20
- Retrofit 3: 0
- Retrofit 4: 0
- Remodelamento V: 0
- Remodelamento D: 14
Total: 38 pontos
```

## 🎨 Recursos Visuais

- **Design moderno** com gradientes
- **Responsivo** para mobile e desktop
- **Gráficos interativos** com Chart.js
- **Animações suaves**
- **Interface intuitiva**

## 🔧 Funcionalidades Administrativas

### Exportação Excel
- **Dados completos** de todas as produções
- **Resumos por equipe** e projetista
- **Planilhas separadas** (dados + resumo)
- **Nome automático** com data

### Gerenciamento de Usuários
- **Adicionar novos usuários**
- **Promover/rebaixar** administradores
- **Excluir usuários** e suas produções
- **Visualizar estatísticas** por usuário

### Backup/Restauração
- **Backup completo** em arquivo JSON
- **Restauração** de dados anteriores
- **Controle de versão** dos backups

## 📱 Responsividade

O sistema é totalmente responsivo:
- **Desktop**: Layout completo com gráficos lado a lado
- **Tablet**: Gráficos em coluna única
- **Mobile**: Interface otimizada para toque

## 🐛 Solução de Problemas

### Dados não salvam:
- Verifique se o JavaScript está habilitado
- Não use modo privado/anônimo do navegador

### Gráficos não aparecem:
- Verifique sua conexão com internet (Chart.js via CDN)
- Aguarde alguns segundos após o login

### Exportação Excel não funciona:
- Verifique se popups estão habilitados
- Tente em outro navegador

## 🔄 Atualizações Futuras

Possíveis melhorias:
- [ ] Notificações por email
- [ ] Relatórios automáticos
- [ ] Integração com Google Sheets
- [ ] App mobile nativo
- [ ] Metas e objetivos por equipe

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique se seguiu todos os passos
2. Teste os usuários padrão
3. Consulte o console do navegador (F12)

## 📄 Licença

Este sistema foi desenvolvido para uso interno da equipe de projetos.

---

**🚀 Sistema pronto para uso no GitHub Pages!**
