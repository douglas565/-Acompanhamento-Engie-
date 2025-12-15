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
    setupChartResize(); 
    
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
    
    const loginScreen = document.getElementById('loginScreen');
    const mainScreen = document.getElementById('mainScreen');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainScreen) mainScreen.classList.remove('hidden');
    
    // Verifica se os elementos de Admin existem antes de aceder classList
    const adminPanel = document.getElementById('adminPanel');
    const finishedProjectsChartCard = document.getElementById('finishedProjectsChartCard');

    if (currentUserData && currentUserData.role === 'admin') {
        if (adminPanel) adminPanel.classList.remove('hidden');
        if (finishedProjectsChartCard) finishedProjectsChartCard.classList.remove('hidden');
    } else {
        if (adminPanel) adminPanel.classList.add('hidden');
        if (finishedProjectsChartCard) finishedProjectsChartCard.classList.add('hidden');
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
    
    // Verifica se os elementos existem antes de tentar alterá-los
    const currentUserEl = document.getElementById('currentUser');
    const userRoleEl = document.getElementById('userRole');
    
    if (currentUserEl) {
        currentUserEl.textContent = currentUserData.name || currentUserData.email;
    }
    
    if (userRoleEl) {
        userRoleEl.textContent = `(${currentUserData.team} - ${currentUserData.role === 'admin' ? 'Administrador' : 'Usuário'})`;
    }
    
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
        
        // Ocultar elementos de admin ao sair
        const adminPanel = document.getElementById('adminPanel');
        const finishedProjectsChartCard = document.getElementById('finishedProjectsChartCard');
        
        if(adminPanel) adminPanel.classList.add('hidden');
        if(finishedProjectsChartCard) finishedProjectsChartCard.classList.add('hidden');

        // Limpar formulários
        const emailInput = document.getElementById('loginEmail');
        const passInput = document.getElementById('loginPassword');
        if(emailInput) emailInput.value = '';
        if(passInput) passInput.value = '';
        
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
        setTimeout(waitForChart, 100);
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
        
        // Dados de demonstração removidos para limpar o código, 
        // já que o sistema está em produção/teste real
        
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
async function handleProductionSubmit(e) {
    e.preventDefault();
    
    if (!currentUser || !currentUserData) {
        showError('Erro: usuário não autenticado');
        return;
    }
    
    // Declarar elementos do formulário
    const projectDateEl = document.getElementById('projectDate');
    const plazaEl = document.getElementById('plaza');
    const projectTypeEl = document.getElementById('projectType'); // Nota: no HTML parece não haver id="projectType", mas sim "projectNumber". Ajustar se necessário.
    const projectStatusEl = document.getElementById('projectStatus');
    
    if (!projectDateEl) {
        console.error('Elemento projectDate não encontrado');
        showError('Erro: campo de data não encontrado no formulário');
        return;
    }
    
    // Categorias
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
    
    const categoriasObrigatorias = ['luminotecnico', 'eletrico', 'planilhao'];
    const todasObrigatoriasCompletas = categoriasObrigatorias.every(cat => categories[cat]);
    
    let statusProjeto = projectStatusEl?.value || 'em_andamento';
    if (todasObrigatoriasCompletas) {
        statusProjeto = 'finalizado';
        console.log('🎉 Projeto será finalizado automaticamente - todas as categorias obrigatórias foram concluídas!');
    }

    const points = {
        retrofit1: parseInt(document.getElementById('retrofit1')?.value) || 0,
        retrofit2: parseInt(document.getElementById('retrofit2')?.value) || 0,
        retrofit3: parseInt(document.getElementById('retrofit3')?.value) || 0,
        retrofit4: parseInt(document.getElementById('retrofit4')?.value) || 0,
        remodelagemV: parseInt(document.getElementById('remodelagemV')?.value) || 0,
        remodelagemD: parseInt(document.getElementById('remodelagemD')?.value) || 0
    };

    const total = Object.values(points).reduce((sum, val) => sum + val, 0);

    try {
        showButtonLoading('saveBtn');
        
        const production = {
            userId: currentUser.uid,
            userEmail: currentUserData.email,
            userName: currentUserData.name || currentUserData.email.split('@')[0],
            team: currentUserData.team,
            date: projectDateEl.value || new Date().toISOString().split('T')[0],
            projectNumber: document.getElementById('projectNumber')?.value.trim() || 'N/A',
            plaza: plazaEl?.value || 'N/A',
            projectType: projectTypeEl?.value || 'N/A', // Verifique se este campo existe no HTML
            status: statusProjeto,
            isRevision: document.getElementById('isRevision').checked,
            categories: categories,
            points: points,
            total: total,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
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
        
        // Resetar formulário
        const form = document.getElementById('productionForm');
        if (form) {
            form.reset();
        }
        setCurrentDate();
        calculateTotal();
        
        updateDashboard();
        loadUserHistory();
        
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

// Função para mostrar mensagem de sucesso
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = message.replace(/\n/g, '<br>');
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
    if (currentUserData.role === 'admin') {
        checkForDuplicateProjects();
    }
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

    const todayPoints = userProductions
        .filter(p => p.date === today)
        .reduce((sum, p) => sum + p.total, 0);
    
    const monthPoints = userProductions
        .filter(p => p.date && p.date.startsWith(currentMonth))
        .reduce((sum, p) => sum + p.total, 0);
    
    const daysWithProduction = [...new Set(userProductions.map(p => p.date))].length;
    const avgPoints = daysWithProduction > 0 ? Math.round(monthPoints / daysWithProduction) : 0;
    
    const elements = {
        'totalPointsToday': todayPoints,
        'totalPointsMonth': monthPoints,
        'avgPointsDay': avgPoints,
        'totalProjects': filteredForNewLogic.length
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

// Função melhorada para atualizar todos os gráficos
function updateCharts() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js não está carregado!');
        return;
    }

    if (!allProductions || allProductions.length === 0) {
        console.log('Nenhum dado de produção disponível para gráficos');
        return;
    }
    
    console.log('Iniciando renderização dos gráficos...');
    initializeChartWrappers();
    
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

        if (currentUserData && currentUserData.role === 'admin') {
            try {
                updateFinishedProjectsChart();
            } catch (error) {
                console.error('Erro ao atualizar gráfico de projetos finalizados:', error);
            }
        }
    }, 100);
}

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

// *** FUNÇÃO CORRIGIDA PARA GRÁFICO DE EQUIPES ***
function updateTeamChart() {
    const ctx = document.getElementById('teamChart');
    if (!ctx) return;
    const teamChartCard = ctx.closest('.chart-card');

    if (!currentUserData || currentUserData.role !== 'admin') {
        if (teamChartCard) teamChartCard.style.display = 'none';
        return; 
    } else {
        if (teamChartCard) teamChartCard.style.display = ''; 
    }

    if (!ctx) return;
    
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
    
    if (curitibaPoints === 0 && florianopolisPoints === 0) {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = '16px Arial';
        context.fillStyle = '#666';
        context.textAlign = 'center';
        context.fillText('Nenhum dado disponível', ctx.width/2, ctx.height/2);
        return;
    }

    // --- CORREÇÃO DE SEGURANÇA: Verifica se o plugin existe ---
    const pluginsList = [];
    if (typeof ChartDataLabels !== 'undefined') {
        pluginsList.push(ChartDataLabels);
    }
    
    try {
        charts.team = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Curitiba', 'Florianópolis'],
                datasets: [{
                    data: [curitibaPoints, florianopolisPoints],
                    backgroundColor: ['rgba(102, 126, 234, 0.8)', 'rgba(118, 75, 162, 0.8)'],
                    borderColor: ['rgba(102, 126, 234, 1)', 'rgba(118, 75, 162, 1)'],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 16 },
                        formatter: (value) => value,
                        display: (context) => context.dataset.data[context.dataIndex] > 0
                    }
                }
            },
            plugins: pluginsList // Usa lista segura
        });
    } catch (error) {
        console.error('Erro ao criar gráfico de equipes:', error);
    }
}

// Função para gráfico mensal
function updateMonthlyChart() {
    const ctx = document.getElementById("monthlyChart");
    if (!ctx) return;

    if (charts.monthly) {
        charts.monthly.destroy();
        charts.monthly = null;
    }

    const weeklyData = {};
    const relevantProductions = currentUserData && currentUserData.role === "admin" 
        ? allProductions 
        : allProductions.filter(p => p.userId === currentUser.uid);
    
    relevantProductions.forEach(p => {
        if (p.date) {
            const date = new Date(p.date + "T00:00:00"); 
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(date.setDate(diff));
            const weekKey = monday.toISOString().substring(0, 10);
            weeklyData[weekKey] = (weeklyData[weekKey] || 0) + p.total;
        }
    });
    
    const weeks = Object.keys(weeklyData).sort();
    const values = weeks.map(w => weeklyData[w]);
    
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
                interaction: { intersect: false, mode: "index" },
                onClick: (evt, elements) => {
                    if (currentUserData && currentUserData.role !== "admin") {
                        showError("Apenas administradores podem visualizar detalhes da semana");
                        return;
                    }
                    if (elements.length > 0) {
                        const chart = elements[0];
                        const weekKey = weeks[chart.index];
                        showWeeklyDetails(weekKey);
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => `Semana: ${tooltipItems[0].label}`,
                            label: (context) => `Pontos: ${context.raw}`
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.1)" } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (error) {
        console.error("Erro ao criar gráfico mensal:", error);
    }
}

function showWeeklyDetails(weekKey) {
    const start = new Date(weekKey + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const weeklyProductions = allProductions.filter(p => {
        const date = new Date(p.date + "T00:00:00");
        return date >= start && date <= end;
    });

    if (weeklyProductions.length === 0) {
        alert("Nenhuma produção encontrada para esta semana.");
        return;
    }

    const groupedByUser = {};
    weeklyProductions.forEach(p => {
        const user = p.userName || p.userEmail;
        if (!groupedByUser[user]) {
            groupedByUser[user] = 0;
        }
        groupedByUser[user] += p.total;
    });

    let detailsHtml = `
        <div class="modal-header">
            <h3>Produções da semana ${start.toLocaleDateString("pt-BR")} - ${end.toLocaleDateString("pt-BR")}</h3>
            <button class="close-button" onclick="document.getElementById('weeklyDetails').classList.add('hidden')">&times;</button>
        </div>
        <div class="modal-body">
    `;
    
    for (const user in groupedByUser) {
        const userTotalPoints = groupedByUser[user];
        detailsHtml += `<p><strong>${user}: ${userTotalPoints} pontos</strong></p>`;
    }
    
    detailsHtml += `</div>`;

    const detailsDiv = document.getElementById("weeklyDetails");
    if (detailsDiv) {
        detailsDiv.innerHTML = detailsHtml;
        detailsDiv.classList.remove("hidden");
        detailsDiv.style.display = "block";
    } else {
        alert(detailsHtml.replace(/<[^>]+>/g, ""));
    }
}

// *** FUNÇÃO CORRIGIDA PARA GRÁFICO DE TIPOS ***
function updateProjectTypeChart() {
    const ctx = document.getElementById('projectTypeChart');
    if (!ctx) return;
    
    if (charts.projectType) {
        charts.projectType.destroy();
        charts.projectType = null;
    }
    
    const typeData = {
        'Retrofit 1': 0, 'Retrofit 2': 0, 'Retrofit 3': 0, 
        'Retrofit 4': 0, 'Remodelamento V': 0, 'Remodelamento D': 0
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
    
    const filteredTypes = Object.entries(typeData).filter(([key, value]) => value > 0);
    
    if (filteredTypes.length === 0) {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = '16px Arial';
        context.fillStyle = '#666';
        context.textAlign = 'center';
        context.fillText('Nenhum dado disponível', ctx.width/2, ctx.height/2);
        return;
    }
    
    // --- CORREÇÃO DE SEGURANÇA: Verifica se o plugin existe ---
    const pluginsList = [];
    if (typeof ChartDataLabels !== 'undefined') {
        pluginsList.push(ChartDataLabels);
    }
    
    try {
        charts.projectType = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: filteredTypes.map(([key]) => key),
                datasets: [{
                    data: filteredTypes.map(([, value]) => value),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 205, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 14 },
                        formatter: (value) => value
                    }
                }
            },
            plugins: pluginsList // Usa lista segura
        });
    } catch (error) {
        console.error('Erro ao criar gráfico de tipos de projeto:', error);
    }
}

// Gráfico de projetos finalizados na semana
function updateFinishedProjectsChart() {
    const ctx = document.getElementById('finishedProjectsChart');
    if (!ctx) return;

    if (charts.finishedProjects) {
        charts.finishedProjects.destroy();
        charts.finishedProjects = null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const dayOfWeek = today.getDay(); 
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const finishedProductionsThisWeek = allProductions.filter(p => {
        if (p.status !== 'finalizado' || !p.date) return false;
        const projectDate = new Date(p.date + 'T00:00:00');
        return projectDate >= startOfWeek && projectDate <= endOfWeek;
    });

    const projectsByUser = {};
    finishedProductionsThisWeek.forEach(p => {
        const userName = p.userName || p.userEmail;
        if (!projectsByUser[userName]) {
            projectsByUser[userName] = [];
        }
        projectsByUser[userName].push(p);
    });

    const users = Object.keys(projectsByUser);
    const projectCounts = users.map(user => projectsByUser[user].length);

    if (users.length === 0) {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = '16px Arial';
        context.fillStyle = '#666';
        context.textAlign = 'center';
        context.fillText('Nenhum projeto finalizado nesta semana', ctx.width / 2, ctx.height / 2);
        return;
    }

    try {
        charts.finishedProjects = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: users,
                datasets: [{
                    label: 'Projetos Finalizados na Semana',
                    data: projectCounts,
                    backgroundColor: 'rgba(75, 192, 192, 0.8)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const user = users[index];
                        showFinishedProjectsDetails(user, projectsByUser[user]);
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Projetos na semana: ${context.raw}`
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    } catch (error) {
        console.error("Erro ao criar gráfico de projetos finalizados:", error);
    }
}

function showFinishedProjectsDetails(user, projects) {
    const detailsDiv = document.getElementById('finishedProjectsDetails');
    if (!detailsDiv) return;

    let detailsHtml = `
        <div class="modal-header">
            <h3>Projetos Finalizados por ${user}</h3>
            <button class="close-button" onclick="document.getElementById('finishedProjectsDetails').classList.add('hidden')">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 300px; overflow-y: auto;">
            <ul>
    `;

    projects.forEach(p => {
        const date = new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR');
        detailsHtml += `<li><strong>${date}:</strong> ${p.plaza || 'N/A'} - ${p.projectType || 'N/A'} (${p.total} pontos)</li>`;
    });

    detailsHtml += `</ul></div>`;
    
    detailsDiv.innerHTML = detailsHtml;
    detailsDiv.classList.remove('hidden');
}

function checkForDuplicateProjects() {
    const warningContainer = document.getElementById('duplicateProjectsWarning');
    const listDiv = document.getElementById('duplicateProjectsList');
    const countBadge = document.getElementById('dupCountBadge'); // Novo elemento

    if (!warningContainer || !listDiv) return;

    const productionsByPlaza = {};

    // Agrupa produções
    allProductions.forEach(p => {
        if (p.plaza) {
            const plazaName = p.plaza.trim().toLowerCase();
            if (!productionsByPlaza[plazaName]) {
                productionsByPlaza[plazaName] = {};
            }
            const userName = p.userName || p.userEmail;
            if (!productionsByPlaza[plazaName][userName]) {
                productionsByPlaza[plazaName][userName] = [];
            }
            productionsByPlaza[plazaName][userName].push(p);
        }
    });

    let duplicatesHtml = '';
    let duplicateCount = 0; // Contador de casos

    for (const plaza in productionsByPlaza) {
        const users = Object.keys(productionsByPlaza[plaza]);
        if (users.length > 1) {
            duplicateCount++;
            // Recupera o nome original da praça do primeiro registro encontrado
            const originalPlazaName = allProductions.find(p => p.plaza.trim().toLowerCase() === plaza).plaza;
            
            duplicatesHtml += `
                <div class="duplicate-item" style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,0.1);">
                    <strong style="color: #a00;">Praça: ${originalPlazaName}</strong>
                    <br>
                    <span style="font-size: 0.9em;">Encontrado nos registros de: <b>${users.join(', ')}</b></span>
                </div>
            `;
        }
    }

    if (duplicateCount > 0) {
        listDiv.innerHTML = duplicatesHtml;
        if (countBadge) countBadge.textContent = duplicateCount;
        
        warningContainer.classList.remove('hidden'); // Mostra a caixa vermelha
        
        // Garante que a lista comece fechada (recolhida)
        listDiv.classList.add('hidden'); 
        const arrow = document.getElementById('dupArrow');
        if(arrow) arrow.style.transform = 'rotate(0deg)';
        
    } else {
        listDiv.innerHTML = '';
        warningContainer.classList.add('hidden');
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
        const statusText = p.status === 'finalizado' ? '✅ Finalizado' : '🔄 Em Andamento';
        const statusColor = p.status === 'finalizado' ? '#4CAF50' : '#FF9800';
        
        const categories = [];
        if (p.categories?.luminotecnico) categories.push('Luminotécnico');
        if (p.categories?.eletrico) categories.push('Elétrico');
        if (p.categories?.planilhao) categories.push('Planilhão');
        if (p.categories?.croqui) categories.push('Croqui');
        const categoriesText = categories.length > 0 ? categories.join(', ') : 'Não especificado';

        const revisionBadge = p.isRevision ? 
            '<span style="background: #ffc107; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; margin-left: 8px;">⚠️ REVISÃO</span>' 
            : '';
        
        return `
        <div class="production-item">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <strong>📅 ${new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
                    <br><strong>📁 Nº do Projeto:</strong> ${p.projectNumber || 'N/A'}
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

function filterHistory() {
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    const userProductions = allProductions
        .filter(p => p.userId === currentUser.uid)
        .filter(p => 
            (p.plaza && p.plaza.toLowerCase().includes(searchTerm)) ||
            (p.projectType && p.projectType.toLowerCase().includes(searchTerm)) ||
            (p.projectNumber && p.projectNumber.toLowerCase().includes(searchTerm)) ||
            (p.date && p.date.includes(searchTerm))
        );
    
    userProductions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const historyDiv = document.getElementById('productionHistory');
    if (!historyDiv) return;
    
    if (userProductions.length === 0) {
        historyDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Nenhuma produção encontrada.</p>';
        return;
    }
    
    historyDiv.innerHTML = userProductions.map(p => {
        const statusText = p.status === 'finalizado' ? '✅ Finalizado' : '🔄 Em Andamento';
        const statusColor = p.status === 'finalizado' ? '#4CAF50' : '#FF9800';
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
                    <br><strong>📁 Nº do Projeto:</strong> ${p.projectNumber || 'N/A'}
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
    `}).join('');
}


// FUNÇÕES DE EDIÇÃO DE PRODUÇÃO
let currentEditId = null;

function editProduction(productionId) {
    const production = allProductions.find(p => p.id === productionId);
    if (!production) {
        showError('Produção não encontrada');
        return;
    }
    
    if (production.userId !== currentUser.uid && currentUserData.role !== 'admin') {
        showError('Você só pode editar suas próprias produções');
        return;
    }
    
    currentEditId = productionId;
    
    const modal = document.getElementById('editModal');
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        try {
            document.getElementById("editProjectDate").value = production.date || "";
            document.getElementById("editProjectNumber").value = production.projectNumber || "";
            document.getElementById("editPlaza").value = production.plaza || "";
            document.getElementById("editProjectType").value = production.projectType || "";
            document.getElementById("editProjectStatus").value = production.status || "em_andamento";
            document.getElementById('editIsRevision').checked = production.isRevision || false;
            
            document.getElementById('editCategoryLuminotecnico').checked = production.categories?.luminotecnico || false;
            document.getElementById('editCategoryEletrico').checked = production.categories?.eletrico || false;
            document.getElementById('editCategoryPlanilhao').checked = production.categories?.planilhao || false;
            document.getElementById('editCategoryCroqui').checked = production.categories?.croqui || false;
            
            document.getElementById('editRetrofit1').value = production.points?.retrofit1 || 0;
            document.getElementById('editRetrofit2').value = production.points?.retrofit2 || 0;
            document.getElementById('editRetrofit3').value = production.points?.retrofit3 || 0;
            document.getElementById('editRetrofit4').value = production.points?.retrofit4 || 0;
            document.getElementById('editRemodelagemV').value = production.points?.remodelagemV || 0;
            document.getElementById('editRemodelagemD').value = production.points?.remodelagemD || 0;
            
            calculateEditTotal();
            
        } catch (error) {
            console.error('Erro ao preencher modal:', error);
            showError('Erro ao carregar dados para edição');
        }
    }, 100);
}

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
}

function hideEditModal() {
    document.getElementById('editModal').classList.add('hidden');
    currentEditId = null;
}

async function updateProduction() {
    if (!currentEditId) {
        showError('ID da produção não encontrado');
        return;
    }
    
    const production = allProductions.find(p => p.id === currentEditId);
    if (!production) {
        showError('Produção não encontrada');
        return;
    }
    
    if (production.userId !== currentUser.uid && currentUserData.role !== 'admin') {
        showError('Você só pode editar suas próprias produções');
        return;
    }

    const requiredElements = {
        editProjectDate: document.getElementById('editProjectDate'),
        editProjectNumber: document.getElementById('editProjectNumber'), 
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

    const categories = {
        luminotecnico: requiredElements.editCategoryLuminotecnico.checked,
        eletrico: requiredElements.editCategoryEletrico.checked,
        planilhao: requiredElements.editCategoryPlanilhao.checked,
        croqui: requiredElements.editCategoryCroqui.checked
    };
    
    const todasObrigatoriasCompletas = ['luminotecnico', 'eletrico', 'planilhao'].every(cat => categories[cat]);
    
    let statusFinal = requiredElements.editProjectStatus.value;
    if (todasObrigatoriasCompletas) {
        statusFinal = 'finalizado';
    }
    
    try {
        showButtonLoading('updateBtn');
        
        const points = {
            retrofit1: parseInt(requiredElements.editRetrofit1.value) || 0,
            retrofit2: parseInt(requiredElements.editRetrofit2.value) || 0,
            retrofit3: parseInt(requiredElements.editRetrofit3.value) || 0,
            retrofit4: parseInt(requiredElements.editRetrofit4.value) || 0,
            remodelagemV: parseInt(requiredElements.editRemodelagemV.value) || 0,
            remodelagemD: parseInt(requiredElements.editRemodelagemD.value) || 0
        };
        
        const updatedProduction = {
            date: requiredElements.editProjectDate.value,
            projectNumber: requiredElements.editProjectNumber.value.trim(),
            plaza: requiredElements.editPlaza.value.trim(),
            projectType: requiredElements.editProjectType.value.trim(),
            status: statusFinal,
            isRevision: document.getElementById('editIsRevision').checked,
            categories: categories,
            points: points,
            total: Object.values(points).reduce((sum, val) => sum + val, 0),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.uid,
            ...(statusFinal === 'finalizado' && todasObrigatoriasCompletas && {
                dataFinalizacao: new Date().toISOString(),
                finalizadoAutomaticamente: true,
                categoriasObrigatoriasCompletas: true
            })
        };
        
        await db.collection(COLLECTIONS.PRODUCTIONS).doc(currentEditId).update(updatedProduction);
        
        await loadAllData();
        updateDashboard();
        loadUserHistory();
        
        hideEditModal();
        
        showSuccess('✅ Produção atualizada com sucesso!');
        
    } catch (error) {
        console.error('Erro ao atualizar produção:', error);
        showError(`Erro ao atualizar produção: ${error.message}`);
    } finally {
        hideButtonLoading('updateBtn');
    }
}

async function deleteProduction(productionId) {
    const production = allProductions.find(p => p.id === productionId);
    if (!production) {
        showError('Produção não encontrada');
        return;
    }
    
    if (production.userId !== currentUser.uid && currentUserData.role !== 'admin') {
        showError('Você só pode deletar suas próprias produções');
        return;
    }
    
    if (!confirm(`❓ Tem certeza que deseja deletar a produção de ${new Date(production.date + 'T00:00:00').toLocaleDateString('pt-BR')} - ${production.plaza}?`)) {
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
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await db.collection(COLLECTIONS.USERS).doc(user.uid).set({
            email: email,
            name: name,
            team: team,
            role: isAdmin ? 'admin' : 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid
        });
        
        await loadAllData();
        loadUserList();
        
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
        const userProductions = await db.collection(COLLECTIONS.PRODUCTIONS)
            .where('userId', '==', userId)
            .get();
        
        const batch = db.batch();
        userProductions.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        batch.delete(db.collection(COLLECTIONS.USERS).doc(userId));
        
        await batch.commit();
        
        await loadAllData();
        loadUserList();
        updateDashboard();
        
        showSuccess('✅ Usuário deletado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        showError('Erro ao deletar usuário');
    }
}

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
        const excelData = allProductions.map(p => ({
            'Data': p.date,
            'Projetista': p.userName || p.userEmail,
            'Email': p.userEmail,
            'Equipe': p.team,
            'Praça': p.plaza,
            'É Revisão?': p.isRevision ? 'SIM' : 'NÃO',
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
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produção Geral");
        
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
        
        const fileName = `Producao_Geral_Firebase_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showSuccess('✅ Arquivo Excel exportado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        showError('Erro ao exportar dados para Excel');
    }
}

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

// Função para abrir/fechar a lista de duplicados
function toggleDuplicateList() {
    const list = document.getElementById('duplicateProjectsList');
    const arrow = document.getElementById('dupArrow');
    
    if (list && arrow) {
        if (list.classList.contains('hidden')) {
            list.classList.remove('hidden');
            arrow.style.transform = 'rotate(180deg)';
        } else {
            list.classList.add('hidden');
            arrow.style.transform = 'rotate(0deg)';
        }
    }
}

// ============================================================
// 1. CONECTAR FUNÇÕES AO WINDOW (CRUCIAL PARA OS BOTÕES)
// ============================================================
// Isso impede o erro "is not defined" que deixa a tela branca ou botões mortos
window.toggleDuplicateList = toggleDuplicateList;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.fillDemoUser = fillDemoUser;
window.calculateTotal = calculateTotal;

// Administrativo
window.showUserManagement = showUserManagement;
window.hideUserManagement = hideUserManagement;
window.addUser = addUser;
window.toggleUserRole = toggleUserRole;
window.deleteUser = deleteUser;
window.exportToExcel = exportToExcel;
window.syncData = syncData;

// Edição
window.editProduction = editProduction;
window.updateProduction = updateProduction;
window.deleteProduction = deleteProduction;
window.hideEditModal = hideEditModal;
window.calculateEditTotal = calculateEditTotal;

// Exportar global para gráficos usarem
window.updateDashboard = updateDashboard;

console.log('✅ Botões e funções conectados com sucesso!');

// ============================================================
// 2. INICIALIZAÇÃO SEGURA (EVITA TELA BRANCA)
// ============================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEditModalEvents);
} else {
    setupEditModalEvents();
}

// Configuração SEGURA do Chart.js
// O 'if' impede que o site todo trave se o gráfico demorar para carregar
if (typeof Chart !== 'undefined') {
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.display = true;
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.elements.arc.borderWidth = 2;
    Chart.defaults.elements.arc.borderColor = '#ffffff';
} else {
    console.warn('⚠️ Chart.js não carregou. Gráficos indisponíveis, mas o sistema segue funcional.');
}