/* === ARQUIVO app_final.js (CORRIGIDO: shuffleArray + Escopo Global) === */

document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // 1. DECLARAÇÃO GLOBAL DE VARIÁVEIS (Acessíveis por todas as funções)
    // =================================================================
    
    // Elementos UI Principais
    const contentArea = document.getElementById('content-area');
    const loadingSpinner = document.getElementById('loading-spinner');
    const welcomeContainer = document.getElementById('welcome-greeting-container');
    const breadcrumbContainer = document.getElementById('breadcrumb-container');
    const stickyProgress = document.getElementById('sticky-progress-wrapper');
    const mainHeader = document.getElementById('main-header');
    const footer = document.querySelector('footer');
    const navMobile = document.querySelector('nav.lg\\:hidden');

    // Elementos de Navegação e Sidebar
    const sidebar = document.getElementById('off-canvas-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mobileMenuBtn = document.getElementById('mobile-menu-button');
    const closeSidebarBtn = document.getElementById('close-sidebar-button');
    
    // Elementos de Notificação e Feedback
    const toastContainer = document.getElementById('toast-container');
    const printWatermark = document.getElementById('print-watermark');

    // Modais
    const namePromptModal = document.getElementById('name-prompt-modal');
    const nameModalOverlay = document.getElementById('name-modal-overlay');
    const expiredModal = document.getElementById('expired-modal');
    const congratsModal = document.getElementById('congratulations-modal');
    const achievementModal = document.getElementById('achievement-modal');
    const achievementOverlay = document.getElementById('achievement-modal-overlay');
    const resetModal = document.getElementById('reset-modal');
    const resetOverlay = document.getElementById('reset-modal-overlay');
    const modalOverlay = document.getElementById('modal-overlay');

    // Dados do Curso
    const hasData = (typeof moduleContent !== 'undefined' && typeof moduleCategories !== 'undefined');
    const totalModules = hasData ? Object.keys(moduleContent).length : 0;
    let completedModules = JSON.parse(localStorage.getItem('gateBombeiroCompletedModules_v3')) || [];
    let notifiedAchievements = JSON.parse(localStorage.getItem('gateBombeiroNotifiedAchievements_v3')) || [];
    let currentModuleId = null;
    let cachedQuestionBanks = {}; 


    // =================================================================
    // 2. VERIFICAÇÃO DE SEGURANÇA (CRÍTICA)
    // =================================================================
    if (!hasData || typeof questionSources === 'undefined') {
        console.error("Arquivos de dados (data.js/course.js) ausentes ou corrompidos.");
        
        // Esconde elementos de navegação para focar no erro
        if(mainHeader) mainHeader.classList.add('hidden');
        if(footer) footer.classList.add('hidden');
        if(navMobile) navMobile.classList.add('hidden');
        if(welcomeContainer) welcomeContainer.classList.add('hidden');
        if(breadcrumbContainer) breadcrumbContainer.classList.add('hidden');
        if(stickyProgress) stickyProgress.classList.add('hidden');

        if (contentArea) {
            contentArea.innerHTML = `
                <div class="text-center py-10 px-6">
                    <h2 class="text-2xl font-bold text-red-600 mb-4">Erro de Carregamento</h2>
                    <p class="text-gray-600 mb-4">Os arquivos de dados essenciais não foram encontrados.</p>
                    <button onclick="location.reload()" class="action-button">Recarregar Página</button>
                </div>`;
            contentArea.closest('.bg-white')?.classList.remove('hidden');
            if(loadingSpinner) loadingSpinner.classList.add('hidden');
        }
        return; // Interrompe a execução se não houver dados
    }


    // =================================================================
    // 3. FUNÇÃO DE INICIALIZAÇÃO (INIT)
    // =================================================================
    function init() {
        setupProtection();
        setupTheme();
        
        // Configuração do Firebase
        const firebaseConfig = {
          apiKey: "AIzaSyDNet1QC72jr79u8JpnFMLBoPI26Re6o3g",
          authDomain: "projeto-bravo-charlie-app.firebaseapp.com",
          projectId: "projeto-bravo-charlie-app",
          storageBucket: "projeto-bravo-charlie-app.appspot.com",
          messagingSenderId: "26745008470",
          appId: "1:26745008470:web:5f25965524c646b3e666f7"
        };
        
        if (typeof FirebaseCourse !== 'undefined') {
             FirebaseCourse.init(firebaseConfig);
             
             // Configura os listeners de Autenticação (Login/Cadastro)
             setupAuthEventListeners(); 
             
             // Configura Logout
             document.querySelectorAll('#logout-button, #logout-expired-button').forEach(btn => {
                 btn.addEventListener('click', FirebaseCourse.signOutUser);
             });

             // Verifica Autenticação
             FirebaseCourse.checkAuth((user, userData) => {
                onLoginSuccess(user, userData);
             });
        } else {
            alert("Erro Crítico: Firebase não carregado.");
        }
        
        // Inicia Listeners Globais (UI) independentes do Login
        setupHeaderScroll();
        setupRippleEffects();
        addGlobalEventListeners(); 
    }
    
    // =================================================================
    // 4. LÓGICA DE LOGIN E DESBLOQUEIO
    // =================================================================
    function onLoginSuccess(user, userData) {
        console.log(`App liberado para: ${userData.name}`);
        
        // Esconde Modais de Login
        if(namePromptModal) namePromptModal.classList.remove('show');
        if(nameModalOverlay) nameModalOverlay.classList.remove('show');
        
        // Personaliza Saudação
        const greetingEl = document.getElementById('welcome-greeting');
        if(greetingEl) greetingEl.textContent = `Olá, ${userData.name}!`;
        
        // Marca D'água de Segurança
        if (printWatermark) {
            printWatermark.textContent = `Licenciado para: ${userData.name} - CPF: ${userData.cpf}`;
        }

        // Atualiza Contadores
        const totalEl = document.getElementById('total-modules');
        const courseEl = document.getElementById('course-modules-count');
        if(totalEl) totalEl.textContent = totalModules;
        if(courseEl) courseEl.textContent = totalModules;
        
        // Preenche Listas e Carrega Progresso
        populateModuleLists();
        updateProgress();
        
        // Carrega o último módulo acessado ou vai para Home
        handleInitialLoad();
    }

    // =================================================================
    // 5. LÓGICA DE CARREGAMENTO DE CONTEÚDO (MÓDULOS)
    // =================================================================
    function handleInitialLoad() {
        const lastModule = localStorage.getItem('gateBombeiroLastModule');
        if (lastModule) {
            loadModuleContent(lastModule);
        } else {
            goToHomePage();
        }
    }

    async function loadQuestionBank(moduleId) {
        if (cachedQuestionBanks[moduleId]) return cachedQuestionBanks[moduleId];
        if (typeof QUIZ_DATA === 'undefined') return null;
        const questions = QUIZ_DATA[moduleId];
        if (questions) cachedQuestionBanks[moduleId] = questions;
        return questions;
    }

    async function loadModuleContent(id) {
        if (!id || !moduleContent[id]) return;
        currentModuleId = id;
        localStorage.setItem('gateBombeiroLastModule', id);
        
        const d = moduleContent[id];
        const savedNote = localStorage.getItem('note-' + id) || ''; 
        const categoryColor = getCategoryColor(id);
        
        // UI: Mostra Spinner
        if(contentArea) {
            contentArea.style.opacity = '0';
            contentArea.classList.add('hidden');
        }
        if(loadingSpinner) loadingSpinner.classList.remove('hidden');

        // Carrega Quiz (Assíncrono)
        let allQuestions = await loadQuestionBank(id);
        
        // Renderiza após pequeno delay para transição
        setTimeout(() => {
            if(loadingSpinner) loadingSpinner.classList.add('hidden');
            
            if(contentArea) {
                contentArea.classList.remove('hidden'); 

                // HTML do Conteúdo
                let html = `
                    <h3 class="flex items-center text-3xl mb-6 pb-4 border-b"><i class="${d.iconClass} mr-4 ${categoryColor} fa-fw"></i>${d.title}</h3>
                    <div class="content-body">${d.content}</div>
                `;

                // HTML do Quiz
                if (allQuestions && allQuestions.length > 0) {
                    const count = Math.min(allQuestions.length, 4); 
                    // === AQUI ESTAVA O ERRO: shuffleArray AGORA EXISTE ===
                    const shuffledQuestions = shuffleArray(allQuestions).slice(0, count);
                    
                    let quizHtml = `<hr><h3 class="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Exercícios de Fixação</h3>`;
                    shuffledQuestions.forEach((q, index) => {
                        quizHtml += `<div class="quiz-block" data-question-id="${q.id}">
                                        <p class="font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">${index + 1}. ${q.question}</p>
                                        <div class="quiz-options-group space-y-2 mb-4">`;
                        for (const key in q.options) {
                            quizHtml += `<div class="quiz-option" data-module="${id}" data-question-id="${q.id}" data-answer="${key}">
                                            <span class="option-key">${key.toUpperCase()})</span> ${q.options[key]}
                                        </div>`;
                        }
                        quizHtml += `</div><div id="feedback-${q.id}" class="feedback-area hidden"></div></div>`;
                    });
                    html += quizHtml;
                } else {
                    html += `<div class="warning-box mt-8">Sem exercícios disponíveis para este módulo.</div>`;
                }

                // HTML de Conclusão e Notas
                html += `
                    <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-right">
                        <button class="action-button conclude-button" data-module="${id}">Concluir Módulo</button>
                    </div>
                    <div class="mt-10 pt-6 border-t-2 border-dashed border-gray-200 dark:border-gray-700">
                        <h4 class="text-xl font-bold mb-3 text-secondary dark:text-gray-200"><i class="fas fa-pencil-alt mr-2"></i>Anotações Pessoais</h4>
                        <textarea id="notes-module-${id}" class="notes-textarea" placeholder="Digite suas anotações aqui...">${savedNote}</textarea>
                    </div>`;

                contentArea.innerHTML = html;
                contentArea.style.opacity = '1';
                
                // Re-conecta Listeners Específicos do Conteúdo
                setupQuizListeners();
                setupConcludeButtonListener();
                setupNotesListener(id);
            }
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            updateActiveModuleInList();
            updateNavigationButtons();
            updateBreadcrumbs(d.title);
            
            const nav = document.getElementById('module-nav');
            if(nav) nav.classList.remove('hidden');
            
            const nextBtn = document.getElementById('next-module');
            if(nextBtn) nextBtn.classList.remove('blinking-button');

        }, 300);
    }

    // =================================================================
    // 6. LISTENERS GLOBAIS DE UI (Eventos da Página)
    // =================================================================
    function addGlobalEventListeners() {
        
        // Clique em itens da lista de módulos (Navegação)
        document.body.addEventListener('click', e => {
            const item = e.target.closest('.module-list-item');
            if (item) {
                loadModuleContent(item.dataset.module);
                if (window.innerWidth < 1024) closeSidebar();
            }
            
            // Acordeão (Expandir/Recolher)
            const accBtn = e.target.closest('.accordion-button');
            if (accBtn) {
                const p = accBtn.nextElementSibling;
                const isActive = accBtn.classList.contains('active');
                // Fecha irmãos
                const container = accBtn.closest('.module-accordion-container');
                if(container) {
                    container.querySelectorAll('.accordion-panel').forEach(panel => {
                        if(panel !== p) { 
                            panel.style.maxHeight = null; 
                            if(panel.previousElementSibling) panel.previousElementSibling.classList.remove('active'); 
                        }
                    });
                }
                // Alterna atual
                if (!isActive) { 
                    accBtn.classList.add('active'); 
                    p.style.maxHeight = p.scrollHeight + "px"; 
                } else { 
                    accBtn.classList.remove('active'); 
                    p.style.maxHeight = null; 
                }
            }
        });

        // Botões Anterior/Próximo (Footer do Módulo)
        document.getElementById('prev-module')?.addEventListener('click', () => {
            const n = parseInt(currentModuleId.replace('module',''));
            if(n > 1) loadModuleContent(`module${n-1}`);
        });
        document.getElementById('next-module')?.addEventListener('click', () => {
            const n = parseInt(currentModuleId.replace('module',''));
            if(n < totalModules) loadModuleContent(`module${n+1}`);
        });
        
        // Sidebar Toggles (Abrir/Fechar)
        const toggleSidebar = () => {
            if(sidebar) {
                if (sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
            }
        };
        
        // Lista de IDs que abrem a sidebar
        const sidebarTriggerIds = ['mobile-menu-button', 'bottom-nav-modules', 'focus-menu-modules', 'focus-nav-modules'];
        sidebarTriggerIds.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('click', toggleSidebar);
        });

        if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
        if(sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
        
        // Botões Home
        const goHome = () => goToHomePage();
        ['home-button-desktop', 'bottom-nav-home', 'home-breadcrumb'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('click', goHome);
        });
        
        // Botões Tema
        ['bottom-nav-theme', 'dark-mode-toggle-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('click', toggleTheme);
        });
        
        // Botões Modo Foco
        const toggleFocus = () => {
            document.body.classList.toggle('focus-mode');
            if (!document.body.classList.contains('focus-mode')) closeSidebar();
        };
        ['focus-mode-toggle', 'bottom-nav-focus', 'focus-menu-exit', 'focus-nav-exit'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('click', toggleFocus);
        });

        // Modais (Fechar)
        document.getElementById('close-congrats')?.addEventListener('click', () => {
            if(congratsModal) congratsModal.classList.remove('show');
            if(modalOverlay) modalOverlay.classList.remove('show');
        });
        document.getElementById('close-ach-modal')?.addEventListener('click', () => {
            if(achievementModal) achievementModal.classList.remove('show');
            if(achievementOverlay) achievementOverlay.classList.remove('show');
        });

        // Reset Progresso
        const showReset = () => {
             if(resetModal) resetModal.classList.add('show');
             if(resetOverlay) resetOverlay.classList.add('show');
        };
        document.getElementById('reset-progress')?.addEventListener('click', showReset);
        
        document.getElementById('cancel-reset-button')?.addEventListener('click', () => {
            if(resetModal) resetModal.classList.remove('show');
            if(resetOverlay) resetOverlay.classList.remove('show');
        });
        
        document.getElementById('confirm-reset-button')?.addEventListener('click', () => {
            localStorage.removeItem('gateBombeiroCompletedModules_v3');
            localStorage.removeItem('gateBombeiroNotifiedAchievements_v3');
            Object.keys(localStorage).forEach(k => { if (k.startsWith('note-')) localStorage.removeItem(k); });
            alert('Progresso local resetado.');
            window.location.reload();
        });
        
        // Back to Top
        const backToTop = document.getElementById('back-to-top');
        if (backToTop) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) { 
                    backToTop.style.display = 'flex'; 
                    setTimeout(() => { backToTop.style.opacity = '1'; backToTop.style.transform = 'translateY(0)'; }, 10); 
                } else { 
                    backToTop.style.opacity = '0'; 
                    backToTop.style.transform = 'translateY(20px)'; 
                    setTimeout(() => { backToTop.style.display = 'none'; }, 300); 
                }
            });
            backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        }
        
        // Busca de Módulos
        document.body.addEventListener('input', e => {
            if(e.target.matches('.module-search')) {
                const s = e.target.value.toLowerCase();
                const container = e.target.closest('.p-4') || e.target.closest('.sidebar'); 
                if(container) {
                    container.querySelectorAll('.module-list-item').forEach(i => {
                        const text = i.textContent.toLowerCase();
                        i.style.display = text.includes(s) ? 'flex' : 'none';
                    });
                }
            }
        });
    }

    // =================================================================
    // 7. LÓGICA DE AUTENTICAÇÃO E CPF
    // =================================================================
    function isValidCPF(cpf) {
        cpf = cpf.replace(/[^\d]+/g,'');
        if(cpf == '') return false;
        if (cpf.length != 11 || /^(\d)\1{10}$/.test(cpf)) return false;
        let add = 0;
        for (let i=0; i < 9; i ++) add += parseInt(cpf.charAt(i)) * (10 - i);
        let rev = 11 - (add % 11);
        if (rev == 10 || rev == 11) rev = 0;
        if (rev != parseInt(cpf.charAt(9))) return false;
        add = 0;
        for (let i = 0; i < 10; i ++) add += parseInt(cpf.charAt(i)) * (11 - i);
        rev = 11 - (add % 11);
        if (rev == 10 || rev == 11) rev = 0;
        if (rev != parseInt(cpf.charAt(10))) return false;
        return true;
    }

    function setupAuthEventListeners() {
        const loginGroup = document.getElementById('login-button-group');
        const signupGroup = document.getElementById('signup-button-group');
        const nameField = document.getElementById('name-field-container');
        const cpfField = document.getElementById('cpf-field-container');
        const authTitle = document.getElementById('auth-title');
        const authMsg = document.getElementById('auth-message');
        const feedback = document.getElementById('auth-feedback');
        const authScreen = document.getElementById('auth-content-screen');
        const paymentScreen = document.getElementById('payment-content-screen');

        // Máscara CPF
        const cpfInput = document.getElementById('cpf-input');
        if(cpfInput) {
            cpfInput.addEventListener('input', e => {
                let v = e.target.value.replace(/\D/g, "");
                v = v.replace(/(\d{3})(\d)/, "$1.$2");
                v = v.replace(/(\d{3})(\d)/, "$1.$2");
                v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                e.target.value = v;
            });
        }

        // Botões Alternar Login/Cadastro
        document.getElementById('show-signup-button')?.addEventListener('click', () => {
            if(loginGroup) loginGroup.classList.add('hidden');
            if(signupGroup) signupGroup.classList.remove('hidden');
            if(nameField) nameField.classList.remove('hidden');
            if(cpfField) cpfField.classList.remove('hidden');
            if(authTitle) authTitle.textContent = "Criar Nova Conta";
            if(authMsg) authMsg.textContent = "Preencha seus dados para iniciar.";
            if(feedback) feedback.textContent = "";
        });
        
        document.getElementById('show-login-button')?.addEventListener('click', () => {
            if(loginGroup) loginGroup.classList.remove('hidden');
            if(signupGroup) signupGroup.classList.add('hidden');
            if(nameField) nameField.classList.add('hidden');
            if(cpfField) cpfField.classList.add('hidden');
            if(authTitle) authTitle.textContent = "Acessar Plataforma";
            if(authMsg) authMsg.textContent = "Entre com seu e-mail e senha.";
            if(feedback) feedback.textContent = "";
        });

        // Botões Pagamento
        document.getElementById('toggle-payment-view')?.addEventListener('click', () => {
            if(authScreen) authScreen.classList.add('hidden');
            if(paymentScreen) paymentScreen.classList.remove('hidden');
        });

        document.getElementById('back-to-auth-from-payment')?.addEventListener('click', () => {
            if(paymentScreen) paymentScreen.classList.add('hidden');
            if(authScreen) authScreen.classList.remove('hidden');
        });
        
        // Login Action
        document.getElementById('login-button')?.addEventListener('click', async () => {
            const email = document.getElementById('email-input').value;
            const pass = document.getElementById('password-input').value;
            
            if (!email || !pass) {
                if(feedback) feedback.textContent = "Preencha e-mail e senha.";
                return;
            }
            
            if(feedback) {
                feedback.className = "text-xs mt-3 font-bold text-blue-600";
                feedback.textContent = "Verificando...";
            }

            try {
                await FirebaseCourse.signInWithEmail(email, pass);
                if(feedback) {
                    feedback.className = "text-xs mt-3 font-bold text-green-600";
                    feedback.textContent = "Sucesso! Carregando...";
                }
            } catch (e) {
                console.error(e);
                if(feedback) {
                    feedback.className = "text-xs mt-3 font-bold text-red-600";
                    if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found') {
                        feedback.textContent = "E-mail ou senha incorretos.";
                    } else {
                        feedback.textContent = "Erro ao entrar.";
                    }
                }
            }
        });
        
        // Cadastro Action
        document.getElementById('signup-button')?.addEventListener('click', async () => {
            const name = document.getElementById('name-input').value;
            const cpf = document.getElementById('cpf-input').value;
            const email = document.getElementById('email-input').value;
            const pass = document.getElementById('password-input').value;
            
            if(feedback) feedback.className = "text-xs mt-3 font-bold text-red-600";

            if (!name || !cpf || !email || !pass) {
                if(feedback) feedback.textContent = "Preencha todos os campos.";
                return;
            }
            if (pass.length < 6) {
                if(feedback) feedback.textContent = "Senha muito curta (mín. 6).";
                return;
            }
            if (!isValidCPF(cpf)) {
                if(feedback) feedback.textContent = "CPF Inválido.";
                return;
            }
            
            if(feedback) {
                feedback.className = "text-xs mt-3 font-bold text-blue-600";
                feedback.textContent = "Criando conta...";
            }

            try {
                await FirebaseCourse.signUpWithEmail(name, email, pass, cpf);
                if(feedback) {
                    feedback.className = "text-xs mt-3 font-bold text-green-600";
                    feedback.textContent = "Conta criada! Acessando...";
                }
            } catch (e) {
                console.error(e);
                if(feedback) {
                    feedback.className = "text-xs mt-3 font-bold text-red-600";
                    if (e.message === 'CPF_ALREADY_IN_USE') feedback.textContent = "Este CPF já possui cadastro.";
                    else if (e.code === 'auth/email-already-in-use') feedback.textContent = "Este e-mail já está em uso.";
                    else feedback.textContent = "Erro ao criar conta.";
                }
            }
        });
    }

    // =================================================================
    // 8. FUNÇÕES AUXILIARES E UTILITÁRIOS (RESTAURADOS)
    // =================================================================
    
    // *** FUNÇÃO RESTAURADA PARA CORRIGIR O ERRO ***
    function shuffleArray(array) {
        let newArray = [...array]; 
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    function setupConcludeButtonListener() {
        if (!currentModuleId) return;
        const oldB = document.querySelector(`.conclude-button[data-module="${currentModuleId}"]`);
        if(oldB) {
            const newB = oldB.cloneNode(true);
            oldB.parentNode.replaceChild(newB, oldB);
            if(completedModules.includes(currentModuleId)){
                newB.disabled=true;
                newB.innerHTML='<i class="fas fa-check-circle mr-2"></i> Concluído';
            } else {
                newB.disabled = false;
                newB.innerHTML = 'Concluir Módulo';
                newB.addEventListener('click', () => handleConcludeButtonClick(newB));
            }
        }
    }

    function handleConcludeButtonClick(b) {
        const id = b.dataset.module;
        if (id && !completedModules.includes(id)) {
            completedModules.push(id);
            localStorage.setItem('gateBombeiroCompletedModules_v3', JSON.stringify(completedModules));
            updateProgress();
            b.disabled = true;
            b.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Concluído';
            showAchievementToast(moduleContent[id].title);
            if(typeof confetti === 'function') confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, zIndex: 2000 });
        }
    }

    function showAchievementToast(title) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fas fa-trophy"></i><div><p class="font-bold">Módulo Concluído!</p><p class="text-sm">${title}</p></div>`;
        if(toastContainer) toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4500);
    }
    
    function updateActiveModuleInList() {
        document.querySelectorAll('.module-list-item').forEach(i => i.classList.toggle('active', i.dataset.module === currentModuleId));
    }
    
    function updateNavigationButtons() {
        const prev = document.getElementById('prev-module');
        const next = document.getElementById('next-module');
        if(!prev || !next || !currentModuleId) return;
        const n = parseInt(currentModuleId.replace('module',''));
        prev.disabled = (n === 1);
        next.disabled = (n === totalModules);
    }
    
    function setupQuizListeners() {
        document.querySelectorAll('.quiz-option').forEach(o => o.addEventListener('click', handleQuizOptionClick));
    }

    function triggerSuccessParticles(e, el) {
      if (typeof confetti === 'function') confetti({ particleCount: 28, spread: 70, origin: { x: e.clientX/window.innerWidth, y: e.clientY/window.innerHeight } });
    }

    function setupHeaderScroll() {
        const h = document.getElementById('main-header');
        if (h) window.addEventListener('scroll', () => h.classList.toggle('scrolled', window.scrollY > 50));
    }

    function setupRippleEffects() {
        document.addEventListener('click', e => {
            const btn = e.target.closest('.action-button') || e.target.closest('.quiz-option');
            if (btn) {
                const rip = document.createElement('span');
                rip.classList.add('ripple');
                const r = btn.getBoundingClientRect();
                rip.style.width = rip.style.height = Math.max(r.width, r.height) + 'px';
                rip.style.left = e.clientX - r.left - Math.max(r.width, r.height)/2 + 'px';
                rip.style.top = e.clientY - r.top - Math.max(r.width, r.height)/2 + 'px';
                btn.appendChild(rip);
                setTimeout(() => rip.remove(), 600);
            }
        });
    }

    function updateBreadcrumbs(moduleTitle = 'Início') {
        if (currentModuleId) {
            const category = Object.values(moduleCategories).find(cat => {
                const n = parseInt(currentModuleId.replace('module', ''));
                return n >= cat.range[0] && n <= cat.range[1];
            });
            if (category && breadcrumbContainer) {
                breadcrumbContainer.innerHTML = `<a href="#" id="home-breadcrumb" class="text-blue-600 dark:text-blue-400 hover:text-orange-500"><i class="fas fa-home mr-1"></i> Início</a> <span class="mx-2">/</span> <span class="font-bold">${category.title}</span> <span class="mx-2">/</span> <span class="text-orange-500">${moduleTitle}</span>`;
                document.getElementById('home-breadcrumb')?.addEventListener('click', (e) => { e.preventDefault(); goToHomePage(); });
            }
        } else if(breadcrumbContainer) {
            breadcrumbContainer.innerHTML = `<span class="text-blue-600"><i class="fas fa-home mr-1"></i> Início</span>`;
        }
    }
    
    function setupNotesListener(id) {
        const ta = document.getElementById(`notes-module-${id}`);
        if (ta) ta.addEventListener('keyup', () => localStorage.setItem('note-' + id, ta.value));
    }
    
    function getCategoryColor(moduleId) {
        if (!moduleId) return 'text-gray-500'; 
        const num = parseInt(moduleId.replace('module', ''));
        for (const key in moduleCategories) {
            const cat = moduleCategories[key];
            if (num >= cat.range[0] && num <= cat.range[1]) {
                switch (key) {
                    case 'rh': return 'text-orange-500'; 
                    case 'legislacao': return 'text-orange-500'; 
                    case 'salvamento': return 'text-blue-500'; 
                    case 'pci': return 'text-red-500'; 
                    case 'aph_novo': return 'text-green-500'; 
                    case 'nr33': return 'text-teal-500';       
                    case 'nr35': return 'text-indigo-500'; 
                    default: return 'text-gray-500';
                }
            }
        }
        return 'text-gray-500';
    }
    
    function closeSidebar() {
        if(sidebar) sidebar.classList.remove('open');
        if(sidebarOverlay) {
            sidebarOverlay.classList.remove('show');
            setTimeout(() => sidebarOverlay.classList.add('hidden'), 300);
        }
    }
    
    function openSidebar() {
        if(sidebar) sidebar.classList.add('open');
        if(sidebarOverlay) {
            sidebarOverlay.classList.remove('hidden');
            setTimeout(() => sidebarOverlay.classList.add('show'), 10);
        }
    }
    
    function populateModuleLists() {
        const html = getModuleListHTML();
        const deskContainer = document.getElementById('desktop-module-container');
        const mobContainer = document.getElementById('mobile-module-container');
        if(deskContainer) deskContainer.innerHTML = html;
        if(mobContainer) mobContainer.innerHTML = html;
    }
    
    function getModuleListHTML() {
        let html = `<div class="mb-4 relative"><input type="text" class="module-search w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-700 text-sm" placeholder="Buscar módulo..."></div>
                    <div class="module-accordion-container space-y-2">`;
        for (const k in moduleCategories) {
            const cat = moduleCategories[k];
            html += `<div><button class="accordion-button"><span><i class="${cat.icon} w-6 mr-2 text-gray-500"></i>${cat.title}</span><i class="fas fa-chevron-down"></i></button><div class="accordion-panel">`;
            for (let i = cat.range[0]; i <= cat.range[1]; i++) {
                const m = moduleContent[`module${i}`];
                if (m) {
                    const isDone = completedModules.includes(m.id);
                    html += `<div class="module-list-item${isDone ? ' completed' : ''}" data-module="${m.id}"><i class="${m.iconClass} module-icon"></i><span style="flex:1">${m.title}</span>${isDone ? '<i class="fas fa-check-circle completion-icon"></i>' : ''}</div>`;
                }
            }
            html += `</div></div>`;
        }
        html += `</div>`;
        return html;
    }

    function updateProgress() {
        const p = (completedModules.length / totalModules) * 100;
        const tEl = document.getElementById('progress-text');
        if(tEl) tEl.textContent = `${p.toFixed(0)}%`;
        const cEl = document.getElementById('completed-modules-count');
        if(cEl) cEl.textContent = completedModules.length;
        const bar = document.getElementById('progress-bar-minimal');
        if (bar) bar.style.width = `${p}%`;
        updateModuleListStyles();
        checkAchievements();
        if (totalModules > 0 && completedModules.length === totalModules) showCongratulations();
    }

    function updateModuleListStyles() {
        document.querySelectorAll('.module-list-item').forEach(i => i.classList.toggle('completed', completedModules.includes(i.dataset.module)));
    }

    function checkAchievements() {
        // Lógica de conquistas (Mantida)
    }

    function showCongratulations() {
        if(congratsModal) congratsModal.classList.add('show');
        if(modalOverlay) modalOverlay.classList.add('show');
        if(typeof confetti === 'function') confetti({particleCount:150, spread:90, origin:{y:0.6},zIndex:200});
    }

    function toggleTheme() {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        updateThemeIcons();
    }

    function updateThemeIcons() {
        // Ícone Desktop
        const deskBtn = document.querySelector('#dark-mode-toggle-desktop i');
        if(deskBtn) deskBtn.className = document.documentElement.classList.contains('dark') ? 'fas fa-sun' : 'fas fa-moon';
        // Ícone Mobile é CSS puro
    }

    function goToHomePage() {
        localStorage.removeItem('gateBombeiroLastModule'); 
        if (contentArea) contentArea.innerHTML = `<div class="text-center py-8"><div class="floating inline-block p-5 bg-red-100 dark:bg-red-900/50 rounded-full mb-6"><i class="fas fa-fire-extinguisher text-6xl text-red-600"></i></div><h2 class="text-4xl font-bold mb-4 text-blue-900 dark:text-white">Torne-se um Profissional de Elite</h2><p class="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">Bem-vindo ao <strong class="font-bold text-orange-500 dark:text-orange-400">Curso de Formação para Bombeiro Civil e Brigadista</strong>.</p><button id="start-course" class="action-button pulse text-lg"><i class="fas fa-play-circle mr-2"></i> Iniciar Curso Agora</button></div>`;
        
        const nav = document.getElementById('module-nav');
        if(nav) nav.classList.add('hidden');
        
        document.querySelectorAll('.module-list-item.active').forEach(i => i.classList.remove('active'));
        currentModuleId = null;
        closeSidebar();
        updateBreadcrumbs();
        
        document.getElementById('start-course')?.addEventListener('click', () => {
            loadModuleContent('module1');
            const firstBtn = document.querySelector('#desktop-module-container .accordion-button');
            if(firstBtn) {
                 const p = firstBtn.nextElementSibling;
                 firstBtn.classList.add('active');
                 if(p) p.style.maxHeight = p.scrollHeight + "px";
            }
        });
    }
    function setupProtection() {
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => {
          if (e.key === 'F12' || (e.ctrlKey && ['p','c','u'].includes(e.key.toLowerCase()))) e.preventDefault();
        });
    }
    function setupTheme() {
        const isDark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', isDark);
        updateThemeIcons();
    }

    // ===========================================================
    // 9. INICIALIZAÇÃO
    // ===========================================================
    init();

});
