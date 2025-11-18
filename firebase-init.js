/* firebase-init.js
   Autenticação, Sessão Única em Tempo Real e Bloqueio de CPF.
*/

(function(){
  window.FirebaseCourse = window.FirebaseCourse || {};

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

  // --- 2. CADASTRO ---
  window.FirebaseCourse.signUpWithEmail = async function(name, email, password, cpf){
    if (!window.__fbAuth || !window.__fbDB) throw new Error('Firebase off.');

    // Limpa CPF e verifica duplicidade
    const cleanCPF = cpf.replace(/\D/g, '');
    const cpfDoc = await __fbDB.collection('cpfs').doc(cleanCPF).get();
    if (cpfDoc.exists) throw new Error('CPF_ALREADY_IN_USE');

    // Cria usuário
    const userCred = await __fbAuth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;
    
    const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const newSessionId = generateSessionId();

    // Salva em lote (Batch)
    const batch = __fbDB.batch();
    const userRef = __fbDB.collection('users').doc(uid);
    batch.set(userRef, {
      name: name, email: email, cpf: cpf, clean_cpf: cleanCPF,
      status: 'trial', acesso_ate: trialEndDate.toISOString(),
      session_id: newSessionId
    });
    const cpfRef = __fbDB.collection('cpfs').doc(cleanCPF);
    batch.set(cpfRef, { uid: uid });
    await batch.commit();
    
    localStorage.setItem('current_session_id', newSessionId);
    return { uid };
  };

  // --- 3. LOGIN ---
  window.FirebaseCourse.signInWithEmail = async function(email, password){
    if (!window.__fbAuth) throw new Error('Firebase off.');
    const userCred = await __fbAuth.signInWithEmailAndPassword(email, password);
    
    // Atualiza sessão no banco para derrubar outros logins
    const newSessionId = generateSessionId();
    await __fbDB.collection('users').doc(userCred.user.uid).update({ session_id: newSessionId });
    localStorage.setItem('current_session_id', newSessionId);

    return userCred.user;
  };

  // --- 4. LOGOUT ---
  window.FirebaseCourse.signOutUser = async function() {
    if (!window.__fbAuth) return;
    await __fbAuth.signOut();
    localStorage.removeItem('current_session_id');
    window.location.reload(); 
  };

  // --- 5. MONITORAMENTO EM TEMPO REAL (Sessão Única) ---
  window.FirebaseCourse.checkAuth = function(onLoginSuccess) {
    if (!window.__fbAuth) return;
    
    const loginModal = document.getElementById('name-prompt-modal');
    const loginOverlay = document.getElementById('name-modal-overlay');
    const expiredModal = document.getElementById('expired-modal');
    
    let unsubscribeSnapshot = null;

    __fbAuth.onAuthStateChanged(async (user) => {
      if (user) {
        // Se logou, ativa o monitoramento em tempo real do documento do usuário
        if (unsubscribeSnapshot) unsubscribeSnapshot(); // Limpa anterior se houver

        const userRef = __fbDB.collection('users').doc(user.uid);
        unsubscribeSnapshot = userRef.onSnapshot((doc) => {
            if (!doc.exists) return; // Documento não existe (ainda criando?)
            const userData = doc.data();
            const localSession = localStorage.getItem('current_session_id');

            // 1. Checa Sessão Única (Derruba se mudou no banco)
            if (userData.session_id && localSession && userData.session_id !== localSession) {
                alert("Sua conta foi conectada em outro dispositivo. Você será desconectado.");
                FirebaseCourse.signOutUser();
                return;
            }
            
            // Se não tem sessão local (ex: limpou cache), sincroniza com a do banco
            if (!localSession && userData.session_id) {
                localStorage.setItem('current_session_id', userData.session_id);
            }

            // 2. Checa Validade do Acesso
            const acessoAte = new Date(userData.acesso_ate);
            const hoje = new Date();
            
            if (acessoAte > hoje || userData.status === 'paid') {
                // Tudo certo, garante que o app está rodando (idempotente)
                // A função onLoginSuccess verifica se já rodou para não duplicar
                onLoginSuccess(user, userData);
                // Garante que modais de bloqueio sumam
                if(expiredModal) expiredModal.classList.remove('show');
                if(loginOverlay) loginOverlay.classList.remove('show');
            } else {
                // Expirado
                console.warn("Acesso expirado.");
                if(expiredModal) expiredModal.classList.add('show');
                if(loginOverlay) loginOverlay.classList.add('show');
                // Esconde o modal de login se estiver aberto
                if(loginModal) loginModal.classList.remove('show');
            }
        }, (error) => {
            console.error("Erro no monitoramento:", error);
        });

      } else {
        // Deslogado
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        if(loginModal) loginModal.classList.add('show');
        if(loginOverlay) loginOverlay.classList.add('show');
      }
    });
  };
})();
