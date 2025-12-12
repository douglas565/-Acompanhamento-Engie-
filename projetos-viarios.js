// Encapsular tudo em uma IIFE para evitar conflitos globais
(function() {
    'use strict';
    
    // Prevenir inicialização dupla
    if (window.viariosApp) {
        return;
    }
    window.viariosApp = true;

    // Variáveis do módulo
    let currentUser = null;
    let isAdmin = false;
    let db = null;
    
    // Armazenar instâncias dos gráficos para destruir corretamente e evitar bugs visuais
    const chartInstances = {
        semanalGeral: null,
        semanalIndividual: null,
        projetista: null,
        revisoes: null,
        finishedProjects: null
    };
    
    let editingId = null;

    // Inicialização com Firebase Auth
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', inicializarApp);
            } else {
                inicializarApp();
            }
        } else {
            window.location.href = 'index.html';
        }
    });
    
    // Sobrescrever a função updateDashboard do script-firebase.js com segurança
    if (typeof window.updateDashboard === 'function') {
        const originalUpdateDashboard = window.updateDashboard;
        window.updateDashboard = function() {
            // Executa a original apenas se estivermos na dashboard principal para evitar erros
            if (document.getElementById('mainScreen')) {
                originalUpdateDashboard();
            }
            
            // Garante que os elementos de admin sejam mostrados nesta página
            if (isAdmin) {
                mostrarElementosAdmin();
            }
        };
    }

    // Inicializar aplicação
    async function inicializarApp() {
        console.log("Inicializando App Viários...");
        db = firebase.firestore();
        
        const userNameEl = document.getElementById('userName');
        if(userNameEl) userNameEl.textContent = currentUser.email;
        
        await verificarAdmin();
        configurarDataAtual();
        setupFormulario();
        await carregarDados();
        
        const loadingScreen = document.getElementById('loadingScreen');
        const mainContent = document.getElementById('mainContent');
        if(loadingScreen) loadingScreen.style.display = 'none';
        if(mainContent) mainContent.style.display = 'block';
    }

    // Função auxiliar para mostrar elementos de admin
// Função auxiliar para mostrar elementos de admin
    function mostrarElementosAdmin() {
        // Lista APENAS com os gráficos que queres manter
        const idsAdmin = [
            'graficoGeralContainer', 
            'graficoProjetistaContainer', 
            'graficoRevisoesContainer'
        ];
        
        // Remove a classe admin-only e garante display flex
        idsAdmin.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('admin-only');
                el.style.display = 'flex'; 
                el.style.flexDirection = 'column';
            }
        });

        // ESCONDER explicitamente o gráfico individual do próprio admin, se desejado
        // (Opcional: se o admin quiser ver a sua própria produção, remova estas linhas)
        /*
        const chartIndividual = document.getElementById('chartSemanalIndividual');
        if (chartIndividual) {
             const container = chartIndividual.closest('.chart-container');
             if(container) container.style.display = 'none';
        }
        */
        
        const tabelaTitulo = document.getElementById('tabelaTitulo');
        if(tabelaTitulo) tabelaTitulo.textContent = 'Todos os Registros de Projetos Viários';
        
        const headerRow = document.getElementById('tableHeader');
        if (headerRow && !headerRow.querySelector('.th-projetista')) {
            const projetistaHeader = document.createElement('th');
            projetistaHeader.textContent = 'Projetista';
            projetistaHeader.className = 'th-projetista';
            headerRow.insertBefore(projetistaHeader, headerRow.firstChild);
        }
    }

    async function verificarAdmin() {
        try {
            // Verifica na coleção 'users' se o role é admin
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                isAdmin = userData.role === 'admin';
                
                if (isAdmin) {
                    mostrarElementosAdmin();
                }
            }
        } catch (error) {
            console.error('Erro ao verificar admin:', error);
            isAdmin = false;
        }
    }

    function configurarDataAtual() {
        const dataInput = document.getElementById('data');
        if (dataInput) {
            const hoje = new Date().toISOString().split('T')[0];
            dataInput.value = hoje;
        }
    }

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
                form.reset();
                configurarDataAtual();
                await carregarDados();
                alert('Registro adicionado com sucesso!');
            } catch (error) {
                console.error('Erro ao adicionar registro:', error);
                alert('Erro ao adicionar registro. Tente novamente.');
            }
        });
    }

    async function carregarDados() {
        try {
            let dados = [];
            let snapshot;
            
            if (isAdmin) {
                // Admin carrega TODOS os dados
                snapshot = await db.collection('projetosViarios').get();
            } else {
                // Usuário carrega APENAS os seus
                snapshot = await db.collection('projetosViarios')
                    .where('userId', '==', currentUser.uid)
                    .get();
            }
            
            snapshot.forEach(doc => {
                dados.push({ id: doc.id, ...doc.data() });
            });
            
            // Ordenar por data (mais recente primeiro)
            dados.sort((a, b) => new Date(b.data) - new Date(a.data));
            
            atualizarTabela(dados);
            await atualizarGraficos(dados);
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    function atualizarTabela(dados) {
        const tbody = document.querySelector('#tabelaViarios tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        dados.forEach(item => {
            const tr = document.createElement('tr');
            let rowHTML = '';
            
            if (isAdmin) {
                rowHTML += `<td>${item.userEmail || 'N/A'}</td>`;
            }
            
            // Formatar data evitando problemas de fuso horário
            let dataFormatada = item.data;
            if (item.data && item.data.includes('-')) {
                const parts = item.data.split('-');
                if (parts.length === 3) {
                    dataFormatada = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
            }
            
            rowHTML += `
                <td>${item.nomeVia}</td>
                <td>${dataFormatada}</td>
                <td>${item.quantidadePontos}</td>
                <td>${item.revisao ? 'Sim' : 'Não'}</td>
                <td>
                    <button class="btn btn-edit" style="margin-right: 5px; padding: 5px 10px; font-size: 12px;" onclick="window.abrirModalEdicao('${item.id}')">Editar</button>
                    <button class="delete-btn" onclick="window.excluirRegistro('${item.id}')">Excluir</button>
                </td>
            `;
            
            tr.innerHTML = rowHTML;
            tbody.appendChild(tr);
        });
    }

    // Tornar função global para o onclick do HTML
    window.excluirRegistro = async function(id) {
        if (confirm('Tem certeza que deseja excluir este registro?')) {
            try {
                await db.collection('projetosViarios').doc(id).delete();
                await carregarDados();
            } catch (error) {
                console.error('Erro ao excluir:', error);
                alert('Erro ao excluir registro.');
            }
        }
    };

    function getWeekNumber(date) {
        if(!date) return 'Semana N/A';
        const d = new Date(date);
        // Ajuste de timezone
        const userTimezoneOffset = d.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(d.getTime() + userTimezoneOffset);
        
        adjustedDate.setHours(0, 0, 0, 0);
        adjustedDate.setDate(adjustedDate.getDate() + 4 - (adjustedDate.getDay() || 7));
        const yearStart = new Date(adjustedDate.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((adjustedDate - yearStart) / 86400000) + 1) / 7);
        return `Sem ${weekNo}`;
    }

    function stringToColor(str) {
        if (!str) return '#CCCCCC';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }

    // Função de segurança para carregar plugins apenas se existirem
    function getPlugins() {
        const plugins = [];
        if (typeof ChartDataLabels !== 'undefined') {
            plugins.push(ChartDataLabels);
        }
        return plugins;
    }

    async function atualizarGraficos(dados) {
        if (typeof Chart === 'undefined') return;

        // Gráfico individual (sempre visível para o utilizador, opcional para admin)
        // Se quiser esconder do admin, envolva num `if (!isAdmin)`
        const dadosIndividuais = dados.filter(item => item.userId === currentUser.uid);
        atualizarGraficoSemanalIndividual(dadosIndividuais);
        
        // Gráficos gerais (apenas admin)
        if (isAdmin) {
            atualizarGraficoSemanalGeral(dados);
            atualizarGraficoProjetista(dados);
            atualizarGraficoRevisoes(dados);
            
            // REMOVIDO: Chamadas para gráficos de praças que não existem mais aqui
        }
    }
    // 1. Gráfico Semanal Individual
    function atualizarGraficoSemanalIndividual(dados) {
        const canvas = document.getElementById('chartSemanalIndividual');
        if (!canvas) return;
        
        const dadosPorSemana = {};
        
        dados.forEach(item => {
            const semana = getWeekNumber(item.data);
            dadosPorSemana[semana] = (dadosPorSemana[semana] || 0) + item.quantidadePontos;
        });
        
        const semanas = Object.keys(dadosPorSemana).sort();
        const valores = semanas.map(sem => dadosPorSemana[sem]);
        
        // Destruir gráfico anterior para evitar sobreposição/memória
        if (chartInstances.semanalIndividual) {
            chartInstances.semanalIndividual.destroy();
        }
        
        chartInstances.semanalIndividual = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: semanas.length > 0 ? semanas : ['Sem dados'],
                datasets: [{
                    label: 'Meus Pontos',
                    data: valores.length > 0 ? valores : [0],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Importante para não crescer infinitamente
                scales: { y: { beginAtZero: true } },
                plugins: {
                    datalabels: {
                        display: true,
                        color: 'black',
                        anchor: 'end',
                        align: 'top'
                    }
                }
            },
            plugins: getPlugins()
        });
    }

    // 2. Gráfico Geral Semanal (Barras Empilhadas por Usuário) - Admin
    function atualizarGraficoSemanalGeral(dados) {
        const canvas = document.getElementById('chartSemanalGeral');
        if (!canvas) return;
        
        const dadosAgrupados = {};
        const todasSemanas = new Set();
        const todosUsuarios = new Set();

        dados.forEach(item => {
            const semana = getWeekNumber(item.data);
            const usuario = item.userEmail || 'Desconhecido';
            todasSemanas.add(semana);
            todosUsuarios.add(usuario);

            if (!dadosAgrupados[semana]) dadosAgrupados[semana] = {};
            if (!dadosAgrupados[semana][usuario]) dadosAgrupados[semana][usuario] = 0;
            dadosAgrupados[semana][usuario] += item.quantidadePontos;
        });

        const semanasOrdenadas = Array.from(todasSemanas).sort();
        const listaUsuarios = Array.from(todosUsuarios);

        const datasets = listaUsuarios.map(usuario => {
            const pontosPorSemana = semanasOrdenadas.map(semana => {
                return dadosAgrupados[semana]?.[usuario] || 0;
            });

            return {
                label: usuario,
                data: pontosPorSemana,
                backgroundColor: stringToColor(usuario),
                stack: 'Semana'
            };
        });
        
        if (chartInstances.semanalGeral) {
            chartInstances.semanalGeral.destroy();
        }
        
        chartInstances.semanalGeral = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: semanasOrdenadas.length > 0 ? semanasOrdenadas : ['Sem dados'],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Produção Semanal (Por Usuário)' },
                    tooltip: { mode: 'index', intersect: false },
                    legend: { position: 'bottom' },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold' },
                        formatter: (value) => value > 0 ? value : '',
                        display: true
                    }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            },
            plugins: getPlugins()
        });
    }

    // 3. Gráfico por Projetista (Admin)
    function atualizarGraficoProjetista(dados) {
        const canvas = document.getElementById('chartProjetista');
        if (!canvas) return;
        
        const dadosPorProjetista = {};
        dados.forEach(item => {
            const email = item.userEmail || 'Sem email';
            dadosPorProjetista[email] = (dadosPorProjetista[email] || 0) + item.quantidadePontos;
        });
        
        const projetistas = Object.keys(dadosPorProjetista);
        const valores = projetistas.map(proj => dadosPorProjetista[proj]);
        
        if (chartInstances.projetista) {
            chartInstances.projetista.destroy();
        }
        
        chartInstances.projetista = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: projetistas.length > 0 ? projetistas : ['Sem dados'],
                datasets: [{
                    label: 'Pontos Totais',
                    data: valores.length > 0 ? valores : [0],
                    backgroundColor: projetistas.map(p => stringToColor(p)),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: 'black',
                        anchor: 'end',
                        align: 'top',
                        formatter: Math.round
                    }
                }
            },
            plugins: getPlugins()
        });
    }

    // 4. Gráfico de Revisões (Percentual) - Admin
    function atualizarGraficoRevisoes(dados) {
        const canvas = document.getElementById('chartRevisoes');
        if (!canvas) return;
        
        let totalRevisoes = 0;
        let totalNovos = 0;
        
        dados.forEach(item => {
            if (item.revisao) totalRevisoes++;
            else totalNovos++;
        });
        
        const total = totalRevisoes + totalNovos;
        const percentRevisoes = total > 0 ? ((totalRevisoes / total) * 100).toFixed(1) : 0;
        const percentNovos = total > 0 ? ((totalNovos / total) * 100).toFixed(1) : 0;
        
        if (chartInstances.revisoes) {
            chartInstances.revisoes.destroy();
        }
        
        chartInstances.revisoes = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: [
                    `Revisões (${percentRevisoes}%)`,
                    `Projetos Novos (${percentNovos}%)`
                ],
                datasets: [{
                    data: [totalRevisoes, totalNovos],
                    backgroundColor: ['#FF9F40', '#4BC0C0'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Percentual de Revisões vs Novos' },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold' },
                        formatter: (value, ctx) => {
                            let sum = 0;
                            let dataArr = ctx.chart.data.datasets[0].data;
                            dataArr.map(data => { sum += data; });
                            if (sum === 0) return "0%";
                            return (value * 100 / sum).toFixed(1) + "%";
                        }
                    }
                }
            },
            plugins: getPlugins()
        });
    }

    // Funções de Edição
    window.abrirModalEdicao = async function(id) {
        editingId = id;
        try {
            const doc = await db.collection('projetosViarios').doc(id).get();
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('editNomeVia').value = data.nomeVia;
                document.getElementById('editData').value = data.data;
                document.getElementById('editQuantidadePontos').value = data.quantidadePontos;
                document.getElementById('editRevisao').checked = data.revisao;
                document.getElementById('editModal').style.display = 'flex';
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    };
    
    window.fecharModalEdicao = function() {
        document.getElementById('editModal').style.display = 'none';
        editingId = null;
    };
    
    document.addEventListener('DOMContentLoaded', function() {
        const editForm = document.getElementById('editForm');
        if (editForm) {
            editForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                if (!editingId) return;
                
                const dadosAtualizados = {
                    nomeVia: document.getElementById('editNomeVia').value,
                    data: document.getElementById('editData').value,
                    quantidadePontos: parseInt(document.getElementById('editQuantidadePontos').value),
                    revisao: document.getElementById('editRevisao').checked
                };
                
                try {
                    await db.collection('projetosViarios').doc(editingId).update(dadosAtualizados);
                    window.fecharModalEdicao();
                    await carregarDados();
                    alert('Registro atualizado com sucesso!');
                } catch (error) {
                    console.error('Erro ao atualizar:', error);
                }
            });
        }
    });

    // Exportar Excel (Apenas Admin)
    window.exportarParaExcel = async function() {
        if (!isAdmin) {
            alert('Acesso negado: Apenas administradores podem baixar o relatório.');
            return;
        }

        try {
            const snapshot = await db.collection('projetosViarios').get();
            let dados = [];
            
            snapshot.forEach(doc => dados.push(doc.data()));
            
            if (dados.length === 0) {
                alert('Não há dados para exportar!');
                return;
            }
            
            dados.sort((a, b) => new Date(b.data) - new Date(a.data));
            
            const dadosExcel = dados.map(item => ({
                'Projetista': item.userEmail || 'Desconhecido',
                'Nome da Via': item.nomeVia,
                'Data': new Date(item.data).toLocaleDateString('pt-BR'),
                'Quantidade de Pontos': item.quantidadePontos,
                'Revisão': item.revisao ? 'Sim' : 'Não'
            }));
            
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dadosExcel);
            
            ws['!cols'] = [
                { wch: 30 }, 
                { wch: 30 }, 
                { wch: 15 }, 
                { wch: 10 }, 
                { wch: 10 }
            ];
            
            XLSX.utils.book_append_sheet(wb, ws, 'Relatório Geral Viários');
            const hoje = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Relatorio_Geral_Viarios_${hoje}.xlsx`);
            
        } catch (error) {
            console.error('Erro ao exportar:', error);
            alert('Erro ao exportar dados.');
        }
    };

})();