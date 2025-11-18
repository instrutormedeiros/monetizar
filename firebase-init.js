/* firebase-init.js
   Funções de autenticação, controle de sessão e acesso.
*/

(function(){
  window.FirebaseCourse = window.FirebaseCourse || {};

  // Helper para gerar ID de sessão aleatório
  function generateSessionId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // --- 1. INICIALIZAÇÃO ---
  window.FirebaseCourse.init = function(config){
    if (!config || !window.firebase) {
      console.warn('Firebase não inicializado. Verifique as configurações.');
      return;
    }
    try {
      if (!firebase.apps.length) {
          firebase.initializeApp(config);
      }
      window.__fbAuth = firebase.auth();
      window.__fbDB = firebase.firestore();
      console.log('Firebase Iniciado com Sucesso.');
    } catch(e){
      console.error('Erro ao iniciar Firebase:', e);
    }
  };

  // --- 2. CADASTRO (Com CPF e Sessão Única) ---
  window.FirebaseCourse.signUpWithEmail = async function(name, email, password, cpf){
    if (!window.__fbAuth || !window.__fbDB) throw new Error('Firebase não inicializado.');

    // 1. Cria o usuário no Authentication
    const userCred = await __fbAuth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;
    
    // 2. Gera expiração e Sessão ID
    const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const newSessionId = generateSessionId();

    // 3. Salva no Firestore
    await __fbDB.collection('users').doc(uid).set({
      name: name,
      email: email,
      cpf: cpf, // Salva o CPF
      status: 'trial',
      acesso_ate: trialEndDate.toISOString(),
      session_id: newSessionId // Segurança anti-empréstimo
    });
    
    // Salva sessão localmente
    localStorage.setItem('current_session_id', newSessionId);
    
    console.log(`Usuário ${uid} criado com trial.`);
    return { uid };
  };

  // --- 3. LOGIN (Com Sessão Única) ---
  window.FirebaseCourse.signInWithEmail = async function(email, password){
    if (!window.__fbAuth) throw new Error('Firebase não inicializado.');
    
    // 1. Autentica
    const userCred = await __fbAuth.signInWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;

    // 2. Gera NOVA sessão e atualiza no banco (Derruba outros logins)
    const newSessionId = generateSessionId();
    await __fbDB.collection('users').doc(uid).update({
        session_id: newSessionId
    });

    // 3. Salva sessão localmente
    localStorage.setItem('current_session_id', newSessionId);

    return userCred.user;
  };

  // --- 4. BUSCAR DADOS DO USUÁRIO ---
  window.FirebaseCourse.getUserDoc = async function(uid){
    if (!window.__fbDB) throw new Error('Firebase não inicializado.');
    const doc = await __fbDB.collection('users').doc(uid).get();
    if (!doc.exists) {
        throw new Error("Documento de usuário não encontrado no Firestore.");
    }
    return doc.data();
  };
  
  // --- 5. LOGOUT ---
  window.FirebaseCourse.signOutUser = async function() {
    if (!window.__fbAuth) return;
    await __fbAuth.signOut();
    localStorage.removeItem('current_session_id');
    console.log("Usuário deslogado.");
    window.location.reload(); 
  };

  // --- 6. CHECK AUTH (Valida Acesso e Sessão Única) ---
  window.FirebaseCourse.checkAuth = function(onLoginSuccess) {
    if (!window.__fbAuth) return;
    
    const loginModal = document.getElementById('name-prompt-modal');
    const loginOverlay = document.getElementById('name-modal-overlay');
    const expiredModal = document.getElementById('expired-modal');

    __fbAuth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userData = await FirebaseCourse.getUserDoc(user.uid);
          
          // VERIFICAÇÃO DE SEGURANÇA (Sessão Única)
          const localSession = localStorage.getItem('current_session_id');
          // Se a sessão do banco for diferente da local, alguém logou em outro lugar
          if (userData.session_id && localSession && userData.session_id !== localSession) {
              alert("Sua conta foi acessada em outro dispositivo. Você foi desconectado.");
              await FirebaseCourse.signOutUser();
              return;
          }
          
          // Se não tinha sessão local (ex: limpou cache), sincroniza
          if (!localSession) {
              localStorage.setItem('current_session_id', userData.session_id);
          }

          // VERIFICAÇÃO DE VALIDADE
          const acessoAte = new Date(userData.acesso_ate);
          const hoje = new Date();

          if (acessoAte > hoje) {
            onLoginSuccess(user, userData);
          } else {
            console.warn("Acesso expirado.");
            if(expiredModal) expiredModal.classList.add('show');
            if(loginOverlay) loginOverlay.classList.add('show');
            // Se expirado, não fecha o modal de login nem inicia o app
          }
          
        } catch (error) {
          console.error("Erro de verificação:", error);
          await FirebaseCourse.signOutUser();
        }
        
      } else {
        if(loginModal) loginModal.classList.add('show');
        if(loginOverlay) loginOverlay.classList.add('show');
      }
    });
  };

})();
