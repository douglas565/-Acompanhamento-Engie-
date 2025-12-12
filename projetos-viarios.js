// Encapsular tudo em uma IIFE para evitar conflitos globais
(function() {
    'use strict';
    
    // Prevenir inicialização dupla
    if (window.viariosApp) {
        console.log('App de Projetos Viários já inicializado');
        return;
    }
    window.viariosApp = true;

    // Variáveis do módulo
    let currentUser = null;
    let isAdmin = false;
    let db = null;
    let chartSemanalGeral = null;
    let chartSemanalIndividual = null;
    let chartProjetista = null;

    // Inicialização com Firebase Auth
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            // Esperar o DOM carregar
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', inicializarApp);
            } else {
                inicializarApp();
            }
        } else {
            // Redirecionar para login
            window.location.href = 'index.html';
        }
    });

    // Inicializar aplicação
    async function inicializarApp() {
        db = firebase.firestore();
        
        // Exibir nome do usuário
        document.getElementById('userName').textContent = currentUser.email;
        
        // Verificar se é admin
        await verificarAdmin();
        
        // Configurar data atual
        configurarDataAtual();
        
        // Configurar formulário
        setupFormulario();
        
        // Carregar dados
        await carregarDados();
        
        // Mostrar conteúdo
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    }

    // Verificar se usuário é administrador
    async function verificarAdmin() {
        try {
            const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
            if (userDoc.exists) {
                isAdmin = userDoc.data().admin === true;
                
                if (isAdmin) {
                    // Mostrar elementos apenas para admin
                    const graficoGeral = document.getElementById('graficoGeralContainer');
                    const graficoProj = document.getElementById('graficoProjetistaContainer');
                    
                    if (graficoGeral) graficoGeral.classList.remove('admin-only');
                    if (graficoProj) graficoProj.classList.remove('admin-only');
                    
                    document.getElementById('tabelaTitulo').textContent = 'Todos os Registros de Projetos Viários';
                    
                    // Adicionar coluna de projetista na tabela
                    const headerRow = document.getElementById('tableHeader');
                    const projetistaHeader = document.createElement('th');
                    projetistaHeader.textContent = 'Projetista';
                    headerRow.insertBefore(projetistaHeader, headerRow.firstChild);
                }
            }
        } catch (error) {
            console.error('Erro ao verificar admin:', error);
        }
    }

    // Configurar data atual
    function configurarDataAtual() {
        const dataInput = document.getElementById('data');
        if (dataInput) {
            const hoje = new Date().toISOString().split('T')[0];
            dataInput.value = hoje;
        }
    }

    // Configurar o formulário
    function setupFormulario() {
        const form = document.getElementById('viariosForm');
        if (!form) return;
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const novoRegistro = {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                nomeVia: document.getElementById('nomeVia').value,
                data: document.getElementById('data').value,
                quantidadePontos: parseInt(document.getElementById('quantidadePontos').value),
                revisao: document.getElementById('revisao').checked,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                await db.collection('projetosViarios').add(novoRegistro);
                
                // Limpar formulário
                form.reset();
                configurarDataAtual();
                
                // Recarregar dados
                await carregarDados();
                
                alert('Registro adicionado com sucesso!');
            } catch (error) {
                console.error('Erro ao adicionar registro:', error);
                alert('Erro ao adicionar registro. Tente novamente.');
            }
        });
    }

    // Carregar dados do Firestore
    async function carregarDados() {
        try {
            let dados = [];
            
            if (isAdmin) {
                // Admin vê todos os registros (sem orderBy composto)
                const snapshot = await db.collection('projetosViarios').get();
                
                snapshot.forEach(doc => {
                    dados.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                // Ordenar manualmente por data (mais recente primeiro)
                dados.sort((a, b) => {
                    const dateA = new Date(a.data);
                    const dateB = new Date(b.data);
                    return dateB - dateA;
                });
            } else {
                // Usuário comum vê apenas seus registros (sem orderBy composto)
                const snapshot = await db.collection('projetosViarios')
                    .where('userId', '==', currentUser.uid)
                    .get();
                
                snapshot.forEach(doc => {
                    dados.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                // Ordenar manualmente por data (mais recente primeiro)
                dados.sort((a, b) => {
                    const dateA = new Date(a.data);
                    const dateB = new Date(b.data);
                    return dateB - dateA;
                });
            }
            
            // Atualizar interface
            atualizarTabela(dados);
            await atualizarGraficos(dados);
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            alert('Erro ao carregar dados. Verifique sua conexão.');
        }
    }

    // Atualizar tabela
    function atualizarTabela(dados) {
        const tbody = document.querySelector('#tabelaViarios tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        dados.forEach(item => {
            const tr = document.createElement('tr');
            
            let rowHTML = '';
            
            // Se admin, mostrar coluna de projetista
            if (isAdmin) {
                rowHTML += `<td>${item.userEmail || 'N/A'}</td>`;
            }
            
            rowHTML += `
                <td>${item.nomeVia}</td>
                <td>${new Date(item.data).toLocaleDateString('pt-BR')}</td>
                <td>${item.quantidadePontos}</td>
                <td>${item.revisao ? 'Sim' : 'Não'}</td>
                <td><button class="delete-btn" data-id="${item.id}">Excluir</button></td>
            `;
            
            tr.innerHTML = rowHTML;
            tbody.appendChild(tr);
        });
        
        // Adicionar eventos de exclusão
        tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                excluirRegistro(this.dataset.id);
            });
        });
    }

    // Excluir registro
    async function excluirRegistro(id) {
        if (confirm('Tem certeza que deseja excluir este registro?')) {
            try {
                await db.collection('projetosViarios').doc(id).delete();
                await carregarDados();
                alert('Registro excluído com sucesso!');
            } catch (error) {
                console.error('Erro ao excluir:', error);
                alert('Erro ao excluir registro.');
            }
        }
    }

    // Função para obter número da semana
    function getWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `Sem ${weekNo}`;
    }

    // Atualizar todos os gráficos
    async function atualizarGraficos(dados) {
        // Gráfico individual (sempre visível)
        const dadosIndividuais = dados.filter(item => item.userId === currentUser.uid);
        atualizarGraficoSemanalIndividual(dadosIndividuais);
        
        // Gráficos gerais (apenas admin)
        if (isAdmin) {
            try {
                const snapshot = await db.collection('projetosViarios').get();
                const todosDados = [];
                snapshot.forEach(doc => {
                    todosDados.push(doc.data());
                });
                
                atualizarGraficoSemanalGeral(todosDados);
                atualizarGraficoProjetista(todosDados);
            } catch (error) {
                console.error('Erro ao carregar dados para gráficos gerais:', error);
            }
        }
    }

    // Gráfico semanal individual
    function atualizarGraficoSemanalIndividual(dados) {
        const canvas = document.getElementById('chartSemanalIndividual');
        if (!canvas) return;
        
        const dadosPorSemana = {};
        
        dados.forEach(item => {
            const semana = getWeekNumber(item.data);
            if (!dadosPorSemana[semana]) {
                dadosPorSemana[semana] = 0;
            }
            dadosPorSemana[semana] += item.quantidadePontos;
        });
        
        const semanas = Object.keys(dadosPorSemana).sort();
        const valores = semanas.map(sem => dadosPorSemana[sem]);
        
        const ctx = canvas.getContext('2d');
        
        if (chartSemanalIndividual) {
            chartSemanalIndividual.destroy();
        }
        
        chartSemanalIndividual = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: semanas.length > 0 ? semanas : ['Sem dados'],
                datasets: [{
                    label: 'Meus Pontos por Semana',
                    data: valores.length > 0 ? valores : [0],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Gráfico semanal geral (apenas admin)
    function atualizarGraficoSemanalGeral(dados) {
        const canvas = document.getElementById('chartSemanalGeral');
        if (!canvas) return;
        
        const dadosPorSemana = {};
        
        dados.forEach(item => {
            const semana = getWeekNumber(item.data);
            if (!dadosPorSemana[semana]) {
                dadosPorSemana[semana] = 0;
            }
            dadosPorSemana[semana] += item.quantidadePontos;
        });
        
        const semanas = Object.keys(dadosPorSemana).sort();
        const valores = semanas.map(sem => dadosPorSemana[sem]);
        
        const ctx = canvas.getContext('2d');
        
        if (chartSemanalGeral) {
            chartSemanalGeral.destroy();
        }
        
        chartSemanalGeral = new Chart(ctx, {
            type: 'line',
            data: {
                labels: semanas.length > 0 ? semanas : ['Sem dados'],
                datasets: [{
                    label: 'Pontos Totais por Semana',
                    data: valores.length > 0 ? valores : [0],
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Gráfico por projetista (apenas admin)
    function atualizarGraficoProjetista(dados) {
        const canvas = document.getElementById('chartProjetista');
        if (!canvas) return;
        
        const dadosPorProjetista = {};
        
        dados.forEach(item => {
            const email = item.userEmail || 'Sem email';
            if (!dadosPorProjetista[email]) {
                dadosPorProjetista[email] = 0;
            }
            dadosPorProjetista[email] += item.quantidadePontos;
        });
        
        const projetistas = Object.keys(dadosPorProjetista);
        const valores = projetistas.map(proj => dadosPorProjetista[proj]);
        
        const ctx = canvas.getContext('2d');
        
        if (chartProjetista) {
            chartProjetista.destroy();
        }
        
        const cores = [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)'
        ];
        
        chartProjetista = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: projetistas.length > 0 ? projetistas : ['Sem dados'],
                datasets: [{
                    label: 'Pontos por Projetista',
                    data: valores.length > 0 ? valores : [0],
                    backgroundColor: cores.slice(0, Math.max(projetistas.length, 1)),
                    borderColor: cores.slice(0, Math.max(projetistas.length, 1)).map(c => c.replace('0.6', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Exportar para Excel - tornar global
    window.exportarParaExcel = async function() {
        try {
            let dados = [];
            
            if (isAdmin) {
                // Admin exporta todos os dados
                const snapshot = await db.collection('projetosViarios').get();
                
                snapshot.forEach(doc => {
                    dados.push(doc.data());
                });
            } else {
                // Usuário exporta apenas seus dados
                const snapshot = await db.collection('projetosViarios')
                    .where('userId', '==', currentUser.uid)
                    .get();
                
                snapshot.forEach(doc => {
                    dados.push(doc.data());
                });
            }
            
            if (dados.length === 0) {
                alert('Não há dados para exportar!');
                return;
            }
            
            // Ordenar por data
            dados.sort((a, b) => new Date(b.data) - new Date(a.data));
            
            // Preparar dados para Excel
            const dadosExcel = dados.map(item => {
                const linha = {
                    'Nome da Via': item.nomeVia,
                    'Data': new Date(item.data).toLocaleDateString('pt-BR'),
                    'Quantidade de Pontos': item.quantidadePontos,
                    'Revisão': item.revisao ? 'Sim' : 'Não'
                };
                
                // Admin vê o projetista
                if (isAdmin) {
                    return {
                        'Projetista': item.userEmail,
                        ...linha
                    };
                }
                
                return linha;
            });
            
            // Criar workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dadosExcel);
            
            // Ajustar largura das colunas
            if (isAdmin) {
                ws['!cols'] = [
                    { wch: 25 }, // Projetista
                    { wch: 30 }, // Nome da Via
                    { wch: 12 }, // Data
                    { wch: 20 }, // Quantidade de Pontos
                    { wch: 10 }  // Revisão
                ];
            } else {
                ws['!cols'] = [
                    { wch: 30 }, // Nome da Via
                    { wch: 12 }, // Data
                    { wch: 20 }, // Quantidade de Pontos
                    { wch: 10 }  // Revisão
                ];
            }
            
            XLSX.utils.book_append_sheet(wb, ws, 'Projetos Viários');
            
            // Gerar e baixar arquivo
            const hoje = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Projetos_Viarios_${hoje}.xlsx`);
            
        } catch (error) {
            console.error('Erro ao exportar:', error);
            alert('Erro ao exportar dados.');
        }
    };

})();