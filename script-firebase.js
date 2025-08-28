// 🔥 Sistema de Produtividade com Firebase
// Inicialização da aplicação

// Importar funções do gerenciador de projetos
if (typeof window !== 'undefined' && window.ProjetoManager) {
    const { 
        podeFinalizarProjeto, 
        finalizarProjeto, 
        calcularProgressoProjeto, 
        atualizarCategoriaProjeto, 
        gerarRelatorioStatusProjetos, 
        GerenciadorProjetoFirebase 
    } = window.ProjetoManager;
}

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Inicializar aplicação
function initializeApp() {
    setCurrentDate();
    setupAuthListener();
    setupFormListener();
    setupKeyboardEvents();
    setupChartResize(); // Adicionar esta linha
    
    // Verificar se já existe usuário logado
    auth.onAuthStateChanged((user) => {
        hideLoadingScreen();
        if (user) {
            handleUserLogin(user);
        } else {
            showLoginScreen();
        }
    });
}

// Configurar listener de autenticação
function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                await loadUserData(user.uid);
                await loadAllData();
                showMainScreen();
            } catch (error) {
                console.error('Erro ao carregar dados do usuário:', error);
                showError('Erro ao carregar dados do usuário');
            }
        }
    });
}

// Telas e Loading
function showLoadingScreen() {
    document.getElementById('loadingScreen').classList.remove('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.add('hidden');
}

function hideLoadingScreen() {
    document.getElementById('loadingScreen').classList.add('hidden');
}

function showLoginScreen() {
    hideLoadingScreen();
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainScreen').classList.add('hidden');
}

function showMainScreen() {
    hideLoadingScreen();
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    
    if (currentUserData && currentUserData.role === 'admin') {
        document.getElementById('adminPanel').classList.remove('hidden');
    }
    
    // Aguardar um momento para os elementos DOM estarem prontos
    setTimeout(() => {
        updateDashboard();
        loadUserHistory();
    }, 200);
}

// Sistema de Login/Logout
async function loginUser() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showError('Por favor, preencha email e senha');
        return;
    }
    
    try {
        showButtonLoading('loginBtn');
        hideError();
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await handleUserLogin(user);
        
    } catch (error) {
        console.error('Erro no login:', error);
        let errorMessage = 'Email ou senha incorretos';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Usuário não encontrado';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Senha incorreta';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Muitas tentativas. Tente novamente mais tarde';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Erro de conexão. Verifique sua internet';
                break;
        }
        
        showError(errorMessage);
    } finally {
        hideButtonLoading('loginBtn');
    }
}

async function handleUserLogin(user) {
    currentUser = user;
    
    // Carregar dados do usuário
    await loadUserData(user.uid);
    
    // Atualizar interface
    document.getElementById('currentUser').textContent = currentUserData.name || currentUserData.email;
    document.getElementById('userRole').textContent = `(${currentUserData.team} - ${currentUserData.role === 'admin' ? 'Administrador' : 'Usuário'})`;
    
    showMainScreen();
}

async function logoutUser() {
    try {
        await auth.signOut();
        
        // Limpar dados locais
        currentUser = null;
        currentUserData = null;
        allProductions = [];
        allUsers = [];
        
        // Limpar gráficos de forma segura
        clearAllCharts();
        
        // Limpar formulários
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        
        showLoginScreen();
        
    } catch (error) {
        console.error('Erro no logout:', error);
        showError('Erro ao fazer logout');
    }
}

// Carregar dados do usuário
async function loadUserData(uid) {
    try {
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
        
        if (userDoc.exists) {
            currentUserData = { id: uid, ...userDoc.data() };
        } else {
            // Criar perfil básico se não existir
            const userData = {
                email: currentUser.email,
                name: currentUser.email.split('@')[0],
                team: 'Cadastrar Time',
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection(COLLECTIONS.USERS).doc(uid).set(userData);
            currentUserData = { id: uid, ...userData };
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        throw error;
    }
}


function waitForChart(){
    if (typeof Chart !== 'undefined'){
        updateCharts();
    }else{
        seyTimeout(waitForChart, 100);
    }
}

// Carregar todos os dados
async function loadAllData() {
    try {
        updateConnectionStatus('loading', 'Carregando dados...');
        
        // Carregar produções
        const productionsSnapshot = await db.collection(COLLECTIONS.PRODUCTIONS)
            .orderBy('date', 'desc')
            .get();
        
        allProductions = productionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Carregar usuários (apenas para admins)
        if (currentUserData.role === 'admin') {
            const usersSnapshot = await db.collection(COLLECTIONS.USERS).get();
            allUsers = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }
        // Adicionar dados de demonstração se não houver produções
if (allProductions.length === 0) {
    console.log('Adicionando dados de demonstração para gráficos...');
    allProductions = [
        {
            id: 'demo1',
            userId: currentUser.uid,
            userEmail: currentUserData.email,
            userName: currentUserData.name,
            team: 'Curitiba',
            date: '2025-08-15',
            plaza: 'Praça Teste 1',
            projectType: 'Projeto Demo 1',
            points: { retrofit1: 10, retrofit2: 5, retrofit3: 0, retrofit4: 0, remodelagemV: 0, remodelagemD: 0 },
            total: 15,
            createdAt: new Date('2025-08-15T10:00:00Z')
        },
        {
            id: 'demo2',
            userId: currentUser.uid,
            userEmail: currentUserData.email,
            userName: currentUserData.name,
            team: 'Florianópolis',
            date: '2025-08-16',
            plaza: 'Praça Teste 2',
            projectType: 'Projeto Demo 2',
            points: { retrofit1: 0, retrofit2: 0, retrofit3: 8, retrofit4: 7, remodelagemV: 0, remodelagemD: 0 },
            total: 15,
            createdAt: new Date('2025-08-16T11:00:00Z')
        },
        {
            id: 'demo3',
            userId: currentUser.uid,
            userEmail: currentUserData.email,
            userName: currentUserData.name,
            team: 'Curitiba',
            date: '2025-08-17',
            plaza: 'Praça Teste 3',
            projectType: 'Projeto Demo 3',
            points: { retrofit1: 12, retrofit2: 0, retrofit3: 0, retrofit4: 0, remodelagemV: 5, remodelagemD: 0 },
            total: 17,
            createdAt: new Date('2025-08-17T12:00:00Z')
        },
        {
            id: 'demo4',
            userId: currentUser.uid,
            userEmail: currentUserData.email,
            userName: currentUserData.name,
            team: 'Florianópolis',
            date: '2025-08-18',
            plaza: 'Praça Teste 4',
            projectType: 'Projeto Demo 4',
            points: { retrofit1: 0, retrofit2: 0, retrofit3: 0, retrofit4: 0, remodelagemV: 0, remodelagemD: 10 },
            total: 10,
            createdAt: new Date('2025-08-18T13:00:00Z')
        }
    ];
}
        
        updateConnectionStatus('connected', 'Conectado ao Firebase');
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        updateConnectionStatus('error', 'Erro de conexão');
        throw error;
    }
}

// Funções utilitárias de interface
function setCurrentDate() {
    const today = new Date().toISOString().split('T')[0];
    const projectDateEl = document.getElementById('projectDate');
    if (projectDateEl) {
        projectDateEl.value = today;
    }
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('pt-BR');
    }
}

function showError(message) {
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        
        setTimeout(() => {
            errorEl.classList.add('hidden');
        }, 5000);
    }
}

function hideError() {
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
        errorEl.classList.add('hidden');
    }
}

function showButtonLoading(buttonId) {
    const btn = document.getElementById(buttonId);
    const text = document.getElementById(buttonId.replace('Btn', 'BtnText'));
    const spinner = document.getElementById(buttonId.replace('Btn', 'Spinner'));
    
    if (btn && text && spinner) {
        btn.disabled = true;
        text.classList.add('hidden');
        spinner.classList.remove('hidden');
    }
}

function hideButtonLoading(buttonId) {
    const btn = document.getElementById(buttonId);
    const text = document.getElementById(buttonId.replace('Btn', 'BtnText'));
    const spinner = document.getElementById(buttonId.replace('Btn', 'Spinner'));
    
    if (btn && text && spinner) {
        btn.disabled = false;
        text.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

function updateConnectionStatus(status, message) {
    const iconEl = document.getElementById('connectionIcon');
    const textEl = document.getElementById('connectionText');
    
    if (iconEl && textEl) {
        switch (status) {
            case 'connected':
                iconEl.textContent = '🟢';
                break;
            case 'loading':
                iconEl.textContent = '🟡';
                break;
            case 'error':
                iconEl.textContent = '🔴';
                break;
        }
        textEl.textContent = message;
    }
}

// Funções de usuários demo
function fillDemoUser(email, password) {
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = password;
}

// Cálculo de pontos
function calculateTotal() {
    const fields = ['retrofit1', 'retrofit2', 'retrofit3', 'retrofit4', 'remodelagemV', 'remodelagemD'];
    let total = 0;
    
    fields.forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            const value = parseInt(element.value) || 0;
            total += value;
        }
    });
    
    const totalEl = document.getElementById('totalPoints');
    if (totalEl) {
        totalEl.textContent = total;
    }
}

// Configurar listener do formulário
function setupFormListener() {
    const form = document.getElementById('productionForm');
    if (form) {
        form.addEventListener('submit', handleProductionSubmit);
    }
}

// Salvar produção
// VERSÃO CORRIGIDA DA FUNÇÃO handleProductionSubmit
async function handleProductionSubmit(e) {
    e.preventDefault();
    
    if (!currentUser || !currentUserData) {
        showError('Erro: usuário não autenticado');
        return;
    }
    
    // CORREÇÃO: Declarar todas as variáveis no início
    const projectDateEl = document.getElementById('projectDate');
    const plazaEl = document.getElementById('plaza');
    const projectTypeEl = document.getElementById('projectType');
    const projectStatusEl = document.getElementById('projectStatus'); // MOVIDO PARA CIMA
    
    // Verificar se os elementos existem antes de acessar suas propriedades
    if (!projectDateEl) {
        console.error('Elemento projectDate não encontrado');
        showError('Erro: campo de data não encontrado no formulário');
        return;
    }
    
    // Validar se pelo menos uma categoria foi selecionada
    const categories = {
        luminotecnico: document.getElementById('categoryLuminotecnico')?.checked || false,
        eletrico: document.getElementById('categoryEletrico')?.checked || false,
        planilhao: document.getElementById('categoryPlanilhao')?.checked || false,
        croqui: document.getElementById('categoryCroqui')?.checked || false
    };
    
    const hasCategory = Object.values(categories).some(cat => cat);
    if (!hasCategory) {
        showError('Por favor, selecione pelo menos uma categoria do informe');
        return;
    }
    
    // Verificar se todas as categorias obrigatórias estão selecionadas para finalização automática
    const categoriasObrigatorias = ['luminotecnico', 'eletrico', 'planilhao'];
    const todasObrigatoriasCompletas = categoriasObrigatorias.every(cat => categories[cat]);
    
    let statusProjeto = projectStatusEl?.value || 'em_andamento';
    
    // Se todas as categorias obrigatórias estão marcadas, finalizar automaticamente
    if (todasObrigatoriasCompletas) {
        statusProjeto = 'finalizado';
        console.log('🎉 Projeto será finalizado automaticamente - todas as categorias obrigatórias foram concluídas!');
    }
    
    try {
        showButtonLoading('saveBtn');
        
        const production = {
            userId: currentUser.uid,
            userEmail: currentUserData.email,
            userName: currentUserData.name || currentUserData.email.split('@')[0],
            team: currentUserData.team,
            date: projectDateEl.value || new Date().toISOString().split('T')[0],
            plaza: plazaEl?.value || 'N/A',
            projectType: projectTypeEl?.value || 'N/A',
            status: statusProjeto,
            categories: categories,
            points: {
                retrofit1: parseInt(document.getElementById('retrofit1')?.value) || 0,
                retrofit2: parseInt(document.getElementById('retrofit2')?.value) || 0,
                retrofit3: parseInt(document.getElementById('retrofit3')?.value) || 0,
                retrofit4: parseInt(document.getElementById('retrofit4')?.value) || 0,
                remodelagemV: parseInt(document.getElementById('remodelagemV')?.value) || 0,
                remodelagemD: parseInt(document.getElementById('remodelagemD')?.value) || 0
            },
            total: parseInt(document.getElementById('totalPoints')?.textContent) || 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            // Adicionar campos de finalização automática se aplicável
            ...(statusProjeto === 'finalizado' && {
                dataFinalizacao: new Date().toISOString(),
                finalizadoAutomaticamente: todasObrigatoriasCompletas,
                categoriasObrigatoriasCompletas: todasObrigatoriasCompletas
            })
        };
        
        console.log('Dados a serem salvos:', production);
        
        // Salvar no Firebase
        await db.collection(COLLECTIONS.PRODUCTIONS).add(production);
        
        // Atualizar dados locais
        await loadAllData();
        
        // Reset form
        const form = document.getElementById('productionForm');
        if (form) {
            form.reset();
        }
        setCurrentDate();
        calculateTotal();
        
        updateDashboard();
        loadUserHistory();
        
        // Mostrar notificação especial se o projeto foi finalizado automaticamente
        if (statusProjeto === 'finalizado' && todasObrigatoriasCompletas) {
            showSuccess('🎉 PROJETO FINALIZADO AUTOMATICAMENTE!\n\nTodas as categorias obrigatórias foram concluídas:\n✅ Luminotécnico\n✅ Elétrico\n✅ Planilhão\n\nO projeto foi automaticamente marcado como finalizado!');
        } else {
            showSuccess('✅ Produção salva com sucesso!');
        }
        
    } catch (error) {
        console.error('Erro ao salvar produção:', error);
        showError(`Erro ao salvar produção: ${error.message}`);
    } finally {
        hideButtonLoading('saveBtn');
    }
}

// FUNÇÃO ADICIONAL PARA VERIFICAR SE TODOS OS ELEMENTOS EXISTEM
function debugFormElements() {
    console.log('=== DEBUG DOS ELEMENTOS DO FORMULÁRIO ===');
    
    const elementsToCheck = [
        'projectDate',
        'plaza', 
        'projectType',
        'projectStatus',
        'categoryLuminotecnico',
        'categoryEletrico', 
        'categoryPlanilhao',
        'categoryCroqui',
        'retrofit1',
        'retrofit2',
        'retrofit3', 
        'retrofit4',
        'remodelagemV',
        'remodelagemD',
        'totalPoints'
    ];
    
    elementsToCheck.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✅ ${id}: encontrado`);
        } else {
            console.error(`❌ ${id}: NÃO ENCONTRADO`);
        }
    });
    
    console.log('=== FIM DO DEBUG ===');
}

// Função para mostrar mensagem de sucesso
function showSuccess(message) {
    // Criar elemento de sucesso temporário
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = message.replace(/\n/g, '<br>'); // Permitir quebras de linha
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: bold;
        max-width: 300px;
        line-height: 1.4;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 300);
    }, 4000);
}

// Atualizar dashboard
function updateDashboard() {
    updateStats();
    updateCharts();
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    
    // Filtrar produções relevantes
    const userProductions = currentUserData.role === 'admin' 
        ? allProductions 
        : allProductions.filter(p => p.userId === currentUser.uid);

    // Filtrar produções para a nova lógica de contagem
    const filteredForNewLogic = userProductions.filter(p => {
        const categoriasObrigatorias = p.categories && 
                                      p.categories.luminotecnico && 
                                      p.categories.eletrico && 
                                      p.categories.planilhao;
        return p.status === 'finalizado' && categoriasObrigatorias;
    });

    // Pontos hoje (mantém a lógica original, mas pode ser ajustada se necessário)
    const todayPoints = userProductions
        .filter(p => p.date === today)
        .reduce((sum, p) => sum + p.total, 0);
    
    // Pontos do mês (mantém a lógica original, mas pode ser ajustada se necessário)
    const monthPoints = userProductions
        .filter(p => p.date && p.date.startsWith(currentMonth))
        .reduce((sum, p) => sum + p.total, 0);
    
    // Média diária (mantém a lógica original, mas pode ser ajustada se necessário)
    const daysWithProduction = [...new Set(userProductions.map(p => p.date))].length;
    const avgPoints = daysWithProduction > 0 ? Math.round(monthPoints / daysWithProduction) : 0;
    
    // Atualizar elementos
    const elements = {
        'totalPointsToday': todayPoints,
        'totalPointsMonth': monthPoints,
        'avgPointsDay': avgPoints,
        'totalProjects': filteredForNewLogic.length // Usar a nova lógica aqui
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

// Função melhorada para atualizar todos os gráficos
function updateCharts() {

    console.log('updateCharts() chamada, dados disponíveis:', allProductions.length);

    if (typeof Chart === 'undefined') {
        console.error('Chart.js não está carregado!');
        return;
    }

    // Verificar se temos dados
    if (!allProductions || allProductions.length === 0) {
        console.log('Nenhum dado de produção disponível para gráficos');
        return;
    }
    
    console.log('Iniciando renderização dos gráficos...');
    // Inicializar wrappers se necessário
    initializeChartWrappers();
    
    // Pequeno delay para garantir que os elementos DOM estejam prontos
    setTimeout(() => {
        try {
            updateTeamChart();
        } catch (error) {
            console.error('Erro ao atualizar gráfico de equipes:', error);
        }
        
        try {
            updateMonthlyChart();
        } catch (error) {
            console.error('Erro ao atualizar gráfico mensal:', error);
        }
        
        try {
            updateProjectTypeChart();
        } catch (error) {
            console.error('Erro ao atualizar gráfico de tipos de projeto:', error);
        }
    }, 100);
}

// Função para inicializar os wrappers dos gráficos
function initializeChartWrappers() {
    const chartCanvases = document.querySelectorAll('.chart-card canvas');
    chartCanvases.forEach(canvas => {
        if (!canvas.parentElement.classList.contains('chart-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-wrapper';
            canvas.parentNode.insertBefore(wrapper, canvas);
            wrapper.appendChild(canvas);
        }
    });
}

// Função para limpar todos os gráficos
function clearAllCharts() {
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            try {
                chart.destroy();
            } catch (error) {
                console.error('Erro ao destruir gráfico:', error);
            }
        }
    });
    charts = {};
}

// Função para redimensionar gráficos quando a janela muda de tamanho
function setupChartResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            Object.values(charts).forEach(chart => {
                if (chart && chart.resize) {
                    chart.resize();
                }
            });
        }, 250);
    });
}

// Função corrigida para gráfico de equipes
function updateTeamChart() {
    const ctx = document.getElementById('teamChart');
    if (!ctx) {
        console.warn('Canvas teamChart não encontrado');
        return;
    }
    
    // Destruir gráfico anterior
    if (charts.team) {
        charts.team.destroy();
        charts.team = null;
    }
    
    const curitibaPoints = allProductions
        .filter(p => p.team === 'Curitiba')
        .reduce((sum, p) => sum + p.total, 0);
        
    const florianopolisPoints = allProductions
        .filter(p => p.team === 'Florianópolis')
        .reduce((sum, p) => sum + p.total, 0);
    
    console.log('Dados do gráfico de equipes:', { curitibaPoints, florianopolisPoints });
    
    // Verificar se há dados
    if (curitibaPoints === 0 && florianopolisPoints === 0) {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = '16px Arial';
        context.fillStyle = '#666';
        context.textAlign = 'center';
        context.fillText('Nenhum dado disponível', ctx.width/2, ctx.height/2);
        return;
    }
    
    try {
        charts.team = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Curitiba', 'Florianópolis'],
                datasets: [{
                    data: [curitibaPoints, florianopolisPoints],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)'
                    ],
                    borderColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(118, 75, 162, 1)'
                    ],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 14
                            }
                        }
                    },
                    datalabels: {
                        color: '#fff',
                        font: {
                            weight: 'bold',
                            size: 16
                        },
                        formatter: function(value, context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return percentage + '%';
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        cornerRadius: 6,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.raw} pontos (${percentage}%)`;
                            }
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
        console.log('Gráfico de equipes criado com sucesso');
    } catch (error) {
        console.error('Erro ao criar gráfico de equipes:', error);
    }
}

// Função corrigida para gráfico mensal
function updateMonthlyChart() {
    const ctx = document.getElementById("monthlyChart");
    if (!ctx) {
        console.warn("Canvas monthlyChart não encontrado");
        return;
    }

    // Destruir gráfico anterior
    if (charts.monthly) {
        charts.monthly.destroy();
        charts.monthly = null;
    }

    // Agrupar por semana
    const weeklyData = {};
    const relevantProductions = currentUserData && currentUserData.role === "admin" 
        ? allProductions 
        : allProductions.filter(p => p.userId === currentUser.uid);
    
    relevantProductions.forEach(p => {
        if (p.date) {
            const date = new Date(p.date + "T00:00:00"); // Adiciona T00:00:00 para evitar problemas de fuso horário
            const day = date.getDay(); // 0 = Domingo, 6 = Sábado
            const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajusta para segunda-feira da semana
            const monday = new Date(date.setDate(diff));
            const weekKey = monday.toISOString().substring(0, 10); // Formato YYYY-MM-DD para a segunda-feira da semana
            weeklyData[weekKey] = (weeklyData[weekKey] || 0) + p.total;
        }
    });
    
    const weeks = Object.keys(weeklyData).sort();
    const values = weeks.map(w => weeklyData[w]);
    
    console.log("Dados do gráfico semanal:", { weeks, values });
    
    if (weeks.length === 0) {
        const context = ctx.getContext("2d");
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = "16px Arial";
        context.fillStyle = "#666";
        context.textAlign = "center";
        context.fillText("Nenhum dado disponível", ctx.width/2, ctx.height/2);
        return;
    }
    
    try {
        charts.monthly = new Chart(ctx, {
            type: "bar",
            data: {
                labels: weeks.map(w => {
                    const date = new Date(w + "T00:00:00");
                    const endOfWeek = new Date(date);
                    endOfWeek.setDate(date.getDate() + 6);
                    return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - ${endOfWeek.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
                }),
                datasets: [{
                    label: "Pontos de Produção",
                    data: values,
                    backgroundColor: "rgba(102, 126, 234, 0.8)",
                    borderColor: "rgba(102, 126, 234, 1)",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index"
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: "rgba(0,0,0,0.8)",
                        titleColor: "#fff",
                        bodyColor: "#fff",
                        cornerRadius: 6,
                        callbacks: {
                            title: function(tooltipItems) {
                                return `Semana: ${tooltipItems[0].label}`;
                            },
                            label: function(context) {
                                return `Pontos: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 10,
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            color: "rgba(0,0,0,0.1)"
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        console.log("Gráfico semanal criado com sucesso");
    } catch (error) {
        console.error("Erro ao criar gráfico mensal:", error);
    }
}

// Função corrigida para gráfico de tipos de projeto
function updateProjectTypeChart() {
    const ctx = document.getElementById('projectTypeChart');
    if (!ctx) {
        console.warn('Canvas projectTypeChart não encontrado');
        return;
    }
    
    // Destruir gráfico anterior
    if (charts.projectType) {
        charts.projectType.destroy();
        charts.projectType = null;
    }
    
    // Agrupar por tipo de ponto
    const typeData = {
        'Retrofit 1': 0,
        'Retrofit 2': 0,
        'Retrofit 3': 0,
        'Retrofit 4': 0,
        'Remodelamento V': 0,
        'Remodelamento D': 0
    };
    
    const relevantProductions = currentUserData && currentUserData.role === 'admin' 
        ? allProductions 
        : allProductions.filter(p => p.userId === currentUser.uid);
    
    relevantProductions.forEach(p => {
        if (p.points) {
            typeData['Retrofit 1'] += p.points.retrofit1 || 0;
            typeData['Retrofit 2'] += p.points.retrofit2 || 0;
            typeData['Retrofit 3'] += p.points.retrofit3 || 0;
            typeData['Retrofit 4'] += p.points.retrofit4 || 0;
            typeData['Remodelamento V'] += p.points.remodelagemV || 0;
            typeData['Remodelamento D'] += p.points.remodelagemD || 0;
        }
    });
    
    // Filtrar apenas tipos com dados
    const filteredTypes = Object.entries(typeData).filter(([key, value]) => value > 0);
    
    console.log('Dados do gráfico de tipos de projeto:', filteredTypes);
    
    if (filteredTypes.length === 0) {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = '16px Arial';
        context.fillStyle = '#666';
        context.textAlign = 'center';
        context.fillText('Nenhum dado disponível', ctx.width/2, ctx.height/2);
        return;
    }
    
    const colors = [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 205, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)'
    ];
    
    const borderColors = [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 205, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
    ];
    
    try {
        charts.projectType = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: filteredTypes.map(([key]) => key),
                datasets: [{
                    data: filteredTypes.map(([, value]) => value),
                    backgroundColor: colors.slice(0, filteredTypes.length),
                    borderColor: borderColors.slice(0, filteredTypes.length),
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    },
                    datalabels: {
                        color: '#fff',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: function(value, context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return percentage + '%';
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        cornerRadius: 6,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.raw} pontos (${percentage}%)`;
                            }
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
        console.log('Gráfico de tipos de projeto criado com sucesso');
    } catch (error) {
        console.error('Erro ao criar gráfico de tipos de projeto:', error);
    }
}

// Carregar histórico do usuário
function loadUserHistory() {
    const userProductions = allProductions
        .filter(p => p.userId === currentUser.uid)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const historyDiv = document.getElementById('productionHistory');
    if (!historyDiv) return;
    
    if (userProductions.length === 0) {
        historyDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Nenhuma produção registrada ainda.</p>';
        return;
    }
    
    historyDiv.innerHTML = userProductions.map(p => {
        // Formatar status
        const statusText = p.status === 'finalizado' ? '✅ Finalizado' : '🔄 Em Andamento';
        const statusColor = p.status === 'finalizado' ? '#4CAF50' : '#FF9800';
        
        // Formatar categorias
        const categories = [];
        if (p.categories?.luminotecnico) categories.push('Luminotécnico');
        if (p.categories?.eletrico) categories.push('Elétrico');
        if (p.categories?.planilhao) categories.push('Planilhão');
        if (p.categories?.croqui) categories.push('Croqui');
        const categoriesText = categories.length > 0 ? categories.join(', ') : 'Não especificado';
        
        return `
        <div class="production-item">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <strong>📅 ${new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
                    <br><strong>🏛️ Praça:</strong> ${p.plaza}
                    <br><strong>🎯 Projeto:</strong> ${p.projectType}
                    <br><strong>📊 Pontos:</strong> ${p.total}
                    <br><strong style="color: ${statusColor};">📋 Status:</strong> <span style="color: ${statusColor};">${statusText}</span>
                    <br><strong>🏷️ Categorias:</strong> ${categoriesText}
                    <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        R1: ${p.points?.retrofit1 || 0} | R2: ${p.points?.retrofit2 || 0} | R3: ${p.points?.retrofit3 || 0} | 
                        R4: ${p.points?.retrofit4 || 0} | RV: ${p.points?.remodelagemV || 0} | RD: ${p.points?.remodelagemD || 0}
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-edit" style="padding: 5px 10px; font-size: 12px;" onclick="editProduction('${p.id}')" title="Editar produção">
                        ✏️
                    </button>
                    <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="deleteProduction('${p.id}')" title="Deletar produção">
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

// Função de filtro de histórico
function filterHistory() {
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    const userProductions = allProductions
        .filter(p => p.userId === currentUser.uid)
        .filter(p => 
            (p.plaza && p.plaza.toLowerCase().includes(searchTerm)) ||
            (p.projectType && p.projectType.toLowerCase().includes(searchTerm)) ||
            (p.date && p.date.includes(searchTerm))
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const historyDiv = document.getElementById('productionHistory');
    if (!historyDiv) return;
    
    if (userProductions.length === 0) {
        historyDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Nenhuma produção encontrada.</p>';
        return;
    }
    
    historyDiv.innerHTML = userProductions.map(p => `
        <div class="production-item">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <strong>📅 ${new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
                    <br><strong>🏛️ Praça:</strong> ${p.plaza}
                    <br><strong>🎯 Projeto:</strong> ${p.projectType}
                    <br><strong>📊 Pontos:</strong> ${p.total}
                    <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        R1: ${p.points?.retrofit1 || 0} | R2: ${p.points?.retrofit2 || 0} | R3: ${p.points?.retrofit3 || 0} | 
                        R4: ${p.points?.retrofit4 || 0} | RV: ${p.points?.remodelagemV || 0} | RD: ${p.points?.remodelagemD || 0}
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-edit" style="padding: 5px 10px; font-size: 12px;" onclick="editProduction('${p.id}')" title="Editar produção">
                        ✏️
                    </button>
                    <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="deleteProduction('${p.id}')" title="Deletar produção">
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// FUNÇÕES DE EDIÇÃO DE PRODUÇÃO
let currentEditId = null;

function debugEditModal() {
    console.log('=== DEBUG DO MODAL DE EDIÇÃO ===');
    
    const modal = document.getElementById('editModal');
    console.log('Modal encontrado:', !!modal);
    
    if (modal) {
        console.log('Modal classes:', modal.className);
        console.log('Modal hidden:', modal.classList.contains('hidden'));
    }
    
    const elementsToCheck = [
        'editProjectDate',
        'editPlaza', 
        'editProjectType',
        'editProjectStatus',
        'editCategoryLuminotecnico',
        'editCategoryEletrico', 
        'editCategoryPlanilhao',
        'editCategoryCroqui',
        'editRetrofit1',
        'editRetrofit2',
        'editRetrofit3', 
        'editRetrofit4',
        'editRemodelagemV',
        'editRemodelagemD',
        'editTotalPoints'
    ];
    
    elementsToCheck.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✅ ${id}: encontrado`);
        } else {
            console.error(`❌ ${id}: NÃO ENCONTRADO`);
        }
    });
    
    console.log('=== FIM DO DEBUG ===');
}

// Função para editar produção
function editProduction(productionId) {
    console.log('=== INICIANDO EDIÇÃO DA PRODUÇÃO ===');
    console.log('Production ID:', productionId);
    
    const production = allProductions.find(p => p.id === productionId);
    if (!production) {
        console.error('Produção não encontrada para ID:', productionId);
        showError('Produção não encontrada');
        return;
    }
    
    console.log('Produção encontrada:', production);
    
    // Verificar permissões
    if (production.userId !== currentUser.uid && currentUserData.role !== 'admin') {
        showError('Você só pode editar suas próprias produções');
        return;
    }
    
    currentEditId = productionId;
    console.log('currentEditId definido como:', currentEditId);
    
    // Mostrar o modal ANTES de tentar preencher os campos
    const modal = document.getElementById('editModal');
    if (!modal) {
        console.error('Modal de edição não encontrado no DOM');
        showError('Erro: modal de edição não encontrado');
        return;
    }
    
    modal.classList.remove('hidden');
    console.log('Modal exibido');
    
    // Aguardar um momento para garantir que o modal esteja visível antes de preencher
    setTimeout(() => {
        try {
            // Debug dos elementos
            debugEditModal();
            
            // Preencher o modal de edição
            const editProjectDate = document.getElementById("editProjectDate");
            const editPlaza = document.getElementById("editPlaza");
            const editProjectType = document.getElementById("editProjectType");
            const editProjectStatus = document.getElementById("editProjectStatus");
            
            if (editProjectDate) editProjectDate.value = production.date || "";
            if (editPlaza) editPlaza.value = production.plaza || "";
            if (editProjectType) editProjectType.value = production.projectType || "";
            if (editProjectStatus) editProjectStatus.value = production.status || "em_andamento";
            
            // Preencher categorias
            const editCategoryLuminotecnico = document.getElementById('editCategoryLuminotecnico');
            const editCategoryEletrico = document.getElementById('editCategoryEletrico');
            const editCategoryPlanilhao = document.getElementById('editCategoryPlanilhao');
            const editCategoryCroqui = document.getElementById('editCategoryCroqui');
            
            if (editCategoryLuminotecnico) editCategoryLuminotecnico.checked = production.categories?.luminotecnico || false;
            if (editCategoryEletrico) editCategoryEletrico.checked = production.categories?.eletrico || false;
            if (editCategoryPlanilhao) editCategoryPlanilhao.checked = production.categories?.planilhao || false;
            if (editCategoryCroqui) editCategoryCroqui.checked = production.categories?.croqui || false;
            
            // Preencher pontos
            const editRetrofit1 = document.getElementById('editRetrofit1');
            const editRetrofit2 = document.getElementById('editRetrofit2');
            const editRetrofit3 = document.getElementById('editRetrofit3');
            const editRetrofit4 = document.getElementById('editRetrofit4');
            const editRemodelagemV = document.getElementById('editRemodelagemV');
            const editRemodelagemD = document.getElementById('editRemodelagemD');
            
            if (editRetrofit1) editRetrofit1.value = production.points?.retrofit1 || 0;
            if (editRetrofit2) editRetrofit2.value = production.points?.retrofit2 || 0;
            if (editRetrofit3) editRetrofit3.value = production.points?.retrofit3 || 0;
            if (editRetrofit4) editRetrofit4.value = production.points?.retrofit4 || 0;
            if (editRemodelagemV) editRemodelagemV.value = production.points?.remodelagemV || 0;
            if (editRemodelagemD) editRemodelagemD.value = production.points?.remodelagemD || 0;
            
            // Calcular total
            calculateEditTotal();
            
            console.log('✅ Modal preenchido com sucesso');
            
        } catch (error) {
            console.error('Erro ao preencher modal:', error);
            showError('Erro ao carregar dados para edição');
        }
    }, 100);
}

// Função para calcular total no modal de edição
function calculateEditTotal() {
    const fields = ['editRetrofit1', 'editRetrofit2', 'editRetrofit3', 'editRetrofit4', 'editRemodelagemV', 'editRemodelagemD'];
    let total = 0;
    
    fields.forEach(field => {
        const element = document.getElementById(field);
        if (element && element.value) {
            const value = parseInt(element.value) || 0;
            total += value;
        }
    });
    
    const totalEl = document.getElementById('editTotalPoints');
    if (totalEl) {
        totalEl.textContent = total;
    }
    
    console.log('Total calculado no modal de edição:', total);
}

// ADICIONAR ESTA FUNÇÃO AO FINAL DO SEU ARQUIVO script-firebase.js
// para verificar se o modal está sendo criado corretamente
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, verificando modal de edição...');
    
    const modal = document.getElementById('editModal');
    if (modal) {
        console.log('✅ Modal de edição encontrado no DOM');
    } else {
        console.error('❌ Modal de edição não encontrado no DOM');
    }
});

// Função para esconder modal de edição
function hideEditModal() {
    document.getElementById('editModal').classList.add('hidden');
    currentEditId = null;
    
    // Limpar formulário
    document.getElementById('editProjectDate').value = '';
    document.getElementById('editPlaza').value = '';
    document.getElementById('editProjectType').value = '';
    document.getElementById('editProjectStatus').value = '';
    document.getElementById('editCategoryLuminotecnico').checked = false;
    document.getElementById('editCategoryEletrico').checked = false;
    document.getElementById('editCategoryPlanilhao').checked = false;
    document.getElementById('editCategoryCroqui').checked = false;
    document.getElementById('editRetrofit1').value = 0;
    document.getElementById('editRetrofit2').value = 0;
    document.getElementById('editRetrofit3').value = 0;
    document.getElementById('editRetrofit4').value = 0;
    document.getElementById('editRemodelagemV').value = 0;
    document.getElementById('editRemodelagemD').value = 0;
    calculateEditTotal();
}

// Função para atualizar produção
async function updateProduction() {
    console.log('=== INICIANDO ATUALIZAÇÃO DA PRODUÇÃO ===');
    
    if (!currentEditId) {
        console.error('currentEditId não encontrado:', currentEditId);
        showError('ID da produção não encontrado');
        return;
    }
    
    const production = allProductions.find(p => p.id === currentEditId);
    if (!production) {
        console.error('Produção não encontrada para ID:', currentEditId);
        showError('Produção não encontrada');
        return;
    }
    
    // Verificar permissões
    if (production.userId !== currentUser.uid && currentUserData.role !== 'admin') {
        showError('Você só pode editar suas próprias produções');
        return;
    }
    
    // VERIFICAR SE TODOS OS ELEMENTOS EXISTEM ANTES DE PROSSEGUIR
    const requiredElements = {
        editProjectDate: document.getElementById('editProjectDate'),
        editPlaza: document.getElementById('editPlaza'),
        editProjectType: document.getElementById('editProjectType'),
        editProjectStatus: document.getElementById('editProjectStatus'),
        editCategoryLuminotecnico: document.getElementById('editCategoryLuminotecnico'),
        editCategoryEletrico: document.getElementById('editCategoryEletrico'),
        editCategoryPlanilhao: document.getElementById('editCategoryPlanilhao'),
        editCategoryCroqui: document.getElementById('editCategoryCroqui'),
        editRetrofit1: document.getElementById('editRetrofit1'),
        editRetrofit2: document.getElementById('editRetrofit2'),
        editRetrofit3: document.getElementById('editRetrofit3'),
        editRetrofit4: document.getElementById('editRetrofit4'),
        editRemodelagemV: document.getElementById('editRemodelagemV'),
        editRemodelagemD: document.getElementById('editRemodelagemD'),
        editTotalPoints: document.getElementById('editTotalPoints')
    };
    
    // Verificar se algum elemento está faltando
    const missingElements = [];
    Object.entries(requiredElements).forEach(([key, element]) => {
        if (!element) {
            missingElements.push(key);
        }
    });
    
    if (missingElements.length > 0) {
        console.error('Elementos faltando no DOM:', missingElements);
        showError(`Erro no formulário: elementos não encontrados (${missingElements.join(', ')})`);
        return;
    }
    
    // Validar campos obrigatórios
    const date = requiredElements.editProjectDate.value;
    const plaza = requiredElements.editPlaza.value.trim();
    const projectType = requiredElements.editProjectType.value.trim();
    const status = requiredElements.editProjectStatus.value;
    
    console.log('Valores dos campos:', { date, plaza, projectType, status });
    
    if (!date || !plaza || !projectType || !status) {
        showError('Por favor, preencha todos os campos obrigatórios');
        return;
    }
    
    // Validar se pelo menos uma categoria foi selecionada
    const categories = {
        luminotecnico: requiredElements.editCategoryLuminotecnico.checked,
        eletrico: requiredElements.editCategoryEletrico.checked,
        planilhao: requiredElements.editCategoryPlanilhao.checked,
        croqui: requiredElements.editCategoryCroqui.checked
    };
    
    console.log('Categorias selecionadas:', categories);
    
    const hasCategory = Object.values(categories).some(cat => cat);
    if (!hasCategory) {
        showError('Por favor, selecione pelo menos uma categoria do informe');
        return;
    }
    
    // Verificar se todas as categorias obrigatórias estão selecionadas para finalização automática
    const categoriasObrigatorias = ['luminotecnico', 'eletrico', 'planilhao'];
    const todasObrigatoriasCompletas = categoriasObrigatorias.every(cat => categories[cat]);
    
    let statusFinal = status;
    
    // Se todas as categorias obrigatórias estão marcadas, finalizar automaticamente
    if (todasObrigatoriasCompletas) {
        statusFinal = 'finalizado';
        console.log('🎉 Projeto será finalizado automaticamente - todas as categorias obrigatórias foram concluídas!');
    }
    
    try {
        showButtonLoading('updateBtn');
        
        // Coletar pontos
        const points = {
            retrofit1: parseInt(requiredElements.editRetrofit1.value) || 0,
            retrofit2: parseInt(requiredElements.editRetrofit2.value) || 0,
            retrofit3: parseInt(requiredElements.editRetrofit3.value) || 0,
            retrofit4: parseInt(requiredElements.editRetrofit4.value) || 0,
            remodelagemV: parseInt(requiredElements.editRemodelagemV.value) || 0,
            remodelagemD: parseInt(requiredElements.editRemodelagemD.value) || 0
        };
        
        const total = parseInt(requiredElements.editTotalPoints.textContent) || 0;
        
        console.log('Pontos coletados:', points, 'Total:', total);
        
        const updatedProduction = {
            date: date,
            plaza: plaza,
            projectType: projectType,
            status: statusFinal,
            categories: categories,
            points: points,
            total: total,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.uid,
            // Adicionar campos de finalização automática se aplicável
            ...(statusFinal === 'finalizado' && todasObrigatoriasCompletas && {
                dataFinalizacao: new Date().toISOString(),
                finalizadoAutomaticamente: true,
                categoriasObrigatoriasCompletas: true
            })
        };
        
        console.log('Dados a serem atualizados:', updatedProduction);
        
        // Atualizar no Firebase
        await db.collection(COLLECTIONS.PRODUCTIONS).doc(currentEditId).update(updatedProduction);
        
        console.log('✅ Produção atualizada no Firebase com sucesso');
        
        // Recarregar dados
        await loadAllData();
        updateDashboard();
        loadUserHistory();
        
        hideEditModal();
        
        // Mostrar notificação especial se o projeto foi finalizado automaticamente
        if (statusFinal === 'finalizado' && todasObrigatoriasCompletas) {
            showSuccess('🎉 PROJETO FINALIZADO AUTOMATICAMENTE!\n\nTodas as categorias obrigatórias foram concluídas:\n✅ Luminotécnico\n✅ Elétrico\n✅ Planilhão\n\nO projeto foi automaticamente marcado como finalizado!');
        } else {
            showSuccess('✅ Produção atualizada com sucesso!');
        }
        
    } catch (error) {
        console.error('Erro ao atualizar produção:', error);
        showError(`Erro ao atualizar produção: ${error.message}`);
    } finally {
        hideButtonLoading('updateBtn');
    }
}

// Função para deletar produção
async function deleteProduction(productionId) {
    const production = allProductions.find(p => p.id === productionId);
    if (!production) {
        showError('Produção não encontrada');
        return;
    }
    
    // Verificar permissões
    if (production.userId !== currentUser.uid && currentUserData.role !== 'admin') {
        showError('Você só pode deletar suas próprias produções');
        return;
    }
    
    if (!confirm(`❓ Tem certeza que deseja deletar a produção de ${new Date(production.date).toLocaleDateString('pt-BR')} - ${production.plaza}?`)) {
        return;
    }
    
    try {
        await db.collection(COLLECTIONS.PRODUCTIONS).doc(productionId).delete();
        
        await loadAllData();
        updateDashboard();
        loadUserHistory();
        
        showSuccess('✅ Produção deletada com sucesso!');
        
    } catch (error) {
        console.error('Erro ao deletar produção:', error);
        showError('Erro ao deletar produção');
    }
}

// FUNÇÕES ADMINISTRATIVAS
function showUserManagement() {
    if (currentUserData.role !== 'admin') {
        showError('Apenas administradores podem gerenciar usuários');
        return;
    }
    
    document.getElementById('userModal').classList.remove('hidden');
    loadUserList();
}

function hideUserManagement() {
    document.getElementById('userModal').classList.add('hidden');
    
    // Limpar formulário
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserAdmin').checked = false;
}

async function addUser() {
    if (currentUserData.role !== 'admin') {
        showError('Apenas administradores podem adicionar usuários');
        return;
    }
    
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const name = document.getElementById('newUserName').value.trim();
    const team = document.getElementById('newUserTeam').value;
    const isAdmin = document.getElementById('newUserAdmin').checked;
    
    if (!email || !password || !name) {
        showError('Por favor, preencha todos os campos');
        return;
    }
    
    if (password.length < 6) {
        showError('A senha deve ter pelo menos 6 caracteres');
        return;
    }
    
    try {
        showButtonLoading('addUserBtn');
        
        // Criar usuário no Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Criar perfil do usuário no Firestore
        await db.collection(COLLECTIONS.USERS).doc(user.uid).set({
            email: email,
            name: name,
            team: team,
            role: isAdmin ? 'admin' : 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid
        });
        
        // Recarregar dados
        await loadAllData();
        loadUserList();
        
        // Limpar formulário
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUserPassword').value = '';
        document.getElementById('newUserName').value = '';
        document.getElementById('newUserAdmin').checked = false;
        
        showSuccess('✅ Usuário adicionado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao adicionar usuário:', error);
        let errorMessage = 'Erro ao adicionar usuário';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email já está em uso';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email inválido';
                break;
            case 'auth/weak-password':
                errorMessage = 'Senha muito fraca';
                break;
        }
        
        showError(errorMessage);
    } finally {
        hideButtonLoading('addUserBtn');
    }
}

function loadUserList() {
    const userList = document.getElementById('userList');
    if (!userList) return;
    
    if (!allUsers || allUsers.length === 0) {
        userList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Nenhum usuário encontrado.</p>';
        return;
    }
    
    userList.innerHTML = '<h4>👥 Usuários Cadastrados:</h4>' + 
        allUsers.map(user => {
            const userProductions = allProductions.filter(p => p.userId === user.id);
            const totalPoints = userProductions.reduce((sum, p) => sum + p.total, 0);
            
            return `
                <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${user.name || user.email}</strong> - ${user.team} 
                        ${user.role === 'admin' ? '(Admin)' : '(Usuário)'}
                        <br><small style="color: #666;">
                            Email: ${user.email} | Produções: ${userProductions.length} | Pontos: ${totalPoints}
                        </small>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        ${user.id !== currentUser.uid ? `
                            <button class="btn" style="padding: 5px 10px; font-size: 12px;" onclick="toggleUserRole('${user.id}')">
                                ${user.role === 'admin' ? '⬇️ Rebaixar' : '⬆️ Promover'}
                            </button>
                            <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="deleteUser('${user.id}')">
                                🗑️ Deletar
                            </button>
                        ` : '<small style="color: #666;">Você</small>'}
                    </div>
                </div>
            `;
        }).join('');
}

async function toggleUserRole(userId) {
    if (currentUserData.role !== 'admin') {
        showError('Apenas administradores podem alterar funções');
        return;
    }
    
    try {
        const userToUpdate = allUsers.find(u => u.id === userId);
        if (!userToUpdate) return;
        
        const newRole = userToUpdate.role === 'admin' ? 'user' : 'admin';
        
        await db.collection(COLLECTIONS.USERS).doc(userId).update({
            role: newRole,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.uid
        });
        
        await loadAllData();
        loadUserList();
        
        showSuccess(`✅ Usuário ${userToUpdate.name || userToUpdate.email} ${newRole === 'admin' ? 'promovido a' : 'rebaixado de'} administrador!`);
        
    } catch (error) {
        console.error('Erro ao alterar função do usuário:', error);
        showError('Erro ao alterar função do usuário');
    }
}

async function deleteUser(userId) {
    if (currentUserData.role !== 'admin' || userId === currentUser.uid) {
        showError('Não é possível deletar este usuário');
        return;
    }
    
    const userToDelete = allUsers.find(u => u.id === userId);
    if (!userToDelete) return;
    
    if (!confirm(`❓ Tem certeza que deseja deletar o usuário ${userToDelete.name || userToDelete.email}? Todas as suas produções também serão removidas.`)) {
        return;
    }
    
    try {
        // Deletar produções do usuário
        const userProductions = await db.collection(COLLECTIONS.PRODUCTIONS)
            .where('userId', '==', userId)
            .get();
        
        const batch = db.batch();
        userProductions.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Deletar perfil do usuário
        batch.delete(db.collection(COLLECTIONS.USERS).doc(userId));
        
        await batch.commit();
        
        // Recarregar dados
        await loadAllData();
        loadUserList();
        updateDashboard();
        
        showSuccess('✅ Usuário deletado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        showError('Erro ao deletar usuário');
    }
}

// Exportar para Excel
async function exportToExcel() {
    if (currentUserData.role !== 'admin') {
        showError('Apenas administradores podem exportar dados');
        return;
    }
    
    if (allProductions.length === 0) {
        showError('Nenhum dado para exportar');
        return;
    }
    
    try {
        // Preparar dados para Excel
        const excelData = allProductions.map(p => ({
            'Data': p.date,
            'Projetista': p.userName || p.userEmail,
            'Email': p.userEmail,
            'Equipe': p.team,
            'Praça': p.plaza,
            'Tipo de Projeto': p.projectType,
            'Status': p.status === 'finalizado' ? 'Finalizado' : 'Em Andamento',
            'Luminotécnico': p.categories?.luminotecnico && p.status === 'finalizado' ? 'Finalizado' : (p.categories?.luminotecnico ? 'Em Andamento' : ''),
            'Elétrico': p.categories?.eletrico && p.status === 'finalizado' ? 'Finalizado' : (p.categories?.eletrico ? 'Em Andamento' : ''),
            'Planilhão': p.categories?.planilhao && p.status === 'finalizado' ? 'Finalizado' : (p.categories?.planilhao ? 'Em Andamento' : ''),
            'Croqui': p.categories?.croqui && p.status === 'finalizado' ? 'Finalizado' : (p.categories?.croqui ? 'Em Andamento' : ''),
            'Retrofit 1': p.points?.retrofit1 || 0,
            'Retrofit 2': p.points?.retrofit2 || 0,
            'Retrofit 3': p.points?.retrofit3 || 0,
            'Retrofit 4': p.points?.retrofit4 || 0,
            'Remodelamento V': p.points?.remodelagemV || 0,
            'Remodelamento D': p.points?.remodelagemD || 0,
            'Total de Pontos': p.total
        }));
        
        // Criar workbook
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produção Geral");
        
        // Adicionar estatísticas
        const stats = [
            ['Relatório de Produtividade Geral - Firebase'],
            ['Data de Geração:', new Date().toLocaleDateString('pt-BR')],
            [''],
            ['Resumo por Equipe:'],
            ['Curitiba:', allProductions.filter(p => p.team === 'Curitiba').reduce((sum, p) => sum + p.total, 0) + ' pontos'],
            ['Florianópolis:', allProductions.filter(p => p.team === 'Florianópolis').reduce((sum, p) => sum + p.total, 0) + ' pontos'],
            [''],
            ['Resumo por Projetista:']
        ];
        
        // Adicionar resumo por usuário
        const userSummary = {};
        allProductions.forEach(p => {
            const userName = p.userName || p.userEmail;
            userSummary[userName] = (userSummary[userName] || 0) + p.total;
        });
        
        Object.entries(userSummary).forEach(([user, points]) => {
            stats.push([user + ':', points + ' pontos']);
        });
        
        const wsStats = XLSX.utils.aoa_to_sheet(stats);
        XLSX.utils.book_append_sheet(wb, wsStats, "Resumo");
        
        // Download do arquivo
        const fileName = `Producao_Geral_Firebase_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showSuccess('✅ Arquivo Excel exportado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        showError('Erro ao exportar dados para Excel');
    }
}

// Sincronizar dados
async function syncData() {
    if (currentUserData.role !== 'admin') {
        showError('Apenas administradores podem sincronizar dados');
        return;
    }
    
    try {
        updateConnectionStatus('loading', 'Sincronizando dados...');
        await loadAllData();
        updateDashboard();
        loadUserHistory();
        updateConnectionStatus('connected', 'Dados sincronizados');
        showSuccess('✅ Dados sincronizados com sucesso!');
    } catch (error) {
        console.error('Erro ao sincronizar dados:', error);
        updateConnectionStatus('error', 'Erro na sincronização');
        showError('Erro ao sincronizar dados');
    }
}

// Configurar eventos de teclado
function setupKeyboardEvents() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const loginScreen = document.getElementById('loginScreen');
            if (loginScreen && !loginScreen.classList.contains('hidden')) {
                const emailField = document.getElementById('loginEmail');
                const passwordField = document.getElementById('loginPassword');
                if (document.activeElement === emailField || document.activeElement === passwordField) {
                    loginUser();
                }
            }
        }
        
        if (e.key === 'Escape') {
            const userModal = document.getElementById('userModal');
            if (userModal && !userModal.classList.contains('hidden')) {
                hideUserManagement();
            }
            
            const editModal = document.getElementById('editModal');
            if (editModal && !editModal.classList.contains('hidden')) {
                hideEditModal();
            }
        }
    });
}

// Configurar eventos de teclado do modal de edição
function setupEditModalEvents() {
    const editInputs = [
        'editRetrofit1', 'editRetrofit2', 'editRetrofit3', 
        'editRetrofit4', 'editRemodelagemV', 'editRemodelagemD'
    ];
    
    editInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', calculateEditTotal);
            element.addEventListener('change', calculateEditTotal);
        }
    });
}


// Chamar setupEditModalEvents após o DOM estar carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEditModalEvents);
} else {
    setupEditModalEvents();
}

console.log('🔧 Funções de edição corrigidas carregadas!');

// Configurações globais do Chart.js
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.plugins.legend.display = true;
Chart.defaults.plugins.legend.position = 'bottom';
Chart.defaults.elements.arc.borderWidth = 2;
Chart.defaults.elements.arc.borderColor = '#ffffff';
