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
    let chartRevisoes = null;
    let editingId = null;

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
    
    // Sobrescrever a função updateDashboard do script-firebase.js
    // Isso garante que nossa lógica de exibição de admin persista
    if (typeof window.updateDashboard === 'function') {
        const originalUpdateDashboard = window.updateDashboard;
        window.updateDashboard = function() {
            // Executa a original (que pode estar vazia ou fazer coisas da outra página)
            if (originalUpdateDashboard) originalUpdateDashboard();
            
            // Re-aplica a visibilidade dos elementos de admin nesta página
            if (isAdmin) {
                mostrarElementosAdmin();
            }
        };
    }

    // Inicializar aplicação
    async function inicializarApp() {
        console.log("Inicializando App Viários...");
        db = firebase.firestore();
        
        // Exibir nome do usuário
        const userNameEl = document.getElementById('userName');
        if(userNameEl) userNameEl.textContent = currentUser.email;
        
        // Verificar se é admin e carregar dados
        await verificarAdmin();
        
        // Configurar data atual
        configurarDataAtual();
        
        // Configurar formulário
        setupFormulario();
        
        // Carregar dados (agora sabemos se é admin ou não)
        await carregarDados();
        
        // Mostrar conteúdo
        const loadingScreen = document.getElementById('loadingScreen');
        const mainContent = document.getElementById('mainContent');
        if(loadingScreen) loadingScreen.style.display = 'none';
        if(mainContent) mainContent.style.display = 'block';
    }

    // Função auxiliar para mostrar elementos de admin
    function mostrarElementosAdmin() {
        const idsAdmin = [
            'graficoGeralContainer', 'graficoProjetistaContainer', 
            'graficoRevisoesContainer', 'teamChartContainer', 
            'monthlyChartContainer', 'projectTypeChartContainer', 
            'finishedProjectsChartCard'
        ];
        
        idsAdmin.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('admin-only');
                el.style.display = 'block'; // Forçar display block caso CSS esteja escondendo
            }
        });
        
        const tabelaTitulo = document.getElementById('tabelaTitulo');
        if(tabelaTitulo) tabelaTitulo.textContent = 'Todos os Registros de Projetos Viários';
        
        // Adicionar coluna de projetista na tabela se ainda não existir
        const headerRow = document.getElementById('tableHeader');
        if (headerRow && !headerRow.querySelector('.th-projetista')) {
            const projetistaHeader = document.createElement('th');
            projetistaHeader.textContent = 'Projetista';
            projetistaHeader.className = 'th-projetista';
            headerRow.insertBefore(projetistaHeader, headerRow.firstChild);
        }
    }

    // Verificar se usuário é administrador
    async function verificarAdmin() {
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get(); // ATENÇÃO: Coleção 'users' conforme script-firebase.js
            if (userDoc.exists) {
                const userData = userDoc.data();
                isAdmin = userData.role === 'admin'; // Verifica o campo 'role'
                console.log("É Admin?", isAdmin);
                
                if (isAdmin) {
                    mostrarElementosAdmin();
                }
            } else {
                console.log("Documento de usuário não encontrado, assumindo não-admin.");
                isAdmin = false;
            }
        } catch (error) {
            console.error('Erro ao verificar admin:', error);
            isAdmin = false;
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

    // Carregar dados do Firestore
    async function carregarDados() {
        console.log("Carregando dados. Admin:", isAdmin);
        try {
            let dados = [];
            let snapshot;
            
            if (isAdmin) {
                // Admin vê TUDO
                snapshot = await db.collection('projetosViarios').get();
            } else {
                // Usuário vê SÓ O SEU
                snapshot = await db.collection('projetosViarios')
                    .where('userId', '==', currentUser.uid)
                    .get();
            }
            
            if (snapshot.empty) {
                console.log("Nenhum documento encontrado.");
            }

            snapshot.forEach(doc => {
                dados.push({ id: doc.id, ...doc.data() });
            });
            
            console.log(`Carregados ${dados.length} registros.`);

            // Ordenar por data (mais recente primeiro)
            dados.sort((a, b) => new Date(b.data) - new Date(a.data));
            
            atualizarTabela(dados);
            await atualizarGraficos(dados);
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            alert('Erro ao carregar dados. Verifique o console para mais detalhes.');
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
            
            if (isAdmin) {
                rowHTML += `<td>${item.userEmail || 'N/A'}</td>`;
            }
            
            rowHTML += `
                <td>${item.nomeVia}</td>
                <td>${new Date(item.data).toLocaleDateString('pt-BR')}</td>
                <td>${item.quantidadePontos}</td>
                <td>${item.revisao ? 'Sim' : 'Não'}</td>
                <td>
                    <button class="btn btn-edit" style="margin-right: 5px; padding: 5px 10px; font-size: 12px;" onclick="abrirModalEdicao('${item.id}')">Editar</button>
                    <button class="delete-btn" onclick="excluirRegistro('${item.id}')">Excluir</button>
                </td>
            `;
            
            tr.innerHTML = rowHTML;
            tbody.appendChild(tr);
        });
    }

    // Excluir registro - Tornar global para o onclick
    window.excluirRegistro = async function(id) {
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
    };

    // Função para obter número da semana
    function getWeekNumber(date) {
        if(!date) return 'Data Inválida';
        const d = new Date(date);
        // Ajuste para garantir que a data é interpretada corretamente (evita problemas de timezone)
        const userTimezoneOffset = d.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(d.getTime() + userTimezoneOffset);
        
        adjustedDate.setHours(0, 0, 0, 0);
        adjustedDate.setDate(adjustedDate.getDate() + 4 - (adjustedDate.getDay() || 7));
        const yearStart = new Date(adjustedDate.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((adjustedDate - yearStart) / 86400000) + 1) / 7);
        return `Sem ${weekNo}`;
    }

    // Gerar cor baseada numa string
    function stringToColor(str) {
        if (!str) return '#CCCCCC'; // Cor padrão cinza se str for undefined/null
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }

    // Atualizar todos os gráficos
    async function atualizarGraficos(dados) {
        // Gráfico individual (sempre visível)
        const dadosIndividuais = dados.filter(item => item.userId === currentUser.uid);
        atualizarGraficoSemanalIndividual(dadosIndividuais);
        
        // Gráficos gerais (apenas admin)
        if (isAdmin) {
            console.log("Atualizando gráficos de Admin...");
            atualizarGraficoSemanalGeral(dados);
            atualizarGraficoProjetista(dados);
            atualizarGraficoRevisoes(dados);
        }
    }

    // Gráfico semanal individual
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
                scales: { y: { beginAtZero: true } },
                plugins: {
                    datalabels: { // Configuração segura caso o plugin exista
                        display: true,
                        color: 'black',
                        anchor: 'end',
                        align: 'top',
                        formatter: Math.round
                    }
                }
            }
        });
    }

    // Gráfico semanal geral (apenas admin) - ATUALIZADO PARA BARRAS EMPILHADAS POR USUÁRIO
    function atualizarGraficoSemanalGeral(dados) {
        const canvas = document.getElementById('chartSemanalGeral');
        if (!canvas) {
            console.warn("Canvas chartSemanalGeral não encontrado!");
            return;
        }
        
        // 1. Organizar dados: Semana -> Usuário -> Pontos
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

        console.log("Semanas:", semanasOrdenadas);
        console.log("Usuários:", listaUsuarios);

        // 2. Criar datasets (um por usuário)
        const datasets = listaUsuarios.map(usuario => {
            const pontosPorSemana = semanasOrdenadas.map(semana => {
                return dadosAgrupados[semana]?.[usuario] || 0;
            });

            return {
                label: usuario,
                data: pontosPorSemana,
                backgroundColor: stringToColor(usuario), // Cor única por usuário
                stack: 'Semana' // Agrupa na mesma barra
            };
        });
        
        const ctx = canvas.getContext('2d');
        
        if (chartSemanalGeral) {
            chartSemanalGeral.destroy();
        }
        
        chartSemanalGeral = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: semanasOrdenadas.length > 0 ? semanasOrdenadas : ['Sem dados'],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Produção Semanal Geral (Pontos por Usuário)'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        position: 'bottom'
                    },
                    datalabels: { // Exibir valores dentro das barras
                        color: '#fff',
                        font: { weight: 'bold' },
                        formatter: (value) => value > 0 ? value : '', // Só mostra se > 0
                        display: true
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true
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
            dadosPorProjetista[email] = (dadosPorProjetista[email] || 0) + item.quantidadePontos;
        });
        
        const projetistas = Object.keys(dadosPorProjetista);
        const valores = projetistas.map(proj => dadosPorProjetista[proj]);
        
        const ctx = canvas.getContext('2d');
        
        if (chartProjetista) {
            chartProjetista.destroy();
        }
        
        // Cores variadas
        const bgColors = projetistas.map(p => stringToColor(p));
        
        chartProjetista = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: projetistas.length > 0 ? projetistas : ['Sem dados'],
                datasets: [{
                    label: 'Pontos Totais',
                    data: valores.length > 0 ? valores : [0],
                    backgroundColor: bgColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: { y: { beginAtZero: true } },
                plugins: {
                    datalabels: {
                        color: 'black',
                        anchor: 'end',
                        align: 'top',
                        formatter: Math.round
                    }
                }
            }
        });
    }

    // Gráfico de Revisões (apenas admin) - PERCENTUAL
    function atualizarGraficoRevisoes(dados) {
        const canvas = document.getElementById('chartRevisoes');
        if (!canvas) return;
        
        let totalRevisoes = 0;
        let totalNovos = 0;
        
        dados.forEach(item => {
            if (item.revisao) {
                totalRevisoes++;
            } else {
                totalNovos++;
            }
        });
        
        const total = totalRevisoes + totalNovos;
        const percentRevisoes = total > 0 ? ((totalRevisoes / total) * 100).toFixed(1) : 0;
        const percentNovos = total > 0 ? ((totalNovos / total) * 100).toFixed(1) : 0;
        
        const ctx = canvas.getContext('2d');
        
        if (chartRevisoes) {
            chartRevisoes.destroy();
        }
        
        chartRevisoes = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [
                    `Revisões (${percentRevisoes}%)`,
                    `Projetos Novos (${percentNovos}%)`
                ],
                datasets: [{
                    data: [totalRevisoes, totalNovos],
                    backgroundColor: [
                        'rgba(255, 159, 64, 0.8)', // Cor Revisão (Laranja)
                        'rgba(75, 192, 192, 0.8)'  // Cor Novo (Verde Água)
                    ],
                    borderColor: [
                        'rgba(255, 159, 64, 1)',
                        'rgba(75, 192, 192, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Percentual de Revisões vs Novos'
                    },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold' },
                        formatter: (value, ctx) => {
                            let sum = 0;
                            let dataArr = ctx.chart.data.datasets[0].data;
                            dataArr.map(data => {
                                sum += data;
                            });
                            let percentage = (value * 100 / sum).toFixed(1) + "%";
                            return percentage;
                        }
                    }
                }
            }
        });
    }

    // Funções de Edição - tornar globais
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
            console.error('Erro ao carregar dados para edição:', error);
            alert('Erro ao carregar dados.');
        }
    };
    
    window.fecharModalEdicao = function() {
        document.getElementById('editModal').style.display = 'none';
        editingId = null;
    };
    
    // Configurar formulário de edição
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
                    fecharModalEdicao();
                    await carregarDados();
                    alert('Registro atualizado com sucesso!');
                } catch (error) {
                    console.error('Erro ao atualizar registro:', error);
                    alert('Erro ao atualizar registro. Tente novamente.');
                }
            });
        }
    });

    // Exportar para Excel - tornar global e RESTRITO A ADMIN
    window.exportarParaExcel = async function() {
        // Verificação de segurança: Somente Admin
        if (!isAdmin) {
            alert('Acesso negado: Apenas administradores podem baixar o relatório compilado.');
            return;
        }

        try {
            // Admin exporta sempre todos os dados
            const snapshot = await db.collection('projetosViarios').get();
            let dados = [];
            
            snapshot.forEach(doc => {
                dados.push(doc.data());
            });
            
            if (dados.length === 0) {
                alert('Não há dados para exportar!');
                return;
            }
            
            // Ordenar por data
            dados.sort((a, b) => new Date(b.data) - new Date(a.data));
            
            // Preparar dados para Excel (incluindo nome/email do projetista)
            const dadosExcel = dados.map(item => {
                return {
                    'Projetista': item.userEmail || 'Desconhecido',
                    'Nome da Via': item.nomeVia,
                    'Data': new Date(item.data).toLocaleDateString('pt-BR'),
                    'Quantidade de Pontos': item.quantidadePontos,
                    'Revisão': item.revisao ? 'Sim' : 'Não'
                };
            });
            
            // Criar workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dadosExcel);
            
            // Ajustar largura das colunas
            ws['!cols'] = [
                { wch: 30 }, // Projetista
                { wch: 30 }, // Nome da Via
                { wch: 12 }, // Data
                { wch: 20 }, // Quantidade de Pontos
                { wch: 10 }  // Revisão
            ];
            
            XLSX.utils.book_append_sheet(wb, ws, 'Relatório Geral Viários');
            
            // Gerar e baixar arquivo
            const hoje = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Relatorio_Geral_Viarios_${hoje}.xlsx`);
            
        } catch (error) {
            console.error('Erro ao exportar:', error);
            alert('Erro ao exportar dados.');
        }
    };

})();