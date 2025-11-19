/* === ARQUIVO app_final.js (Animação Completa Restaurada) === */

document.addEventListener('DOMContentLoaded', () => {

    // --- VERIFICAÇÃO DE SEGURANÇA ---
    if (typeof moduleContent === 'undefined' || typeof moduleCategories === 'undefined' || typeof questionSources === 'undefined') {
        document.getElementById('main-header')?.classList.add('hidden');
        document.querySelector('footer')?.classList.add('hidden');
        const contentAreaError = document.getElementById('content-area');
        if (contentAreaError) {
            contentAreaError.innerHTML = `<div class="text-center p-10"><h2 class="text-2xl text-red-600">Erro Crítico: Dados não carregados.</h2><button onclick="location.reload()" class="mt-4 p-2 bg-blue-500 text-white rounded">Recarregar</button></div>`;
        }
        return;
    }

    // --- VARIÁVEIS GLOBAIS ---
    const contentArea = document.getElementById('content-area');
    const totalModules = Object.keys(moduleContent).length;
    let completedModules = JSON.parse(localStorage.getItem('gateBombeiroCompletedModules_v3')) || [];
    let notifiedAchievements = JSON.parse(localStorage.getItem('gateBombeiroNotifiedAchievements_v3')) || [];
    let currentModuleId = null;
    let cachedQuestionBanks = {}; 

    // --- SELETORES ---
    const toastContainer = document.getElementById('toast-container');
    const sidebar = document.getElementById('off-canvas-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const printWatermark = document.getElementById('print-watermark');
    const breadcrumbContainer = document.getElementById('breadcrumb-container');
    const loadingSpinner = document.getElementById('loading-spinner');

    // --- INICIALIZAÇÃO ---
    function init() {
        setupProtection();
        setupTheme();
        
        const firebaseConfig = {
          apiKey: "AIzaSyDNet1QC72jr79u8JpnFMLBoPI26Re6o3g",
          authDomain: "projeto-bravo-charlie-app.firebaseapp.com",
          projectId: "projeto-bravo-charlie-app",
          storageBucket: "projeto-bravo-charlie-app.firebasestorage.app",
          messagingSenderId: "26745008470",
          appId: "1:26745008470:web:5f25965524c646b3e666f7",
          measurementId: "G-Y7VZFQ0D9F"
        };
        
        if (typeof FirebaseCourse !== 'undefined') {
            FirebaseCourse.init(firebaseConfig);
            setupAuthEventListeners(); 
            document.getElementById('logout-button')?.addEventListener('click', FirebaseCourse.signOutUser);
            document.getElementById('logout-expired-button')?.addEventListener('click', FirebaseCourse.signOutUser);
            FirebaseCourse.checkAuth((user, userData) => onLoginSuccess(user, userData));
        }

        setupHeaderScroll();
        setupRippleEffects();
    }
    
    function onLoginSuccess(user, userData) {
        if (document.body.getAttribute('data-app-ready') === 'true') return;
        document.body.setAttribute('data-app-ready', 'true');

        document.getElementById('name-prompt-modal')?.classList.remove('show');
        document.getElementById('name-modal-overlay')?.classList.remove('show');
        document.getElementById('expired-modal')?.classList.remove('show');
        
        const greetingEl = document.getElementById('welcome-greeting');
        if(greetingEl) greetingEl.textContent = `Olá, ${userData.name}!`;
        if (printWatermark) printWatermark.textContent = `Licenciado para ${userData.name} (CPF: ${userData.cpf || '...'}) - Proibida a Cópia`;

        document.getElementById('total-modules').textContent = totalModules;
        document.getElementById('course-modules-count').textContent = totalModules;
        
        populateModuleLists();
        updateProgress();
        addEventListeners(); 
        handleInitialLoad();
    }

    function setupAuthEventListeners() {
        const nameField = document.getElementById('name-field-container');
        const cpfField = document.getElementById('cpf-field-container'); 
        const nameInput = document.getElementById('name-input');
        const cpfInput = document.getElementById('cpf-input'); 
        const emailInput = document.getElementById('email-input');
        const passwordInput = document.getElementById('password-input');
        const feedback = document.getElementById('auth-feedback');
        const loginGroup = document.getElementById('login-button-group');
        const signupGroup = document.getElementById('signup-button-group');
        const authTitle = document.getElementById('auth-title');
        const authMsg = document.getElementById('auth-message');
        const btnShowLogin = document.getElementById('show-login-button');
        const btnShowSignup = document.getElementById('show-signup-button');
        const btnLogin = document.getElementById('login-button');
        const btnSignup = document.getElementById('signup-button');
        const btnOpenPayLogin = document.getElementById('open-payment-login-btn');
        const btnClosePayModal = document.getElementById('close-payment-modal-btn');
        const expiredModal = document.getElementById('expired-modal');
        const loginModal = document.getElementById('name-prompt-modal');

        btnOpenPayLogin?.addEventListener('click', () => {
             loginModal.classList.remove('show'); 
             expiredModal.classList.add('show'); 
             btnClosePayModal.classList.remove('hidden');
        });
        btnClosePayModal?.addEventListener('click', () => {
             expiredModal.classList.remove('show'); 
             loginModal.classList.add('show'); 
        });

        btnShowSignup?.addEventListener('click', () => {
            loginGroup.classList.add('hidden');
            signupGroup.classList.remove('hidden');
            nameField.classList.remove('hidden');
            cpfField.classList.remove('hidden'); 
            authTitle.textContent = "Criar Nova Conta";
            authMsg.textContent = "Preencha seus dados para iniciar o trial.";
            feedback.textContent = "";
        });
        
        btnShowLogin?.addEventListener('click', () => {
            loginGroup.classList.remove('hidden');
            signupGroup.classList.add('hidden');
            nameField.classList.add('hidden');
            cpfField.classList.add('hidden'); 
            authTitle.textContent = "Acessar Plataforma";
            authMsg.textContent = "Entre com seu e-mail e senha.";
            feedback.textContent = "";
        });
        
        btnLogin?.addEventListener('click', async () => {
            const email = emailInput.value;
            const password = passwordInput.value;
            if (!email || !password) {
                feedback.textContent = "Preencha e-mail e senha.";
                return;
            }
            feedback.textContent = "Entrando...";
            try {
                localStorage.removeItem('my_session_id'); 
                await FirebaseCourse.signInWithEmail(email, password);
                feedback.textContent = "Verificando acesso...";
            } catch (error) {
                feedback.textContent = "Erro ao entrar: Verifique seus dados.";
            }
        });
        
        btnSignup?.addEventListener('click', async () => {
            const name = nameInput.value;
            const email = emailInput.value;
            const password = passwordInput.value;
            const cpf = cpfInput.value;
            if (!name || !email || !password || !cpf) {
                feedback.textContent = "Preencha todos os campos.";
                return;
            }
            feedback.textContent = "Criando conta...";
            try {
                await FirebaseCourse.signUpWithEmail(name, email, password, cpf);
                feedback.textContent = "Conta criada! Iniciando...";
            } catch (error) {
                feedback.textContent = error.message;
            }
        });
    }

    function handleInitialLoad() {
        const lastModule = localStorage.getItem('gateBombeiroLastModule');
        if (lastModule) loadModuleContent(lastModule);
        else goToHomePage();
    }

    async function loadQuestionBank(moduleId) {
        if (cachedQuestionBanks[moduleId]) return cachedQuestionBanks[moduleId];
        if (typeof QUIZ_DATA !== 'undefined' && QUIZ_DATA[moduleId]) {
            cachedQuestionBanks[moduleId] = QUIZ_DATA[moduleId];
            return QUIZ_DATA[moduleId];
        }
        return null;
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
                const shuffled = shuffleArray(allQuestions).slice(0, count);
                let quizHtml = `<hr><h3 class="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Exercícios de Fixação</h3>`;
                shuffled.forEach((q, index) => {
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
                    <h4 class="text-xl font-bold mb-3 text-secondary dark:text-gray-200">Anotações Pessoais</h4>
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
            closeSidebar();
        }, 300);
    }

    // --- FUNÇÃO DE ANIMAÇÃO COMPLETA (CONFETE + PARTÍCULAS DOURADAS) ---
    function triggerSuccessParticles(clickEvent, element) {
      // 1. Confetti
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 28,
          spread: 70,
          startVelocity: 45,
          origin: {
            x: (clickEvent && clickEvent.clientX) ? clickEvent.clientX / window.innerWidth : 0.5,
            y: (clickEvent && clickEvent.clientY) ? clickEvent.clientY / window.innerHeight : 0.5
          },
          colors: ['#FFD700', '#FFCF66', '#F7A325'],
          zIndex: 3000
        });
      }

      // 2. Partículas Douradas (O código que você queria de volta)
      const container = document.createElement('div');
      container.className = 'gold-particles-container';
      container.style.position = 'fixed'; 
      container.style.left = '0';
      container.style.top = '0';
      container.style.pointerEvents = 'none';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.zIndex = '4000';
      document.body.appendChild(container);

      // Coordenadas
      const rect = (element && element.getBoundingClientRect) ? element.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2, width: 0, height: 0 };
      const cx = rect.left + (rect.width / 2);
      const cy = rect.top + (rect.height / 2);

      // Criar 12 partículas
      for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'gold-particle';
        p.style.left = `${cx}px`;
        p.style.top = `${cy}px`;
        p.style.transform = 'translate(-50%, -50%)';
        
        container.appendChild(p);

        const dx = (Math.random() - 0.5) * 180;
        const dy = -Math.random() * 150 - 20;
        const rot = Math.random() * 360;

        p.animate(
          [
            { transform: `translate(-50%, -50%) translate(0px, 0px) rotate(0deg)`, opacity: 1 },
            { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 }
          ],
          {
            duration: 900 + Math.random() * 400,
            easing: 'cubic-bezier(.2,.7,.2,1)'
          }
        );
        
        setTimeout(() => p.remove(), 1500);
      }
      
      setTimeout(() => { if (container && container.parentNode) container.remove(); }, 1800);
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
        const feedbackArea = document.getElementById(`feedback-${questionId}`);
        const optionsGroup = o.closest('.quiz-options-group');
        
        optionsGroup.querySelectorAll(`.quiz-option[data-question-id="${questionId}"]`).forEach(opt => {
            opt.disabled = true;
            if (opt.dataset.answer === correctAnswer) opt.classList.add('correct');
        });
        
        if (selectedAnswer === correctAnswer) {
            o.classList.add('correct');
            feedbackArea.innerHTML = `<div class="explanation mt-2 text-green-600 font-bold"><i class="fas fa-check-circle"></i> Correto! ${questionData.explanation}</div>`;
            triggerSuccessParticles(e, o); // CHAMA A ANIMAÇÃO COMPLETA
        } else {
            o.classList.add('incorrect');
            feedbackArea.innerHTML = `<div class="explanation mt-2 text-red-600 font-bold"><i class="fas fa-times-circle"></i> Incorreto. ${questionData.explanation}</div>`;
        }
        feedbackArea.classList.remove('hidden');
    }
    
    function updateBreadcrumbs(moduleTitle = 'Início') {
        const bc = document.getElementById('breadcrumb-container');
        bc.innerHTML = `<a href="#" id="home-breadcrumb" class="text-blue-500 hover:underline">Início</a> / ${moduleTitle}`;
        document.getElementById('home-breadcrumb')?.addEventListener('click', (e) => { e.preventDefault(); goToHomePage(); });
    }
    
    function setupNotesListener(id) {
        const el = document.getElementById(`notes-module-${id}`);
        if (el) el.addEventListener('keyup', () => localStorage.setItem('note-' + id, el.value));
    }

    function goToHomePage() {
        localStorage.removeItem('gateBombeiroLastModule'); 
        contentArea.innerHTML = `<div class="text-center py-10"><h2 class="text-3xl font-bold text-blue-900 dark:text-white">Bem-vindo ao Curso</h2><p class="mb-6 text-gray-600">Selecione um módulo para começar.</p><button id="start-course" class="action-button">Iniciar</button></div>`;
        document.getElementById('module-nav')?.classList.add('hidden');
        document.getElementById('start-course')?.addEventListener('click', () => loadModuleContent('module1'));
    }

    function setupProtection() {
        document.addEventListener('contextmenu', e => e.preventDefault());
    }

    function setupTheme() {
        const isDark = localStorage.getItem('theme') === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
    }

    function toggleTheme() {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }

    function shuffleArray(array) {
        return array.sort(() => Math.random() - 0.5);
    }
    
    function getCategoryColor(moduleId) {
        return 'text-orange-500'; 
    }
    
    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    }
    function openSidebar() {
        if (sidebar) sidebar.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.classList.add('show');
    }
    function populateModuleLists() {
        document.getElementById('desktop-module-container').innerHTML = getModuleListHTML();
        document.getElementById('mobile-module-container').innerHTML = getModuleListHTML();
    }
    function getModuleListHTML() {
        let html = `<div class="space-y-2">`;
        for (const k in moduleCategories) {
            const cat = moduleCategories[k];
            html += `<button class="accordion-button w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded font-bold">${cat.title}</button><div class="accordion-panel hidden p-2">`;
            for (let i = cat.range[0]; i <= cat.range[1]; i++) {
                const m = moduleContent[`module${i}`];
                if(m) html += `<div class="module-list-item p-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 rounded" data-module="${m.id}">${m.title}</div>`;
            }
            html += `</div>`;
        }
        return html + `</div>`;
    }

    function updateProgress() {
        const p = ((completedModules.length / totalModules) * 100).toFixed(0);
        document.getElementById('progress-text').textContent = `${p}%`;
        document.getElementById('progress-bar-minimal').style.width = `${p}%`;
    }

    function setupConcludeButtonListener() {
        const b = document.querySelector(`.conclude-button[data-module="${currentModuleId}"]`);
        if(b) {
            if(completedModules.includes(currentModuleId)){
                b.disabled=true; b.textContent='Concluído';
            } else {
                b.onclick = () => handleConcludeButtonClick(b);
            }
        }
    }
    function handleConcludeButtonClick(b) {
        if (!completedModules.includes(currentModuleId)) {
            completedModules.push(currentModuleId);
            localStorage.setItem('gateBombeiroCompletedModules_v3', JSON.stringify(completedModules));
            updateProgress();
            b.disabled = true; b.textContent = 'Concluído';
            if(typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
    }

    function updateActiveModuleInList() {
        document.querySelectorAll('.module-list-item').forEach(i => i.classList.toggle('bg-orange-100', i.dataset.module === currentModuleId));
    }
    
    function updateNavigationButtons() {
        const prev = document.getElementById('prev-module');
        const next = document.getElementById('next-module');
        const n = parseInt(currentModuleId.replace('module',''));
        if(prev) prev.disabled = n === 1;
        if(next) next.disabled = n === totalModules;
    }
    
    function setupQuizListeners() {
        document.querySelectorAll('.quiz-option').forEach(o => o.addEventListener('click', handleQuizOptionClick));
    }

    function addEventListeners() {
        document.body.addEventListener('click', e => {
            if (e.target.closest('.module-list-item')) {
                loadModuleContent(e.target.closest('.module-list-item').dataset.module);
            }
            if (e.target.classList.contains('accordion-button')) {
                e.target.nextElementSibling.classList.toggle('hidden');
            }
        });
        document.getElementById('prev-module')?.addEventListener('click', () => {
            const n = parseInt(currentModuleId.replace('module',''));
            if(n > 1) loadModuleContent(`module${n-1}`);
        });
        document.getElementById('next-module')?.addEventListener('click', () => {
            const n = parseInt(currentModuleId.replace('module',''));
            if(n < totalModules) loadModuleContent(`module${n+1}`);
        });
        
        document.getElementById('mobile-menu-button')?.addEventListener('click', openSidebar);
        document.getElementById('close-sidebar-button')?.addEventListener('click', closeSidebar);
        document.getElementById('home-button-desktop')?.addEventListener('click', goToHomePage);
        document.getElementById('dark-mode-toggle-desktop')?.addEventListener('click', toggleTheme);
    }

    function setupHeaderScroll() {
        window.addEventListener('scroll', () => {
            const h = document.getElementById('main-header');
            if(window.scrollY > 50) h.classList.add('shadow-md'); else h.classList.remove('shadow-md');
        });
    }

    function setupRippleEffects() {
        document.addEventListener('click', e => {
            const t = e.target.closest('.action-button');
            if(t) {
                const r = document.createElement('span');
                r.classList.add('ripple');
                t.appendChild(r);
                setTimeout(() => r.remove(), 600);
            }
        });
    }

    init();
});
