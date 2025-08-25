// 🔥 Sistema de Gerenciamento de Projetos com Finalização Automática
// Arquivo: projeto-manager.js

// Função para verificar se um projeto pode ser finalizado
function podeFinalizarProjeto(projeto) {
    // Categorias obrigatórias para finalizar o projeto
    const categoriasObrigatorias = ['luminotecnico', 'eletrico', 'planilhao'];
    
    // Verifica se todas as categorias obrigatórias estão concluídas
    const todasObrigatoriasConcluidas = categoriasObrigatorias.every(categoria => {
        return projeto[categoria] && projeto[categoria].concluido === true;
    });
    
    return todasObrigatoriasConcluidas;
}

// Função para finalizar projeto com validação
function finalizarProjeto(projetoId, dadosProjeto) {
    if (!podeFinalizarProjeto(dadosProjeto)) {
        const categoriasIncompletas = [];
        
        // Verifica quais categorias obrigatórias estão incompletas
        if (!dadosProjeto.luminotecnico || !dadosProjeto.luminotecnico.concluido) {
            categoriasIncompletas.push('Luminotécnico');
        }
        if (!dadosProjeto.eletrico || !dadosProjeto.eletrico.concluido) {
            categoriasIncompletas.push('Elétrico');
        }
        if (!dadosProjeto.planilhao || !dadosProjeto.planilhao.concluido) {
            categoriasIncompletas.push('Planilhão');
        }
        
        throw new Error(`Não é possível finalizar o projeto. Categorias obrigatórias incompletas: ${categoriasIncompletas.join(', ')}`);
    }
    
    // Atualiza o status do projeto para finalizado
    dadosProjeto.status = 'finalizado';
    dadosProjeto.dataFinalizacao = new Date().toISOString();
    
    return dadosProjeto;
}

// Função para calcular o progresso do projeto
function calcularProgressoProjeto(projeto) {
    const categoriasObrigatorias = ['luminotecnico', 'eletrico', 'planilhao'];
    const categoriaOpcional = 'croqui';
    
    let categoriasConcluidasObrigatorias = 0;
    let categoriaOpcionalConcluida = false;
    
    // Conta categorias obrigatórias concluídas
    categoriasObrigatorias.forEach(categoria => {
        if (projeto[categoria] && projeto[categoria].concluido) {
            categoriasConcluidasObrigatorias++;
        }
    });
    
    // Verifica categoria opcional
    if (projeto[categoriaOpcional] && projeto[categoriaOpcional].concluido) {
        categoriaOpcionalConcluida = true;
    }
    
    // Cálculo do progresso baseado nas obrigatórias (75%) + opcional (25%)
    const progressoObrigatorias = (categoriasConcluidasObrigatorias / categoriasObrigatorias.length) * 75;
    const progressoOpcional = categoriaOpcionalConcluida ? 25 : 0;
    
    return {
        progressoTotal: progressoObrigatorias + progressoOpcional,
        categoriasObrigatoriasConcluidas: categoriasConcluidasObrigatorias,
        totalCategoriasObrigatorias: categoriasObrigatorias.length,
        categoriaOpcionalConcluida: categoriaOpcionalConcluida,
        podeSerFinalizado: categoriasConcluidasObrigatorias === categoriasObrigatorias.length
    };
}

// Função para atualizar categoria do projeto
function atualizarCategoriaProjeto(projetoId, categoria, dados, projetoCompleto) {
    // Validação das categorias permitidas
    const categoriasPermitidas = ['luminotecnico', 'eletrico', 'planilhao', 'croqui'];
    
    if (!categoriasPermitidas.includes(categoria)) {
        throw new Error(`Categoria '${categoria}' não é válida. Categorias permitidas: ${categoriasPermitidas.join(', ')}`);
    }
    
    // Atualiza os dados da categoria
    const atualizacao = {
        [`${categoria}.concluido`]: dados.concluido || false,
        [`${categoria}.observacoes`]: dados.observacoes || '',
        [`${categoria}.dataAtualizacao`]: new Date().toISOString(),
        [`${categoria}.usuario`]: dados.usuario || 'sistema'
    };
    
    // Verifica se deve finalizar automaticamente o projeto
    if (dados.concluido && projetoCompleto) {
        // Simula o projeto atualizado com a nova categoria
        const projetoSimulado = {
            ...projetoCompleto,
            [categoria]: {
                ...projetoCompleto[categoria],
                concluido: true
            }
        };
        
        // Se todas as categorias obrigatórias estão concluídas, finaliza automaticamente
        if (podeFinalizarProjeto(projetoSimulado)) {
            atualizacao.status = 'finalizado';
            atualizacao.dataFinalizacao = new Date().toISOString();
            console.log(`✅ Projeto ${projetoId} finalizado automaticamente após conclusão da categoria ${categoria}`);
        }
    }
    
    return atualizacao;
}

// Função para gerar relatório de status dos projetos
function gerarRelatorioStatusProjetos(projetos) {
    const relatorio = {
        totalProjetos: projetos.length,
        projetosFinalizados: 0,
        projetosEmAndamento: 0,
        projetosProntosFinalizar: 0,
        categoriasPendentes: {
            luminotecnico: 0,
            eletrico: 0,
            planilhao: 0,
            croqui: 0
        }
    };
    
    projetos.forEach(projeto => {
        const progresso = calcularProgressoProjeto(projeto);
        
        if (projeto.status === 'finalizado') {
            relatorio.projetosFinalizados++;
        } else if (progresso.podeSerFinalizado) {
            relatorio.projetosProntosFinalizar++;
        } else {
            relatorio.projetosEmAndamento++;
            
            // Conta categorias pendentes
            ['luminotecnico', 'eletrico', 'planilhao', 'croqui'].forEach(categoria => {
                if (!projeto[categoria] || !projeto[categoria].concluido) {
                    relatorio.categoriasPendentes[categoria]++;
                }
            });
        }
    });
    
    return relatorio;
}

// Integração com Firebase (exemplo)
class GerenciadorProjetoFirebase {
    constructor(db) {
        this.db = db; // Instância do Firestore
    }
    
    async finalizarProjetoNoFirebase(projetoId) {
        try {
            // Busca o projeto atual
            const projetoRef = this.db.collection('projetos').doc(projetoId);
            const projetoDoc = await projetoRef.get();
            
            if (!projetoDoc.exists) {
                throw new Error('Projeto não encontrado');
            }
            
            const dadosProjeto = projetoDoc.data();
            
            // Aplica a validação de finalização
            const projetoAtualizado = finalizarProjeto(projetoId, dadosProjeto);
            
            // Atualiza no Firebase
            await projetoRef.update(projetoAtualizado);
            
            console.log(`Projeto ${projetoId} finalizado com sucesso!`);
            return projetoAtualizado;
            
        } catch (error) {
            console.error('Erro ao finalizar projeto:', error.message);
            throw error;
        }
    }
    
    async atualizarCategoria(projetoId, categoria, dados) {
        try {
            // Busca o projeto atual primeiro
            const projetoRef = this.db.collection('projetos').doc(projetoId);
            const projetoDoc = await projetoRef.get();
            
            if (!projetoDoc.exists) {
                throw new Error('Projeto não encontrado');
            }
            
            const dadosProjeto = projetoDoc.data();
            
            // Atualiza a categoria (com verificação automática de finalização)
            const atualizacao = atualizarCategoriaProjeto(projetoId, categoria, dados, dadosProjeto);
            
            await projetoRef.update(atualizacao);
            
            // Verifica se o projeto foi finalizado automaticamente
            if (atualizacao.status === 'finalizado') {
                console.log(`🎉 Projeto ${projetoId} foi AUTOMATICAMENTE finalizado!`);
                console.log(`📋 Todas as categorias obrigatórias foram concluídas:`);
                console.log(`   ✅ Luminotécnico`);
                console.log(`   ✅ Elétrico`);
                console.log(`   ✅ Planilhão`);
                
                // Aqui você pode adicionar notificações, webhooks, etc.
                // await this.enviarNotificacaoFinalizacao(projetoId);
            } else {
                console.log(`Categoria ${categoria} atualizada para projeto ${projetoId}`);
            }
            
            return atualizacao;
            
        } catch (error) {
            console.error('Erro ao atualizar categoria:', error.message);
            throw error;
        }
    }
    
    async obterProgressoProjeto(projetoId) {
        try {
            const projetoRef = this.db.collection('projetos').doc(projetoId);
            const projetoDoc = await projetoRef.get();
            
            if (!projetoDoc.exists) {
                throw new Error('Projeto não encontrado');
            }
            
            const dadosProjeto = projetoDoc.data();
            return calcularProgressoProjeto(dadosProjeto);
            
        } catch (error) {
            console.error('Erro ao obter progresso do projeto:', error.message);
            throw error;
        }
    }
}

// Exemplo de uso
/*
// Inicialização
const gerenciador = new GerenciadorProjetoFirebase(db);

// EXEMPLO 1: Projeto é finalizado automaticamente
console.log("=== EXEMPLO DE FINALIZAÇÃO AUTOMÁTICA ===");

// Supondo que luminotécnico e elétrico já estão concluídos
// Ao marcar planilhão como concluído, o projeto será finalizado automaticamente
await gerenciador.atualizarCategoria('projeto123', 'planilhao', {
    concluido: true,
    observacoes: 'Planilha de custos finalizada - projeto completo!',
    usuario: 'usuario@exemplo.com'
});
// 🎉 Projeto será automaticamente marcado como finalizado!

// EXEMPLO 2: Verificar progresso
const progresso = await gerenciador.obterProgressoProjeto('projeto123');
console.log('Progresso:', progresso);

// EXEMPLO 3: Atualizar categoria opcional (não afeta finalização)
await gerenciador.atualizarCategoria('projeto123', 'croqui', {
    concluido: true,
    observacoes: 'Croqui adicionado posteriormente',
    usuario: 'designer@exemplo.com'
});
// Projeto já está finalizado, mas croqui pode ser adicionado

// EXEMPLO 4: Tentativa manual de finalização (desnecessária agora)
try {
    await gerenciador.finalizarProjetoNoFirebase('projeto123');
    // Esta função ainda existe para casos especiais ou correções
} catch (error) {
    console.log('Projeto já finalizado automaticamente:', error.message);
}

// EXEMPLO 5: Workflow completo de um projeto
const workflowCompleto = async (projetoId) => {
    console.log(`Iniciando workflow para projeto ${projetoId}`);
    
    // Passo 1: Luminotécnico
    await gerenciador.atualizarCategoria(projetoId, 'luminotecnico', {
        concluido: true,
        observacoes: 'Projeto luminotécnico aprovado pelo cliente',
        usuario: 'luminotecnico@exemplo.com'
    });
    console.log("✅ Luminotécnico concluído");
    
    // Passo 2: Elétrico  
    await gerenciador.atualizarCategoria(projetoId, 'eletrico', {
        concluido: true,
        observacoes: 'Instalação elétrica projetada conforme normas',
        usuario: 'eletricista@exemplo.com'
    });
    console.log("✅ Elétrico concluído");
    
    // Passo 3: Planilhão (automaticamente finaliza o projeto!)
    await gerenciador.atualizarCategoria(projetoId, 'planilhao', {
        concluido: true,
        observacoes: 'Orçamento final aprovado - R$ 25.000,00',
        usuario: 'orcamentista@exemplo.com'
    });
    console.log("✅ Planilhão concluído");
    console.log("🎉 PROJETO FINALIZADO AUTOMATICAMENTE!");
    
    // Opcional: Adicionar croqui mesmo após finalização
    await gerenciador.atualizarCategoria(projetoId, 'croqui', {
        concluido: true,
        observacoes: 'Desenhos técnicos para arquivo',
        usuario: 'designer@exemplo.com'
    });
    console.log("📐 Croqui adicionado (opcional)");
};

// await workflowCompleto('novo-projeto-456');
*/

// Exportar funções para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        podeFinalizarProjeto,
        finalizarProjeto,
        calcularProgressoProjeto,
        atualizarCategoriaProjeto,
        gerarRelatorioStatusProjetos,
        GerenciadorProjetoFirebase
    };
}

// Para uso no browser
if (typeof window !== 'undefined') {
    window.ProjetoManager = {
        podeFinalizarProjeto,
        finalizarProjeto,
        calcularProgressoProjeto,
        atualizarCategoriaProjeto,
        gerarRelatorioStatusProjetos,
        GerenciadorProjetoFirebase
    };
}

