/* === ARQUIVO app_final.js (CORREÇÃO FINAL - BOTÕES E CPF) === */

document.addEventListener('DOMContentLoaded', () => {

    // --- VERIFICAÇÃO DE SEGURANÇA ---
    if (typeof moduleContent === 'undefined' || typeof moduleCategories === 'undefined' || typeof questionSources === 'undefined') {
        console.error("Arquivos de dados ausentes.");
        const errDiv = document.getElementById('content-area');
        if(errDiv) errDiv.innerHTML = "<div class='text-center py-10'><h2>Erro Crítico: Dados não carregados.</h2><button onclick='location.reload()'>Recarregar</button></div>";
        return;
    }

    // --- VARIÁVEIS GLOBAIS ---
    const contentArea = document.getElementById('content-area');
    const totalModules = Object.keys(moduleContent).length;
    let completedModules = JSON.parse(localStorage.getItem('gateBombeiroCompletedModules_v3')) || [];
    let notifiedAchievements = JSON.parse(localStorage.getItem('gateBombeiroNotifiedAchievements_v3')) || [];
    let currentModuleId = null;
    let cachedQuestionBanks = {}; 

    // --- INIT ---
    function init() {
        setupProtection();
        setupTheme();
        
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
             setupAuthEventListeners(); 
             
             // Listeners de Logout
             document.querySelectorAll('#logout-button, #logout-expired-button').forEach(btn => {
                 btn.addEventListener('click', FirebaseCourse.signOutUser);
             });

             FirebaseCourse.checkAuth((user, userData) => {
                onLoginSuccess(user, userData);
             });
        }
        
        setupHeaderScroll();
        setupRippleEffects();
        
        // CORREÇÃO: Listeners de UI que não dependem de login
        addGlobalEventListeners();
    }
    
    function onLoginSuccess(user, userData) {
        console.log(`App iniciado para ${userData.name}`);
        document.getElementById('name-prompt-modal')?.classList.remove('show');
        document.getElementById('name-modal-overlay')?.classList.remove('show');
        
        const greetingEl = document.getElementById('welcome-greeting');
        if(greetingEl) greetingEl.textContent = `Olá, ${userData.name}!`;
        
        const watermark = document.getElementById('print-watermark');
        if (watermark) watermark.textContent = `Conteúdo Exclusivo: ${userData.name} (${userData.cpf})`;

        document.getElementById('total-modules').textContent = totalModules;
        document.getElementById('course-modules-count').textContent = totalModules;
        
        populateModuleLists();
        updateProgress();
        handleInitialLoad();
    }

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
        const feedback = document.getElementById('auth-feedback');
        const authScreen = document.getElementById('auth-content-screen');
        const paymentScreen = document.getElementById('payment-content-screen');

        const cpfInput = document.getElementById('cpf-input');
        cpfInput?.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, "");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            e.target.value = v;
        });

        document.getElementById('show-signup-button')?.addEventListener('click', () => {
            loginGroup.classList.add('hidden'); signupGroup.classList.remove('hidden');
            nameField.classList.remove('hidden'); cpfField.classList.remove('hidden');
            authTitle.textContent = "Criar Nova Conta"; feedback.textContent = "";
        });
        
        document.getElementById('show-login-button')?.addEventListener('click', () => {
            loginGroup.classList.remove('hidden'); signupGroup.classList.add('hidden');
            nameField.classList.add('hidden'); cpfField.classList.add('hidden');
            authTitle.textContent = "Acessar Plataforma"; feedback.textContent = "";
        });

        document.getElementById('toggle-payment-view')?.addEventListener('click', () => {
            authScreen.classList.add('hidden'); paymentScreen.classList.remove('hidden');
        });
        document.getElementById('back-to-auth-from-payment')?.addEventListener('click', () => {
            paymentScreen.classList.add('hidden'); authScreen.classList.remove('hidden');
        });
        
        document.getElementById('login-button')?.addEventListener('click', async () => {
            const email = document.getElementById('email-input').value;
            const pass = document.getElementById('password-input').value;
            if (!email || !pass) return feedback.textContent = "Preencha todos os campos.";
            feedback.textContent = "Entrando...";
            try {
                await FirebaseCourse.signInWithEmail(email, pass);
                feedback.textContent = "Sucesso! Carregando...";
            } catch (e) {
                console.error(e);
                feedback.textContent = "E-mail ou senha incorretos.";
            }
        });
        
        document.getElementById('signup-button')?.addEventListener('click', async () => {
            const name = document.getElementById('name-input').value;
            const cpf = document.getElementById('cpf-input').value;
            const email = document.getElementById('email-input').value;
            const pass = document.getElementById('password-input').value;
            
            if (!name || !cpf || !email || !pass) return feedback.textContent = "Preencha todos os campos.";
            if (!isValidCPF(cpf)) return feedback.textContent = "CPF Inválido.";
            
            feedback.textContent = "Criando conta...";
            try {
                await FirebaseCourse.signUpWithEmail(name, email, pass, cpf);
                feedback.textContent = "Conta criada com sucesso!";
            } catch (e) {
                console.error(e);
                if (e.message === 'CPF_ALREADY_IN_USE') feedback.textContent = "Este CPF já está cadastrado.";
                else if (e.code === 'auth/email-already-in-use') feedback.textContent = "E-mail já em uso.";
                else feedback.textContent = "Erro ao criar conta.";
            }
        });
    }

    // --- FUNÇÃO CENTRAL DE EVENTOS UI (CORRIGIDA) ---
    function addGlobalEventListeners() {
        // Navegação de Módulos
        document.body.addEventListener('click', e => {
            const item = e.target.closest('.module-list-item');
            if (item) {
                loadModuleContent(item.dataset.module);
                // Se estiver no mobile, fecha a sidebar ao clicar
                if (window.innerWidth < 1024) closeSidebar();
            }
            
            // Accordion
            const accBtn = e.target.closest('.accordion-button');
            if (accBtn) {
                const p = accBtn.nextElementSibling;
                const isActive = accBtn.classList.contains('active');
                // Fecha outros painéis do mesmo container
                const container = accBtn.closest('.module-accordion-container');
                if(container) {
                    container.querySelectorAll('.accordion-panel').forEach(panel => {
                        if(panel !== p) { panel.style.maxHeight = null; panel.previousElementSibling.classList.remove('active'); }
                    });
                }
                if (!isActive) { accBtn.classList.add('active'); p.style.maxHeight = p.scrollHeight + "px"; }
                else { accBtn.classList.remove('active'); p.style.maxHeight = null; }
            }
        });

        // Botões de Navegação (Anterior/Próximo)
        document.getElementById('prev-module')?.addEventListener('click', () => {
            const n = parseInt(currentModuleId.replace('module',''));
            if(n > 1) loadModuleContent(`module${n-1}`);
        });
        document.getElementById('next-module')?.addEventListener('click', () => {
            const n = parseInt(currentModuleId.replace('module',''));
            if(n < totalModules) loadModuleContent(`module${n+1}`);
        });
        
        // SIDEBAR TOGGLES (CORRIGIDO)
        const toggleSidebar = () => {
            const sb = document.getElementById('off-canvas-sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sb.classList.contains('open')) closeSidebar(); else openSidebar();
        };

        // Múltiplos botões podem abrir a sidebar
        document.querySelectorAll('#mobile-menu-button, #bottom-nav-modules, #focus-menu-modules, #focus-nav-modules').forEach(btn => {
            btn.addEventListener('click', toggleSidebar);
        });

        // Botões para fechar sidebar
        document.getElementById('close-sidebar-button')?.addEventListener('click', closeSidebar);
        document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
        
        // HOME
        const goHome = () => goToHomePage();
        document.querySelectorAll('#home-button-desktop, #bottom-nav-home, #home-breadcrumb').forEach(btn => {
            btn.addEventListener('click', goHome);
        });
        
        // TEMA
        document.querySelectorAll('#bottom-nav-theme, #dark-mode-toggle-desktop').forEach(btn => {
            btn.addEventListener('click', toggleTheme);
        });
        
        // MODO FOCO (CORRIGIDO)
        const toggleFocus = () => {
            document.body.classList.toggle('focus-mode');
            if (!document.body.classList.contains('focus-mode')) closeSidebar();
        };
        document.querySelectorAll('#focus-mode-toggle, #bottom-nav-focus, #focus-menu-exit, #focus-nav-exit').forEach(btn => {
            btn.addEventListener('click', toggleFocus);
        });

        // MODAIS
        document.getElementById('close-congrats')?.addEventListener('click', () => {
            document.getElementById('congratulations-modal').classList.remove('show');
            document.getElementById('modal-overlay').classList.remove('show');
        });
        document.getElementById('close-ach-modal')?.addEventListener('click', () => {
            document.getElementById('achievement-modal').classList.remove('show');
            document.getElementById('achievement-modal-overlay').classList.remove('show');
        });

        // RESET
        const showReset = () => {
             document.getElementById('reset-modal').classList.add('show');
             document.getElementById('reset-modal-overlay').classList.add('show');
        };
        document.getElementById('reset-progress')?.addEventListener('click', showReset);
        document.getElementById('cancel-reset-button')?.addEventListener('click', () => {
            document.getElementById('reset-modal').classList.remove('show');
            document.getElementById('reset-modal-overlay').classList.remove('show');
        });
        document.getElementById('confirm-reset-button')?.addEventListener('click', () => {
            localStorage.removeItem('gateBombeiroCompletedModules_v3');
            localStorage.removeItem('gateBombeiroNotifiedAchievements_v3');
            alert('Progresso local resetado.');
            window.location.reload();
        });
        
        // Busca
        document.body.addEventListener('input', e => {
            if(e.target.matches('.module-search')) {
                const s = e.target.value.toLowerCase();
                const container = e.target.closest('.p-4'); // Ajuste para pegar o container correto
                if(container) {
                    container.querySelectorAll('.module-list-item').forEach(i => {
                        i.style.display = i.textContent.toLowerCase().includes(s) ? 'flex' : 'none';
                    });
                }
            }
        });
    }

    // --- FUNÇÕES AUXILIARES ---
    function handleInitialLoad() {
        const lastModule = localStorage.getItem('gateBombeiroLastModule');
        if (lastModule) loadModuleContent(lastModule); else goToHomePage();
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
        
        contentArea.style.opacity = '0';
        loadingSpinner.classList.remove('hidden');
        contentArea.classList.add('hidden'); 

        let allQuestions = await loadQuestionBank(id);
        
        setTimeout(() => {
            loadingSpinner.classList.add('hidden');
            contentArea.classList.remove('hidden'); 

            let html = `
                <h3 class="flex items-center text-3xl mb-6 pb-4 border-b"><i class="${d.iconClass} mr-4 ${categoryColor} fa-fw"></i>${d.title}</h3>
                <div>${d.content}</div>
            `;

            if (allQuestions && allQuestions.length > 0) {
                const count = Math.min(allQuestions.length, 4); 
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
            }

            html += `
                <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-right">
                    <button class="action-button conclude-button" data-module="${id}">Concluir Módulo</button>
                </div>
                <div class="mt-10 pt-6 border-t-2 border-dashed border-gray-200 dark:border-gray-700">
                    <h4 class="text-xl font-bold mb-3 text-secondary dark:text-gray-200"><i class="fas fa-pencil-alt mr-2"></i>Anotações Pessoais</h4>
                    <textarea id="notes-module-${id}" class="notes-textarea" placeholder="Digite suas anotações aqui...">${savedNote}</textarea>
                </div>`;

            contentArea.innerHTML = html;
            setupQuizListeners();
            setupConcludeButtonListener();
            setupNotesListener(id);
            contentArea.style.opacity = '1';
            contentArea.style.transition = 'opacity 0.3s ease';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            updateActiveModuleInList();
            updateNavigationButtons();
            updateBreadcrumbs(d.title);
            document.getElementById('module-nav').classList.remove('hidden');
            document.getElementById('next-module')?.classList.remove('blinking-button');
        }, 300);
    }

    function handleQuizOptionClick(e) {
        const o = e.currentTarget;
        if (o.disabled) return;
        const moduleId = o.dataset.module;
        const questionId = o.dataset.questionId;
        const selectedAnswer = o.dataset.answer;
        const questionData = cachedQuestionBanks[moduleId]?.find(q => q.id === questionId);
        if (!questionData) return;
        const correctAnswer = questionData.answer;
        const optionsGroup = o.closest('.quiz-options-group');
        const feedbackArea = document.getElementById(`feedback-${questionId}`);
        optionsGroup.querySelectorAll(`.quiz-option`).forEach(opt => {
            opt.disabled = true;
            if (opt.dataset.answer === correctAnswer) opt.classList.add('correct');
        });
        let feedbackContent = '';
        if (selectedAnswer === correctAnswer) {
            o.classList.add('correct');
            feedbackContent = `<strong class="text-green-600">Correto!</strong> ${questionData.explanation || ''}`;
            if (typeof triggerSuccessParticles === 'function') triggerSuccessParticles(e, o);
        } else {
            o.classList.add('incorrect');
            feedbackContent = `<strong class="text-red-600">Incorreto.</strong> ${questionData.explanation || ''}`;
        }
        if (feedbackArea) {
            feedbackArea.innerHTML = `<div class="explanation mt-2">${feedbackContent}</div>`;
            feedbackArea.classList.remove('hidden');
        }
    }
    
    function updateBreadcrumbs(moduleTitle = 'Início') {
        const homeLink = `<a href="#" id="home-breadcrumb" class="text-blue-600 dark:text-blue-400 hover:text-orange-500 transition-colors"><i class="fas fa-home mr-1"></i> Início</a>`;
        if (!currentModuleId) {
            breadcrumbContainer.innerHTML = homeLink;
        } else {
            const category = Object.values(moduleCategories).find(cat => {
                const moduleNum = parseInt(currentModuleId.replace('module', ''));
                return moduleNum >= cat.range[0] && moduleNum <= cat.range[1];
            });
            if (category) {
                breadcrumbContainer.innerHTML = `${homeLink} <span class="mx-2">/</span> <span class="font-bold">${category.title}</span> <span class="mx-2">/</span> <span class="text-orange-500">${moduleTitle}</span>`;
            } else {
                breadcrumbContainer.innerHTML = `${homeLink} <span class="mx-2">/</span> ${moduleTitle}`;
            }
        }
    }
    
    function setupNotesListener(id) {
        const notesTextarea = document.getElementById(`notes-module-${id}`);
        if (notesTextarea) {
            notesTextarea.addEventListener('keyup', () => {
                localStorage.setItem('note-' + id, notesTextarea.value);
            });
        }
    }

    function goToHomePage() {
        localStorage.removeItem('gateBombeiroLastModule'); 
        if (contentArea) contentArea.innerHTML = `<div class="text-center py-8"><div class="floating inline-block p-5 bg-red-100 dark:bg-red-900/50 rounded-full mb-6"><i class="fas fa-fire-extinguisher text-6xl text-red-600"></i></div><h2 class="text-4xl font-bold mb-4 text-blue-900 dark:text-white">Torne-se um Profissional de Elite</h2><p class="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">Bem-vindo ao <strong class="font-bold text-orange-500 dark:text-orange-400">Curso de Formação para Bombeiro Civil e Brigadista</strong>.</p><button id="start-course" class="action-button pulse text-lg"><i class="fas fa-play-circle mr-2"></i> Iniciar Curso Agora</button></div>`;
        
        document.getElementById('module-nav')?.classList.add('hidden');
        document.querySelectorAll('.module-list-item.active').forEach(i => i.classList.remove('active'));
        currentModuleId = null;
        closeSidebar();
        updateBreadcrumbs();
        
        // Re-attach start button listener
        document.getElementById('start-course')?.addEventListener('click', () => {
            loadModuleContent('module1');
            const firstBtn = document.querySelector('#desktop-module-container .accordion-button');
            if(firstBtn) {
                 firstBtn.classList.add('active');
                 if(firstBtn.nextElementSibling) firstBtn.nextElementSibling.style.maxHeight = firstBtn.nextElementSibling.scrollHeight + "px";
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
    function toggleTheme() {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        updateThemeIcons();
    }
    function updateThemeIcons() {
        const icon = document.documentElement.classList.contains('dark') ? 'fa-sun' : 'fa-moon';
        document.querySelectorAll('#dark-mode-toggle-desktop i, #bottom-nav-theme i').forEach(i => i.className = `fas ${icon} text-2xl`);
    }

    function shuffleArray(array) {
        let newArray = [...array]; 
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
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
        sidebar?.classList.remove('open');
        sidebarOverlay?.classList.remove('show');
        setTimeout(() => sidebarOverlay?.classList.add('hidden'), 300);
    }
    function openSidebar() {
        sidebar?.classList.add('open');
        sidebarOverlay?.classList.remove('hidden');
        setTimeout(() => sidebarOverlay?.classList.add('show'), 10);
    }
    function populateModuleLists() {
        const html = getModuleListHTML();
        document.getElementById('desktop-module-container').innerHTML = html;
        document.getElementById('mobile-module-container').innerHTML = html;
    }
    function getModuleListHTML() {
        let html = `<h2 class="text-2xl font-semibold mb-5 flex items-center text-blue-900 dark:text-white"><i class="fas fa-list-ul mr-3 text-orange-500"></i> Conteúdo</h2><div class="module-accordion-container space-y-2">`;
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
        document.getElementById('progress-text').textContent = `${p.toFixed(0)}%`;
        document.getElementById('completed-modules-count').textContent = completedModules.length;
        const bar = document.getElementById('progress-bar-minimal');
        if (bar) bar.style.width = `${p}%`;
        updateModuleListStyles();
        checkAchievements();
        if (totalModules > 0 && completedModules.length === totalModules) showCongratulations();
    }

    function showCongratulations() {
        document.getElementById('congratulations-modal')?.classList.add('show');
        document.getElementById('modal-overlay')?.classList.add('show');
        if(typeof confetti === 'function') confetti({particleCount:150, spread:90, origin:{y:0.6},zIndex:200});
    }
    function updateModuleListStyles() {
        document.querySelectorAll('.module-list-item').forEach(i => i.classList.toggle('completed', completedModules.includes(i.dataset.module)));
    }
    function checkAchievements() {
        let newNotification = false;
        for(const key in moduleCategories) {
            const cat = moduleCategories[key];
            let allComplete = true;
            for(let i = cat.range[0]; i <= cat.range[1]; i++) {
                if (!moduleContent[`module${i}`] || !completedModules.includes(`module${i}`)) { allComplete = false; break; }
            }
            if (allComplete && !notifiedAchievements.includes(key)) {
                showAchievementModal(cat.achievementTitle, cat.icon);
                notifiedAchievements.push(key);
                newNotification = true;
            }
            document.querySelectorAll(`#ach-cat-${key}`).forEach(el => el.classList.toggle('unlocked', allComplete));
        }
        if (newNotification) localStorage.setItem('gateBombeiroNotifiedAchievements_v3', JSON.stringify(notifiedAchievements));
    }
    function showAchievementModal(title, iconClass) {
        const iconContainer = document.getElementById('ach-modal-icon-container');
        const titleEl = document.getElementById('ach-modal-title');
        if (!achievementModal || !iconContainer) return;
        iconContainer.innerHTML = `<i class="${iconClass}"></i>`;
        titleEl.textContent = `Conquista: ${title}`;
        achievementModal.classList.add('show');
        achievementOverlay.classList.add('show');
        if(typeof confetti === 'function') confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, zIndex: 103 });
    }
    function hideAchievementModal() {
        achievementModal?.classList.remove('show');
        achievementOverlay?.classList.remove('show');
    }

    function setupConcludeButtonListener() {
        if (!currentModuleId) return;
        const b = document.querySelector(`.conclude-button[data-module="${currentModuleId}"]`);
        if(b) {
            b.replaceWith(b.cloneNode(true));
            const newB = document.querySelector(`.conclude-button[data-module="${currentModuleId}"]`);
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
            if(typeof confetti === 'function') confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, zIndex: 2000 });
        }
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

    init();
});
