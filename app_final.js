/* === ARQUIVO app_final.js (VERSÃO FINAL ESTÁVEL) === */

document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // 1. VARIÁVEIS DE ESTADO (GLOBAL DENTRO DO ESCOPO)
    // =================================================================
    let completedModules = JSON.parse(localStorage.getItem('gateBombeiroCompletedModules_v3')) || [];
    let notifiedAchievements = JSON.parse(localStorage.getItem('gateBombeiroNotifiedAchievements_v3')) || [];
    let currentModuleId = null;
    let cachedQuestionBanks = {}; 

    // Verifica se os dados existem antes de prosseguir
    if (typeof moduleContent === 'undefined' || typeof moduleCategories === 'undefined' || typeof questionSources === 'undefined') {
        console.error("ERRO FATAL: Arquivos de dados (data.js/course.js) não carregados.");
        const contentArea = document.getElementById('content-area');
        if(contentArea) {
            contentArea.innerHTML = `<div class="text-center py-10"><h2 class="text-red-600 font-bold text-xl">Erro de Dados</h2><p>Recarregue a página.</p></div>`;
            contentArea.classList.remove('hidden');
        }
        document.getElementById('loading-spinner')?.classList.add('hidden');
        return; 
    }

    const totalModules = Object.keys(moduleContent).length;

    // =================================================================
    // 2. FUNÇÕES AUXILIARES (HELPERS)
    // =================================================================
    
    // Embaralhar array (para o quiz)
    function shuffleArray(array) {
        let newArray = [...array]; 
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // Validar CPF
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

    // Obter cor da categoria
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

    // =================================================================
    // 3. INTERFACE DO USUÁRIO (UI) E POPULAÇÃO DE DADOS
    // =================================================================

    // Gera o HTML da lista de módulos (Sidebar)
    function getModuleListHTML() {
        let html = `<div class="mb-4 relative"><input type="text" class="module-search w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-700 text-sm" placeholder="Buscar módulo..."></div>
                    <div class="module-accordion-container space-y-2">`;
        
        for (const k in moduleCategories) {
            const cat = moduleCategories[k];
            html += `<div>
                        <button class="accordion-button w-full flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-gray-800 dark:text-white mb-1">
                            <span><i class="${cat.icon} w-6 mr-2 text-gray-500"></i>${cat.title}</span>
                            <i class="fas fa-chevron-down transition-transform"></i>
                        </button>
                        <div class="accordion-panel hidden pl-2 pr-2 pb-2">`; // Começa oculto (hidden)
            
            for (let i = cat.range[0]; i <= cat.range[1]; i++) {
                const m = moduleContent[`module${i}`];
                if (m) {
                    const isDone = completedModules.includes(m.id);
                    html += `<div class="module-list-item ${isDone ? 'completed' : ''} p-3 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:shadow-md transition-all flex items-center justify-between" data-module="${m.id}">
                                <div class="flex items-center">
                                    <i class="${m.iconClass} mr-3 text-lg ${isDone ? 'text-green-500' : 'text-gray-400'}"></i>
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-200">${m.title}</span>
                                </div>
                                ${isDone ? '<i class="fas fa-check-circle text-green-500"></i>' : ''}
                             </div>`;
                }
            }
            html += `   </div>
                     </div>`;
        }
        html += `</div>`;
        return html;
    }

    // Injeta o HTML nas sidebars
    function populateModuleLists() {
        const html = getModuleListHTML();
        const deskContainer = document.getElementById('desktop-module-container');
        const mobContainer = document.getElementById('mobile-module-container');
        
        if(deskContainer) deskContainer.innerHTML = html;
        if(mobContainer) mobContainer.innerHTML = html;
    }

    // Atualiza barra de progresso
    function updateProgress() {
        const p = totalModules > 0 ? (completedModules.length / totalModules) * 100 : 0;
        
        const tEl = document.getElementById('progress-text');
        if(tEl) tEl.textContent = `${p.toFixed(0)}%`;
        
        const cEl = document.getElementById('completed-modules-count');
        if(cEl) cEl.textContent = completedModules.length;
        
        const bar = document.getElementById('progress-bar-minimal');
        if (bar) bar.style.width = `${p}%`;
        
        // Atualiza classes visuais dos itens
        document.querySelectorAll('.module-list-item').forEach(i => {
            const modId = i.dataset.module;
            if(completedModules.includes(modId)) {
                i.classList.add('completed');
                const icon = i.querySelector('i:first-child');
                if(icon) { icon.classList.remove('text-gray-400'); icon.classList.add('text-green-500'); }
            }
        });

        if (totalModules > 0 && completedModules.length === totalModules) {
            document.getElementById('congratulations-modal')?.classList.add('show');
            document.getElementById('modal-overlay')?.classList.add('show');
            if(typeof confetti === 'function') confetti({particleCount:150, spread:90, origin:{y:0.6},zIndex:200});
        }
    }

    // =================================================================
    // 4. LÓGICA DE NAVEGAÇÃO E EVENTOS (CORREÇÃO DO ERRO DO CONSOLE)
    // =================================================================
    function addGlobalEventListeners() {
        
        // 1. CLIQUE NOS MÓDULOS E ACORDEÃO (DELEGAÇÃO DE EVENTOS)
        document.body.addEventListener('click', e => {
            // Clique no Módulo
            const item = e.target.closest('.module-list-item');
            if (item) {
                loadModuleContent(item.dataset.module);
                if (window.innerWidth < 1024) closeSidebar();
                return;
            }
            
            // Clique no Acordeão
            const accBtn = e.target.closest('.accordion-button');
            if (accBtn) {
                const panel = accBtn.nextElementSibling;
                const icon = accBtn.querySelector('.fa-chevron-down');
                
                // Fecha outros
                const allPanels = document.querySelectorAll('.accordion-panel');
                const allBtns = document.querySelectorAll('.accordion-button');
                
                // Toggle atual
                if (panel.classList.contains('hidden')) {
                    panel.classList.remove('hidden'); // Abre
                    accBtn.classList.add('active'); // Estilo ativo
                    if(icon) icon.style.transform = 'rotate(180deg)';
                } else {
                    panel.classList.add('hidden'); // Fecha
                    accBtn.classList.remove('active');
                    if(icon) icon.style.transform = 'rotate(0deg)';
                }
            }
        });

        // 2. SIDEBAR (ABRIR/FECHAR)
        const toggleSidebar = () => {
            const sb = document.getElementById('off-canvas-sidebar');
            const ov = document.getElementById('sidebar-overlay');
            if (sb?.classList.contains('open')) closeSidebar(); else openSidebar();
        };

        ['mobile-menu-button', 'bottom-nav-modules', 'focus-menu-modules', 'focus-nav-modules'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', toggleSidebar);
        });

        document.getElementById('close-sidebar-button')?.addEventListener('click', closeSidebar);
        document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

        // 3. HOME E TEMA
        ['home-button-desktop', 'bottom-nav-home', 'home-breadcrumb'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', goToHomePage);
        });

        ['bottom-nav-theme', 'dark-mode-toggle-desktop'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', toggleTheme);
        });

        // 4. MODO FOCO
        ['focus-mode-toggle', 'bottom-nav-focus', 'focus-menu-exit', 'focus-nav-exit'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => {
                document.body.classList.toggle('focus-mode');
                if (!document.body.classList.contains('focus-mode')) closeSidebar();
            });
        });

        // 5. NAVEGAÇÃO INTERNA
        document.getElementById('prev-module')?.addEventListener('click', () => {
            const n = parseInt(currentModuleId.replace('module',''));
            if(n > 1) loadModuleContent(`module${n-1}`);
        });
        document.getElementById('next-module')?.addEventListener('click', () => {
            const n = parseInt(currentModuleId.replace('module',''));
            if(n < totalModules) loadModuleContent(`module${n+1}`);
        });
        
        // 6. RESETAR
        document.getElementById('reset-progress')?.addEventListener('click', () => {
            document.getElementById('reset-modal')?.classList.add('show');
            document.getElementById('reset-modal-overlay')?.classList.add('show');
        });
        document.getElementById('cancel-reset-button')?.addEventListener('click', () => {
            document.getElementById('reset-modal')?.classList.remove('show');
            document.getElementById('reset-modal-overlay')?.classList.remove('show');
        });
        document.getElementById('confirm-reset-button')?.addEventListener('click', () => {
            localStorage.removeItem('gateBombeiroCompletedModules_v3');
            localStorage.removeItem('gateBombeiroNotifiedAchievements_v3');
            Object.keys(localStorage).forEach(k => { if (k.startsWith('note-')) localStorage.removeItem(k); });
            window.location.reload();
        });
        
        // 7. MODAIS FECHAR
        document.getElementById('close-congrats')?.addEventListener('click', () => {
            document.getElementById('congratulations-modal')?.classList.remove('show');
            document.getElementById('modal-overlay')?.classList.remove('show');
        });
    }

    function openSidebar() {
        document.getElementById('off-canvas-sidebar')?.classList.add('open');
        document.getElementById('sidebar-overlay')?.classList.remove('hidden');
        setTimeout(() => document.getElementById('sidebar-overlay')?.classList.add('show'), 10);
    }

    function closeSidebar() {
        document.getElementById('off-canvas-sidebar')?.classList.remove('open');
        const ov = document.getElementById('sidebar-overlay');
        if(ov) {
            ov.classList.remove('show');
            setTimeout(() => ov.classList.add('hidden'), 300);
        }
    }

    function toggleTheme() {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        updateThemeIcons();
    }

    function updateThemeIcons() {
        const deskBtn = document.querySelector('#dark-mode-toggle-desktop i');
        if(deskBtn) deskBtn.className = document.documentElement.classList.contains('dark') ? 'fas fa-sun' : 'fas fa-moon';
    }

    // =================================================================
    // 5. CARREGAMENTO DE CONTEÚDO E QUIZ
    // =================================================================
    async function loadModuleContent(id) {
        if (!id || !moduleContent[id]) return;
        
        currentModuleId = id;
        localStorage.setItem('gateBombeiroLastModule', id);
        
        const d = moduleContent[id];
        const savedNote = localStorage.getItem('note-' + id) || ''; 
        const categoryColor = getCategoryColor(id);
        
        // UI Transition
        const contentArea = document.getElementById('content-area');
        const spinner = document.getElementById('loading-spinner');
        
        if(contentArea) {
            contentArea.classList.add('hidden');
            contentArea.style.opacity = '0';
        }
        if(spinner) spinner.classList.remove('hidden');

        // Load Quiz
        let allQuestions = null;
        if(cachedQuestionBanks[id]) {
            allQuestions = cachedQuestionBanks[id];
        } else if(typeof QUIZ_DATA !== 'undefined' && QUIZ_DATA[id]) {
            allQuestions = QUIZ_DATA[id];
            cachedQuestionBanks[id] = allQuestions;
        }

        // Render delay
        setTimeout(() => {
            if(spinner) spinner.classList.add('hidden');
            if(contentArea) {
                contentArea.classList.remove('hidden');
                
                let html = `
                    <h3 class="flex items-center text-3xl mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 font-bold text-blue-900 dark:text-white">
                        <i class="${d.iconClass} mr-4 ${categoryColor}"></i>${d.title}
                    </h3>
                    <div class="content-body text-gray-700 dark:text-gray-300 leading-relaxed">${d.content}</div>
                `;

                if (allQuestions && allQuestions.length > 0) {
                    const count = Math.min(allQuestions.length, 4);
                    const questions = shuffleArray(allQuestions).slice(0, count);
                    
                    html += `<hr class="my-8 border-gray-200 dark:border-gray-700">
                             <h3 class="text-xl font-bold mb-6 text-gray-800 dark:text-white">Exercícios de Fixação</h3>`;
                    
                    questions.forEach((q, idx) => {
                        html += `<div class="quiz-block mb-6" data-question-id="${q.id}">
                                    <p class="font-semibold mb-3 text-gray-800 dark:text-gray-200">${idx + 1}. ${q.question}</p>
                                    <div class="quiz-options-group space-y-2">`;
                        for (const k in q.options) {
                            html += `<div class="quiz-option p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-start" 
                                          data-module="${id}" data-question-id="${q.id}" data-answer="${k}">
                                        <span class="font-bold mr-2 text-blue-600 dark:text-blue-400">${k.toUpperCase()})</span>
                                        <span class="text-gray-700 dark:text-gray-300">${q.options[k]}</span>
                                     </div>`;
                        }
                        html += `   </div><div id="feedback-${q.id}" class="feedback-area hidden mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900 text-sm"></div>
                                 </div>`;
                    });
                }

                html += `
                    <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-right">
                        <button class="action-button conclude-button px-6 py-3 rounded-lg font-bold text-white shadow-lg transform transition hover:-translate-y-1" data-module="${id}">
                            Concluir Módulo
                        </button>
                    </div>
                    <div class="mt-10 pt-6 border-t-2 border-dashed border-gray-200 dark:border-gray-700">
                        <h4 class="text-lg font-bold mb-3 text-gray-700 dark:text-gray-300"><i class="fas fa-pencil-alt mr-2"></i>Anotações</h4>
                        <textarea id="notes-module-${id}" class="notes-textarea w-full p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-white h-32" placeholder="Suas anotações...">${savedNote}</textarea>
                    </div>`;

                contentArea.innerHTML = html;
                contentArea.style.opacity = '1';

                // Re-bind listeners
                setupQuizListeners();
                setupConcludeButtonListener();
                
                const noteArea = document.getElementById(`notes-module-${id}`);
                if(noteArea) noteArea.addEventListener('keyup', () => localStorage.setItem('note-' + id, noteArea.value));
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Update Nav State
            document.querySelectorAll('.module-list-item').forEach(i => i.classList.remove('active'));
            const activeItem = document.querySelector(`.module-list-item[data-module="${id}"]`);
            if(activeItem) activeItem.classList.add('active');
            
            const prev = document.getElementById('prev-module');
            const next = document.getElementById('next-module');
            if(prev && next) {
                const n = parseInt(id.replace('module',''));
                prev.disabled = (n === 1);
                next.disabled = (n === totalModules);
                document.getElementById('module-nav')?.classList.remove('hidden');
            }
            
            updateBreadcrumbs(d.title);

        }, 300);
    }

    // Quiz Listener
    function setupQuizListeners() {
        document.querySelectorAll('.quiz-option').forEach(o => {
            o.addEventListener('click', function(e) {
                const el = e.currentTarget;
                if(el.getAttribute('data-disabled') === 'true') return;
                
                const mid = el.dataset.module;
                const qid = el.dataset.questionId;
                const ans = el.dataset.answer;
                
                const qData = cachedQuestionBanks[mid]?.find(q => q.id === qid);
                if(!qData) return;

                const container = el.closest('.quiz-options-group');
                const feedback = document.getElementById(`feedback-${qid}`);
                
                // Disable all options
                container.querySelectorAll('.quiz-option').forEach(opt => {
                    opt.setAttribute('data-disabled', 'true');
                    opt.classList.add('opacity-75', 'cursor-not-allowed');
                    if(opt.dataset.answer === qData.answer) {
                        opt.classList.add('bg-green-100', 'dark:bg-green-900', 'border-green-500');
                    }
                });

                if(ans === qData.answer) {
                    el.classList.add('bg-green-100', 'dark:bg-green-900', 'border-green-500');
                    if(feedback) {
                        feedback.innerHTML = `<strong class="text-green-600 dark:text-green-400">Correto!</strong> ${qData.explanation}`;
                        feedback.classList.remove('hidden');
                    }
                    if(typeof confetti === 'function') confetti({particleCount: 50, spread: 60, origin: { y: 0.7 }});
                } else {
                    el.classList.add('bg-red-100', 'dark:bg-red-900', 'border-red-500');
                    if(feedback) {
                        feedback.innerHTML = `<strong class="text-red-600 dark:text-red-400">Incorreto.</strong> ${qData.explanation}`;
                        feedback.classList.remove('hidden');
                    }
                }
            });
        });
    }

    // Conclude Listener
    function setupConcludeButtonListener() {
        const btn = document.querySelector('.conclude-button');
        if(!btn) return;
        
        const id = btn.dataset.module;
        if(completedModules.includes(id)) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Concluído';
            btn.classList.add('bg-gray-400', 'cursor-not-allowed');
        } else {
            btn.addEventListener('click', () => {
                completedModules.push(id);
                localStorage.setItem('gateBombeiroCompletedModules_v3', JSON.stringify(completedModules));
                updateProgress();
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-check mr-2"></i> Concluído';
                btn.classList.add('bg-gray-400');
                
                const toast = document.getElementById('toast-container');
                if(toast) {
                    toast.innerHTML = `<div class="bg-green-600 text-white px-4 py-2 rounded shadow-lg">Módulo Concluído!</div>`;
                    setTimeout(() => toast.innerHTML = '', 3000);
                }
                if(typeof confetti === 'function') confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }});
            });
        }
    }

    // --- HOME PAGE ---
    function goToHomePage() {
        localStorage.removeItem('gateBombeiroLastModule'); 
        currentModuleId = null;
        
        const contentArea = document.getElementById('content-area');
        const nav = document.getElementById('module-nav');
        const breadcrumb = document.getElementById('breadcrumb-container');
        
        if(contentArea) {
            contentArea.classList.remove('hidden');
            contentArea.style.opacity = '1';
            contentArea.innerHTML = `
                <div class="text-center py-10">
                    <div class="inline-block p-6 bg-blue-50 dark:bg-gray-800 rounded-full mb-6 shadow-lg animate-bounce">
                        <i class="fas fa-fire-extinguisher text-6xl text-red-600"></i>
                    </div>
                    <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">Bem-vindo ao Curso</h1>
                    <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
                        Torne-se um profissional de elite. Escolha um módulo ao lado para começar.
                    </p>
                    <button id="start-course-btn" class="action-button px-8 py-4 text-lg rounded-full font-bold text-white bg-gradient-to-r from-red-600 to-orange-500 shadow-lg hover:shadow-xl transform transition hover:-translate-y-1">
                        <i class="fas fa-play mr-2"></i> Iniciar Curso Agora
                    </button>
                </div>`;
            
            document.getElementById('start-course-btn')?.addEventListener('click', () => {
                loadModuleContent('module1');
            });
        }
        
        if(nav) nav.classList.add('hidden');
        if(breadcrumb) breadcrumb.innerHTML = `<span class="text-gray-500"><i class="fas fa-home mr-1"></i> Início</span>`;
        
        document.querySelectorAll('.module-list-item').forEach(i => i.classList.remove('active'));
        closeSidebar();
    }

    function updateBreadcrumbs(title) {
        const bc = document.getElementById('breadcrumb-container');
        if(bc) {
            bc.innerHTML = `<button id="bc-home" class="text-blue-600 hover:underline"><i class="fas fa-home"></i></button> 
                            <span class="mx-2 text-gray-400">/</span> 
                            <span class="text-gray-600 dark:text-gray-300 font-medium truncate">${title}</span>`;
            document.getElementById('bc-home')?.addEventListener('click', goToHomePage);
        }
    }

    // =================================================================
    // 6. AUTH & INIT
    // =================================================================

    // Auth Listeners
    function setupAuthUI() {
        // Máscara CPF
        document.getElementById('cpf-input')?.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, "");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            e.target.value = v;
        });

        // Toggle Login/Sign/Payment
        const els = {
            loginGroup: document.getElementById('login-button-group'),
            signupGroup: document.getElementById('signup-button-group'),
            nameField: document.getElementById('name-field-container'),
            cpfField: document.getElementById('cpf-field-container'),
            title: document.getElementById('auth-title'),
            msg: document.getElementById('auth-message'),
            feedback: document.getElementById('auth-feedback'),
            authScreen: document.getElementById('auth-content-screen'),
            payScreen: document.getElementById('payment-content-screen')
        };

        document.getElementById('show-signup-button')?.addEventListener('click', () => {
            els.loginGroup.classList.add('hidden');
            els.signupGroup.classList.remove('hidden');
            els.nameField.classList.remove('hidden');
            els.cpfField.classList.remove('hidden');
            els.title.textContent = "Criar Nova Conta";
            els.feedback.textContent = "";
        });

        document.getElementById('show-login-button')?.addEventListener('click', () => {
            els.loginGroup.classList.remove('hidden');
            els.signupGroup.classList.add('hidden');
            els.nameField.classList.add('hidden');
            els.cpfField.classList.add('hidden');
            els.title.textContent = "Acessar Plataforma";
            els.feedback.textContent = "";
        });
        
        document.getElementById('toggle-payment-view')?.addEventListener('click', () => {
            els.authScreen.classList.add('hidden');
            els.payScreen.classList.remove('hidden');
        });
        
        document.getElementById('back-to-auth-from-payment')?.addEventListener('click', () => {
            els.payScreen.classList.add('hidden');
            els.authScreen.classList.remove('hidden');
        });

        // Actions
        document.getElementById('login-button')?.addEventListener('click', async () => {
            const email = document.getElementById('email-input').value;
            const pass = document.getElementById('password-input').value;
            if(!email || !pass) return els.feedback.textContent = "Preencha email e senha.";
            
            els.feedback.textContent = "Entrando...";
            try {
                await FirebaseCourse.signInWithEmail(email, pass);
            } catch(e) {
                console.error(e);
                els.feedback.textContent = "Erro ao entrar. Verifique seus dados.";
            }
        });

        document.getElementById('signup-button')?.addEventListener('click', async () => {
            const name = document.getElementById('name-input').value;
            const cpf = document.getElementById('cpf-input').value;
            const email = document.getElementById('email-input').value;
            const pass = document.getElementById('password-input').value;
            
            if(!name || !cpf || !email || !pass) return els.feedback.textContent = "Preencha tudo.";
            if(!isValidCPF(cpf)) return els.feedback.textContent = "CPF Inválido.";
            
            els.feedback.textContent = "Criando conta...";
            try {
                await FirebaseCourse.signUpWithEmail(name, email, pass, cpf);
            } catch(e) {
                console.error(e);
                if(e.message === 'CPF_ALREADY_IN_USE') els.feedback.textContent = "CPF já cadastrado.";
                else if(e.code === 'auth/email-already-in-use') els.feedback.textContent = "Email já cadastrado.";
                else els.feedback.textContent = "Erro ao criar conta.";
            }
        });
    }

    function init() {
        // Configura Firebase
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
            setupAuthUI();
            
            // Logout buttons
            document.querySelectorAll('#logout-button, #logout-expired-button').forEach(b => {
                b.addEventListener('click', FirebaseCourse.signOutUser);
            });

            // Check Auth
            FirebaseCourse.checkAuth((user, userData) => {
                console.log("Login OK:", userData.name);
                document.getElementById('name-prompt-modal')?.classList.remove('show');
                document.getElementById('name-modal-overlay')?.classList.remove('show');
                
                const greeting = document.getElementById('welcome-greeting');
                if(greeting) greeting.textContent = `Olá, ${userData.name}!`;
                
                const water = document.getElementById('print-watermark');
                if(water) water.textContent = `${userData.name} - ${userData.cpf}`;
                
                // Carrega dados
                populateModuleLists();
                updateProgress();
                
                // Carrega último local ou home
                const last = localStorage.getItem('gateBombeiroLastModule');
                if(last) loadModuleContent(last); else goToHomePage();
            });
        }

        setupTheme();
        updateThemeIcons();
        addGlobalEventListeners();
    }

    function setupTheme() {
        const isDark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', isDark);
    }

    // Inicializa
    init();

});
