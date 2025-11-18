/* firebase-init.js
   Autenticação, Sessão Única em Tempo Real e Bloqueio de CPF.
*/

(function(){
  window.FirebaseCourse = window.FirebaseCourse || {};

  // Gera um ID único para cada login
  function generateSessionId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // --- 1. INICIALIZAÇÃO ---
  window.FirebaseCourse.init = function(config){
    if (!config || !window.firebase) return;
    if (!firebase.apps.length) firebase.initializeApp(config);
    window.__fbAuth = firebase.auth();
    window.__fbDB = firebase.firestore();
    console.log('Firebase Iniciado.');
  };

  // --- 2. CADASTRO (Com Verificação de CPF Duplicado) ---
  window.FirebaseCourse.signUpWithEmail = async function(name, email, password, cpf){
    if (!window.__fbAuth || !window.__fbDB) throw new Error('Firebase off.');

    // A. Limpa o CPF (apenas números)
    const cleanCPF = cpf.replace(/\D/g, '');
    
    // B. Verifica se o CPF já existe na coleção auxiliar 'cpfs'
    // Isso impede que alguém crie outra conta com o mesmo CPF
    const cpfDoc = await __fbDB.collection('cpfs').doc(cleanCPF).get();
    if (cpfDoc.exists) {
        throw new Error('CPF_ALREADY_IN_USE');
    }

    // C. Cria o usuário no Authentication (O Firebase já bloqueia email duplicado nativamente)
    const userCred = await __fbAuth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;
    
    // Define validade de 30 dias
    const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const newSessionId = generateSessionId();

    // D. Salva os dados em LOTE (Batch) para garantir integridade
    const batch = __fbDB.batch();
    
    // 1. Salva dados do usuário
    const userRef = __fbDB.collection('users').doc(uid);
    batch.set(userRef, {
      name: name,
      email: email,
      cpf: cpf, 
      clean_cpf: cleanCPF,
      status: 'trial', // 'trial' ou 'paid'
      acesso_ate: trialEndDate.toISOString(),
      session_id: newSessionId
    });

    // 2. Salva o CPF na coleção de bloqueio
    const cpfRef = __fbDB.collection('cpfs').doc(cleanCPF);
    batch.set(cpfRef, { uid: uid });

    await batch.commit();
    
    // Salva sessão localmente para comparação futura
    localStorage.setItem('current_session_id', newSessionId);
    return { uid };
  };

  // --- 3. LOGIN (Derruba sessões anteriores) ---
  window.FirebaseCourse.signInWithEmail = async function(email, password){
    if (!window.__fbAuth) throw new Error('Firebase off.');
    
    // Autentica
    const userCred = await __fbAuth.signInWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;

    // Gera NOVA sessão
    const newSessionId = generateSessionId();
    
    // Atualiza no banco (isso fará o outro dispositivo perceber que a sessão mudou)
    await __fbDB.collection('users').doc(uid).update({ session_id: newSessionId });
    
    // Salva a nova sessão neste dispositivo
    localStorage.setItem('current_session_id', newSessionId);

    return userCred.user;
  };

  // --- 4. UTILS ---
  window.FirebaseCourse.getUserDoc = async function(uid){
    const doc = await __fbDB.collection('users').doc(uid).get();
    if (!doc.exists) throw new Error("Usuário não encontrado no banco.");
    return doc.data();
  };
  
  // Função de Sair (Logout)
  window.FirebaseCourse.signOutUser = async function() {
    if (!window.__fbAuth) return;
    await __fbAuth.signOut();
    localStorage.removeItem('current_session_id');
    window.location.reload(); 
  };

  // --- 5. MONITORAMENTO EM TEMPO REAL (O Coração da Segurança) ---
  window.FirebaseCourse.checkAuth = function(onLoginSuccess) {
    if (!window.__fbAuth) return;
    
    const loginModal = document.getElementById('name-prompt-modal');
    const loginOverlay = document.getElementById('name-modal-overlay');
    const expiredModal = document.getElementById('expired-modal');
    
    let unsubscribeSnapshot = null;

    __fbAuth.onAuthStateChanged(async (user) => {
      if (user) {
        // Se o usuário logou, começamos a "vigiar" o documento dele no banco
        if (unsubscribeSnapshot) unsubscribeSnapshot(); // Limpa vigias anteriores

        const userRef = __fbDB.collection('users').doc(user.uid);
        
        // onSnapshot: Roda sempre que algo muda no banco (ex: sessão mudou, ou pagou)
        unsubscribeSnapshot = userRef.onSnapshot((doc) => {
            if (!doc.exists) return; 
            const userData = doc.data();
            const localSession = localStorage.getItem('current_session_id');

            // 1. SEGURANÇA ANTI-EMPRÉSTIMO
            // Se a sessão no banco for diferente da sessão deste navegador, derruba!
            if (userData.session_id && localSession && userData.session_id !== localSession) {
                alert("Sua conta foi conectada em outro dispositivo. Você será desconectado.");
                FirebaseCourse.signOutUser();
                return;
            }
            
            // Se acabou de logar e não tem sessão local, sincroniza
            if (!localSession && userData.session_id) {
                localStorage.setItem('current_session_id', userData.session_id);
            }

            // 2. VALIDADE DO ACESSO
            const acessoAte = new Date(userData.acesso_ate);
            const hoje = new Date();
            
            // Se a data é válida OU o status é 'paid' (pago)
            if (acessoAte > hoje || userData.status === 'paid') {
                // LIBERA O ACESSO
                onLoginSuccess(user, userData);
                
                // Esconde modais de bloqueio se estiverem abertos
                if(expiredModal) expiredModal.classList.remove('show');
                if(loginOverlay) loginOverlay.classList.remove('show');
            } else {
                // BLOQUEIA O ACESSO (Expirado)
                console.warn("Acesso expirado.");
                if(expiredModal) expiredModal.classList.add('show');
                if(loginOverlay) loginOverlay.classList.add('show');
                if(loginModal) loginModal.classList.remove('show'); // Tira o login, deixa o expirado
            }
        }, (error) => {
            console.error("Erro no monitoramento:", error);
        });

      } else {
        // Se não tem usuário (deslogado), para de vigiar e mostra login
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        if(loginModal) loginModal.classList.add('show');
        if(loginOverlay) loginOverlay.classList.add('show');
      }
    });
  };
})();
