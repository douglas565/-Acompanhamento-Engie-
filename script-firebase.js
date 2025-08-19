// 🔥 Sistema de Produtividade com Firebase
// Inicialização da aplicação

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Inicializar aplicação
function initializeApp() {
    setCurrentDate();
    setupAuthListener();
    setupFormListener();
    setupKeyboardEvents();
    
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
    
    updateDashboard();
    loadUserHistory();
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
        
        // Destruir gráficos
        Object.values(charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        charts = {};
        
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
                team: 'Curitiba',
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
    
    try {
        showButtonLoading('saveBtn');
        
        const production = {
            userId: currentUser.uid,
            userEmail: currentUserData.email,
            userName: currentUserData.name || currentUserData.email.split('@')[0],
            team: currentUserData.team,
            date: document.getElementById('projectDate').value,
            plaza: document.getElementById('plaza').value,
            projectType: document.getElementById('projectType').value,
            points: {
                retrofit1: parseInt(document.getElementById('retrofit1').value) || 0,
                retrofit2: parseInt(document.getElementById('retrofit2').value) || 0,
                retrofit3: parseInt(document.getElementById('retrofit3').value) || 0,
                retrofit4: parseInt(document.getElementById('retrofit4').value) || 0,
                remodelagemV: parseInt(document.getElementById('remodelagemV').value) || 0,
                remodelagemD: parseInt(document.getElementById('remodelagemD').value) || 0
            },
            total: parseInt(document.getElementById('totalPoints').textContent),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Salvar no Firebase
        await db.collection(COLLECTIONS.PRODUCTIONS).add(production);
        
        // Atualizar dados locais
        await loadAllData();
        
        // Reset form
        document.getElementById('productionForm').reset();
        setCurrentDate();
        calculateTotal();
        
        updateDashboard();
        loadUserHistory();
        
        showSuccess('✅ Produção salva com sucesso!');
        
    } catch (error) {
        console.error('Erro ao salvar produção:', error);
        showError('Erro ao salvar produção. Tente novamente.');
    } finally {
        hideButtonLoading('saveBtn');
    }
}

// Função para mostrar mensagem de sucesso
function showSuccess(message) {
    // Criar elemento de sucesso temporário
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
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
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
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
    
    // Pontos hoje
    const todayPoints = userProductions
        .filter(p => p.date === today)
        .reduce((sum, p) => sum + p.total, 0);
    
    // Pontos do mês
    const monthPoints = userProductions
        .filter(p => p.date && p.date.startsWith(currentMonth))
        .reduce((sum, p) => sum + p.total, 0);
    
    // Média diária
    const daysWithProduction = [...new Set(userProductions.map(p => p.date))].length;
    const avgPoints = daysWithProduction > 0 ? Math.round(monthPoints / daysWithProduction) : 0;
    
    // Atualizar elementos
    const elements = {
        'totalPointsToday': todayPoints,
        'totalPointsMonth': monthPoints,
        'avgPointsDay': avgPoints,
        'totalProjects': userProductions.length
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

function updateCharts() {
    updateTeamChart();
    updateMonthlyChart();
    updateUserChart();
    updateProjectTypeChart();
}

function updateTeamChart() {
    const ctx = document.getElementById('teamChart');
    if (!ctx) return;
    
    if (charts.team) {
        charts.team.destroy();
    }
    
    const curitibaPoints = allProductions
        .filter(p => p.team === 'Curitiba')
        .reduce((sum, p) => sum + p.total, 0);
        
    const florianopolisPoints = allProductions
        .filter(p => p.team === 'Florianópolis')
        .reduce((sum, p) => sum + p.total, 0);
    
    charts.team = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Curitiba', 'Florianópolis'],
            datasets: [{
                data: [curitibaPoints, florianopolisPoints],
                backgroundColor: ['#667eea', '#764ba2'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;
    
    if (charts.monthly) {
        charts.monthly.destroy();
    }
    
    // Agrupar por mês
    const monthlyData = {};
    const relevantProductions = currentUserData.role === 'admin' 
        ? allProductions 
        : allProductions.filter(p => p.userId === currentUser.uid);
    
    relevantProductions.forEach(p => {
        if (p.date) {
            const month = p.date.substring(0, 7);
            monthlyData[month] = (monthlyData[month] || 0) + p.total;
        }
    });
    
    const months = Object.keys(monthlyData).sort();
    const values = months.map(m => monthlyData[m]);
    
    charts.monthly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(m => {
                const [year, month] = m.split('-');
                return `${month}/${year}`;
            }),
            datasets: [{
                label: 'Pontos',
                data: values,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateUserChart() {
    const ctx = document.getElementById('userChart');
    if (!ctx) return;
    
    if (charts.user) {
        charts.user.destroy();
    }
    
    // Agrupar por usuário
    const userData = {};
    allProductions.forEach(p => {
        const userName = p.userName || p.userEmail;
        userData[userName] = (userData[userName] || 0) + p.total;
    });
    
    const sortedUsers = Object.entries(userData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    charts.user = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedUsers.map(u => u[0]),
            datasets: [{
                label: 'Pontos Totais',
                data: sortedUsers.map(u => u[1]),
                backgroundColor: '#764ba2',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateProjectTypeChart() {
    const ctx = document.getElementById('projectTypeChart');
    if (!ctx) return;
    
    if (charts.projectType) {
        charts.projectType.destroy();
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
    
    const relevantProductions = currentUserData.role === 'admin' 
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
    
    charts.projectType = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(typeData),
            datasets: [{
                data: Object.values(typeData),
                backgroundColor: [
                    '#ff6384',
                    '#36a2eb',
                    '#cc65fe',
                    '#ffce56',
                    '#4bc0c0',
                    '#9966ff'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
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
    
    historyDiv.innerHTML = userProductions.map(p => `
        <div class="production-item">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <strong>📅 ${new Date(p.date).toLocaleDateString('pt-BR')}</strong>
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
                    ${currentUserData.role === 'admin' ? `
                        <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="deleteProduction('${p.id}')" title="Deletar produção">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Função para buscar/filtrar histórico
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
                    <strong>📅 ${new Date(p.date).toLocaleDateString('pt-BR')}</strong>
                    <br><strong>🏛️ Praça:</strong> ${p.plaza}
                    <br><strong>🎯 Projeto:</strong> ${p.projectType}
                    <br><strong>📊 Pontos:</strong> ${p.total}
                    <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        R1: ${p.points?.retrofit1 || 0} | R2: ${p.points?.retrofit2 || 0} | R3: ${p.points?.retrofit3 || 0} | 
                        R4: ${p.points?.retrofit4 || 0} | RV: ${p.points?.remodelagemV || 0} | RD: ${p.points?.remodelagemD || 0}
                    </div>
                </div>
                ${currentUserData.role === 'admin' ? `
                    <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px; margin-left: 10px;" onclick="deleteProduction('${p.id}')">
                        🗑️
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Funções administrativas
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
        
        // Criar perfil no Firestore
        const userData = {
            email: email,
            name: name,
            team: team,
            role: isAdmin ? 'admin' : 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid
        };
        
        await db.collection(COLLECTIONS.USERS).doc(user.uid).set(userData);
        
        // Recarregar lista de usuários
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

async function deleteProduction(productionId) {
    if (currentUserData.role !== 'admin') {
        showError('Apenas administradores podem deletar produções');
        return;
    }
    
    if (!confirm('❓ Tem certeza que deseja deletar esta produção?')) {
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
        }
    });
}

// CORREÇÕES ESPECÍFICAS PARA OS GRÁFICOS
// Adicione essas funções ao seu script-firebase.js

// Configurações globais do Chart.js
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.plugins.legend.display = true;
Chart.defaults.plugins.legend.position = 'bottom';
Chart.defaults.elements.arc.borderWidth = 2;
Chart.defaults.elements.arc.borderColor = '#ffffff';

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
    if (!ctx) return;
    
    // Destruir gráfico anterior
    if (charts.team) {
        charts.team.destroy();
    }
    
    const curitibaPoints = allProductions
        .filter(p => p.team === 'Curitiba')
        .reduce((sum, p) => sum + p.total, 0);
        
    const florianopolisPoints = allProductions
        .filter(p => p.team === 'Florianópolis')
        .reduce((sum, p) => sum + p.total, 0);
    
    // Verificar se há dados
    if (curitibaPoints === 0 && florianopolisPoints === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        const context = ctx.getContext('2d');
        context.font = '16px Arial';
        context.fillStyle = '#666';
        context.textAlign = 'center';
        context.fillText('Nenhum dado disponível', ctx.width/2, ctx.height/2);
        return;
    }
    
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
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 6,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw} pontos (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Função corrigida para gráfico mensal
function updateMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;
    
    if (charts.monthly) {
        charts.monthly.destroy();
    }
    
    // Agrupar por mês
    const monthlyData = {};
    const relevantProductions = currentUserData.role === 'admin' 
        ? allProductions 
        : allProductions.filter(p => p.userId === currentUser.uid);
    
    relevantProductions.forEach(p => {
        if (p.date) {
            const month = p.date.substring(0, 7);
            monthlyData[month] = (monthlyData[month] || 0) + p.total;
        }
    });
    
    const months = Object.keys(monthlyData).sort();
    const values = months.map(m => monthlyData[m]);
    
    if (months.length === 0) {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = '16px Arial';
        context.fillStyle = '#666';
        context.textAlign = 'center';
        context.fillText('Nenhum dado disponível', ctx.width/2, ctx.height/2);
        return;
    }
    
    charts.monthly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(m => {
                const [year, month] = m.split('-');
                const date = new Date(year, month - 1);
                return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            }),
            datasets: [{
                label: 'Pontos de Produção',
                data: values,
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 6,
                    callbacks: {
                        title: function(tooltipItems) {
                            return `Mês: ${tooltipItems[0].label}`;
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
                        color: 'rgba(0,0,0,0.1)'
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
}

// Função corrigida para ranking de usuários
function updateUserChart() {
    const ctx = document.getElementById('userChart');
    if (!ctx) return;
    
    if (charts.user) {
        charts.user.destroy();
    }
    
    // Agrupar por usuário
    const userData = {};
    allProductions.forEach(p => {
        const userName = p.userName || p.userEmail || 'Usuário Desconhecido';
        userData[userName] = (userData[userName] || 0) + p.total;
    });
    
    const sortedUsers = Object.entries(userData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sortedUsers.length === 0) {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = '16px Arial';
        context.fillStyle = '#666';
        context.textAlign = 'center';
        context.fillText('Nenhum dado disponível', ctx.width/2, ctx.height/2);
        return;
    }
    
    charts.user = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedUsers.map(u => {
                const name = u[0];
                return name.length > 15 ? name.substring(0, 12) + '...' : name;
            }),
            datasets: [{
                label: 'Pontos Totais',
                data: sortedUsers.map(u => u[1]),
                backgroundColor: 'rgba(118, 75, 162, 0.8)',
                borderColor: 'rgba(118, 75, 162, 1)',
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: 'rgba(118, 75, 162, 0.9)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 6,
                    callbacks: {
                        title: function(tooltipItems) {
                            const originalName = sortedUsers[tooltipItems[0].dataIndex][0];
                            return originalName;
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
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Função corrigida para gráfico de tipos de projeto
function updateProjectTypeChart() {
    const ctx = document.getElementById('projectTypeChart');
    if (!ctx) return;
    
    if (charts.projectType) {
        charts.projectType.destroy();
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
    
    const relevantProductions = currentUserData.role === 'admin' 
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
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 6,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw} pontos (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
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

// Função melhorada para atualizar todos os gráficos (sem ranking)
function updateCharts() {
    // Verificar se temos dados
    if (!allProductions || allProductions.length === 0) {
        console.log('Nenhum dado de produção disponível para gráficos');
        return;
    }
    
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

// Modificar a função de inicialização para incluir o setup de resize
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

// Modificar a função showMainScreen para garantir que os gráficos sejam inicializados corretamente
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

// Função de logout melhorada para limpar gráficos
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