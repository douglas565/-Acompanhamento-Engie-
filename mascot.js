// === LÓGICA DO MASCOTE DE PRODUTIVIDADE ===

function initMascot() {
    // Só mostra o mascote se o usuário estiver logado (verificamos se a mainScreen está visível)
    const mainScreen = document.getElementById('mainScreen');
    const mascotWidget = document.getElementById('mascotWidget');
    
    // Se a tela principal estiver oculta, esconde o mascote também
    if (mainScreen && mainScreen.classList.contains('hidden')) {
        if(mascotWidget) mascotWidget.classList.add('hidden');
        return;
    }

    if(mascotWidget) mascotWidget.classList.remove('hidden');
    checkMascotHealth();
}

function checkMascotHealth() {
    const lastVisitKey = 'engie_last_visit_' + (currentUser ? currentUser.uid : 'anon');
    const lastVisit = localStorage.getItem(lastVisitKey);
    const now = new Date();
    
    const mascotBody = document.getElementById('mascotBody');
    const mascotSpeech = document.getElementById('mascotSpeech');
    
    // Salva a visita atual
    localStorage.setItem(lastVisitKey, now.toISOString());

    if (!lastVisit) {
        // Primeira visita
        setMascotState('happy', '⚡', 'Bem-vindo à equipe! Eu sou o Bolt, seu assistente de produtividade!');
        return;
    }

    const lastDate = new Date(lastVisit);
    const diffTime = Math.abs(now - lastDate);
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60)); 
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // LÓGICA DE ESTADOS
    if (diffHours < 24) {
        // Acessou em menos de 24h: FELIZ
        const frasesFeliz = [
            "Bem-vindo de volta! 🚀",
            "Bora produzir! 🔥",
            "Você é uma máquina! ⚡",
            "Estou cheio de energia hoje!"
        ];
        const fraseAleatoria = frasesFeliz[Math.floor(Math.random() * frasesFeliz.length)];
        setMascotState('happy', '😁', fraseAleatoria);

    } else if (diffDays <= 3) {
        // 1 a 3 dias sem acessar: TRISTE / CARENTE
        setMascotState('sad', '🥺', `Faz ${diffDays} dias que não te vejo... Senti saudades.`);

    } else if (diffDays <= 7) {
        // 4 a 7 dias: DOENTE / CHORANDO
        setMascotState('sad', '😭', 'Estou me sentindo fraco... preciso de dados de produção!');

    } else {
        // Mais de 7 dias: MORTO
        setMascotState('dead', '💀', 'Eu... eu não aguentei a solidão... (Clique para reviver)');
    }
}

function setMascotState(state, emoji, text) {
    const mascotBody = document.getElementById('mascotBody');
    const mascotSpeech = document.getElementById('mascotSpeech');
    
    mascotBody.innerHTML = emoji;
    mascotSpeech.innerHTML = text;
    
    // Resetar classes
    mascotBody.className = 'mascot-avatar';
    
    if (state === 'sad') {
        mascotBody.classList.add('mascot-sad');
    } else if (state === 'dead') {
        mascotBody.classList.add('mascot-dead');
    }
}

// Função de interação ao clicar
window.interactMascot = function() {
    const mascotBody = document.getElementById('mascotBody');
    
    // Se estiver morto, revive
    if (mascotBody.classList.contains('mascot-dead')) {
        setMascotState('happy', '🤩', 'Obrigado por voltar! Prometo trabalhar duro!');
        // Efeito sonoro opcional ou confete poderia entrar aqui
    } else {
        // Se estiver vivo, fala algo aleatório
        const frasesRandom = [
            "Não esqueça de preencher o Retrofit! 💡",
            "Já verificou o Planilhão hoje? 📊",
            "Curitiba ou Floripa? Quem vence hoje? 🏆",
            "Estou de olho na produção! 👀"
        ];
        document.getElementById('mascotSpeech').innerHTML = frasesRandom[Math.floor(Math.random() * frasesRandom.length)];
    }
};

// Integração: Adicione esta chamada dentro da sua função showMainScreen() existente
// Para garantir que ele carregue quando o usuário logar
// Exemplo:
/* function showMainScreen() {
       // ... seu código existente ...
       setTimeout(initMascot, 1000); // Carrega o mascote 1 seg depois da tela abrir
   }
*/