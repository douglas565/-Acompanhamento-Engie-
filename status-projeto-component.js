// Componente React para Status do Projeto com Finalização Automática
// Arquivo: status-projeto-component.js

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, FileText, Zap, Calculator, PenTool } from 'lucide-react';

const StatusProjeto = () => {
  const [projeto, setProjeto] = useState({
    id: 'PROJ-001',
    nome: 'Projeto Residencial Solar',
    status: 'em_andamento',
    luminotecnico: { concluido: true, observacoes: 'Projeto luminotécnico aprovado', usuario: 'joão@engie.com' },
    eletrico: { concluido: false, observacoes: '', usuario: '' },
    planilhao: { concluido: true, observacoes: 'Planilha de custos finalizada', usuario: 'maria@engie.com' },
    croqui: { concluido: false, observacoes: '', usuario: '' }
  });

  const [progresso, setProgresso] = useState(null);
  const [podeFinalizarProjeto, setPodeFinalizarProjeto] = useState(false);

  const categoriasInfo = {
    luminotecnico: { 
      nome: 'Luminotécnico', 
      icone: FileText, 
      obrigatoria: true,
      descricao: 'Projeto de iluminação e luminotécnica'
    },
    eletrico: { 
      nome: 'Elétrico', 
      icone: Zap, 
      obrigatoria: true,
      descricao: 'Projeto elétrico e instalações'
    },
    planilhao: { 
      nome: 'Planilhão', 
      icone: Calculator, 
      obrigatoria: true,
      descricao: 'Planilha de custos e orçamentos'
    },
    croqui: { 
      nome: 'Croqui', 
      icone: PenTool, 
      obrigatoria: false,
      descricao: 'Esboços e desenhos técnicos (opcional)'
    }
  };

  // Simula as funções do código JavaScript
  const calcularProgressoProjeto = (projeto) => {
    const categoriasObrigatorias = ['luminotecnico', 'eletrico', 'planilhao'];
    let categoriasConcluidasObrigatorias = 0;
    let categoriaOpcionalConcluida = false;
    
    categoriasObrigatorias.forEach(categoria => {
      if (projeto[categoria] && projeto[categoria].concluido) {
        categoriasConcluidasObrigatorias++;
      }
    });
    
    if (projeto.croqui && projeto.croqui.concluido) {
      categoriaOpcionalConcluida = true;
    }
    
    const progressoObrigatorias = (categoriasConcluidasObrigatorias / categoriasObrigatorias.length) * 75;
    const progressoOpcional = categoriaOpcionalConcluida ? 25 : 0;
    
    return {
      progressoTotal: progressoObrigatorias + progressoOpcional,
      categoriasObrigatoriasConcluidas: categoriasConcluidasObrigatorias,
      totalCategoriasObrigatorias: categoriasObrigatorias.length,
      categoriaOpcionalConcluida: categoriaOpcionalConcluida,
      podeSerFinalizado: categoriasConcluidasObrigatorias === categoriasObrigatorias.length
    };
  };

  const verificarPodeFinalizarProjeto = (projeto) => {
    const categoriasObrigatorias = ['luminotecnico', 'eletrico', 'planilhao'];
    return categoriasObrigatorias.every(categoria => {
      return projeto[categoria] && projeto[categoria].concluido === true;
    });
  };

  useEffect(() => {
    const novoProgresso = calcularProgressoProjeto(projeto);
    setProgresso(novoProgresso);
    setPodeFinalizarProjeto(verificarPodeFinalizarProjeto(projeto));
  }, [projeto]);

  const alternarStatusCategoria = (categoria) => {
    const novoStatus = !projeto[categoria].concluido;
    
    // Atualiza o projeto
    const projetoAtualizado = {
      ...projeto,
      [categoria]: {
        ...projeto[categoria],
        concluido: novoStatus,
        dataAtualizacao: new Date().toISOString(),
        usuario: projeto[categoria].usuario || 'usuario@engie.com'
      }
    };
    
    // Verifica se deve finalizar automaticamente
    if (novoStatus && verificarPodeFinalizarProjeto(projetoAtualizado)) {
      projetoAtualizado.status = 'finalizado';
      projetoAtualizado.dataFinalizacao = new Date().toISOString();
      
      // Notificação de finalização automática
      setTimeout(() => {
        alert(`🎉 PROJETO FINALIZADO AUTOMATICAMENTE!\n\nTodas as categorias obrigatórias foram concluídas:\n✅ Luminotécnico\n✅ Elétrico\n✅ Planilhão\n\nO projeto "${projeto.nome}" foi automaticamente marcado como finalizado!`);
      }, 100);
    }
    
    setProjeto(projetoAtualizado);
  };

  const getStatusIcon = (categoria) => {
    if (projeto[categoria].concluido) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getStatusColor = (categoria) => {
    if (projeto[categoria].concluido) {
      return 'bg-green-50 border-green-200';
    }
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header do Projeto */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{projeto.nome}</h1>
            <p className="text-gray-600">ID: {projeto.id}</p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              projeto.status === 'finalizado' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {projeto.status === 'finalizado' ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Finalizado
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-1" />
                  Em Andamento
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Progresso */}
      {progresso && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Progresso do Projeto</h2>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progresso.progressoTotal}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>{progresso.progressoTotal.toFixed(1)}% concluído</span>
            <span>
              {progresso.categoriasObrigatoriasConcluidas}/{progresso.totalCategoriasObrigatorias} obrigatórias
              {progresso.categoriaOpcionalConcluida && ' + opcional'}
            </span>
          </div>
          
          {progresso.podeSerFinalizado && projeto.status !== 'finalizado' && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800 font-medium">
                  Projeto pronto para finalização automática!
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categorias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(categoriasInfo).map(([key, info]) => {
          const IconeCategoria = info.icone;
          return (
            <div 
              key={key}
              className={`border-2 rounded-lg p-4 transition-all duration-200 ${getStatusColor(key)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <IconeCategoria className="w-6 h-6 text-gray-700" />
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {info.nome}
                      {info.obrigatoria && <span className="text-red-500 ml-1">*</span>}
                    </h3>
                    <p className="text-sm text-gray-600">{info.descricao}</p>
                  </div>
                </div>
                {getStatusIcon(key)}
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={() => alternarStatusCategoria(key)}
                  className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                    projeto[key].concluido
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {projeto[key].concluido ? 'Marcar como Pendente' : 'Marcar como Concluído'}
                </button>
                
                {projeto[key].observacoes && (
                  <div className="text-sm text-gray-600 bg-white p-2 rounded border">
                    <strong>Observações:</strong> {projeto[key].observacoes}
                  </div>
                )}
                
                {projeto[key].usuario && (
                  <div className="text-xs text-gray-500">
                    Responsável: {projeto[key].usuario}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Informações Adicionais */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Informações do Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded">
            <strong className="text-blue-800">Categorias Obrigatórias:</strong>
            <br />Luminotécnico, Elétrico, Planilhão
          </div>
          <div className="bg-green-50 p-3 rounded">
            <strong className="text-green-800">Finalização Automática:</strong>
            <br />Ativada quando todas obrigatórias estão concluídas
          </div>
          <div className="bg-purple-50 p-3 rounded">
            <strong className="text-purple-800">Categoria Opcional:</strong>
            <br />Croqui (pode ser adicionado a qualquer momento)
          </div>
        </div>
      </div>

      {/* Log de Atividades (simulado) */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Log de Atividades</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-2 border-b">
            <span>✅ Luminotécnico marcado como concluído</span>
            <span className="text-gray-500">há 2 dias</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span>✅ Planilhão marcado como concluído</span>
            <span className="text-gray-500">há 1 dia</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-orange-600">⏳ Aguardando conclusão do Elétrico</span>
            <span className="text-gray-500">agora</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusProjeto;

