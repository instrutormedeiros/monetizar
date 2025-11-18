/* firebase-init.js
   Autenticação, Sessão Única e Bloqueio de CPF Duplicado.
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

  // --- 2. CADASTRO (Com Verificação de CPF Duplicado) ---
  window.FirebaseCourse.signUpWithEmail = async function(name, email, password, cpf){
    if (!window.__fbAuth || !window.__fbDB) throw new Error('Firebase off.');

    // A. Limpa o CPF (apenas números)
    const cleanCPF = cpf.replace(/\D/g, '');
    
    // B. Verifica se o CPF já existe na coleção auxiliar 'cpfs'
    const cpfDoc = await __fbDB.collection('cpfs').doc(cleanCPF).get();
    if (cpfDoc.exists) {
        throw new Error('CPF_ALREADY_IN_USE');
    }

    // C. Cria o usuário no Authentication (Email único é garantido aqui)
    const userCred = await __fbAuth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;
    
    const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const newSessionId = generateSessionId();

    // D. Salva os dados em LOTE (Batch) para garantir que tudo seja salvo ou nada seja
    const batch = __fbDB.batch();
    
    // Referência do Usuário
    const userRef = __fbDB.collection('users').doc(uid);
    batch.set(userRef, {
      name: name,
      email: email,
      cpf: cpf, 
      clean_cpf: cleanCPF,
      status: 'trial',
      acesso_ate: trialEndDate.toISOString(),
      session_id: newSessionId
    });

    // Referência do CPF (Trava de duplicidade)
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
    const uid = userCred.user.uid;

    const newSessionId = generateSessionId();
    await __fbDB.collection('users').doc(uid).update({ session_id: newSessionId });
    localStorage.setItem('current_session_id', newSessionId);

    return userCred.user;
  };

  // --- 4. UTILS ---
  window.FirebaseCourse.getUserDoc = async function(uid){
    const doc = await __fbDB.collection('users').doc(uid).get();
    if (!doc.exists) throw new Error("Usuário não encontrado no banco.");
    return doc.data();
  };
  
  window.FirebaseCourse.signOutUser = async function() {
    if (!window.__fbAuth) return;
    await __fbAuth.signOut();
    localStorage.removeItem('current_session_id');
    window.location.reload(); 
  };

  // --- 5. CHECK AUTH ---
  window.FirebaseCourse.checkAuth = function(onLoginSuccess) {
    if (!window.__fbAuth) return;
    
    const loginModal = document.getElementById('name-prompt-modal');
    const loginOverlay = document.getElementById('name-modal-overlay');
    const expiredModal = document.getElementById('expired-modal');

    __fbAuth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userData = await FirebaseCourse.getUserDoc(user.uid);
          
          // Sessão Única
          const localSession = localStorage.getItem('current_session_id');
          if (userData.session_id && localSession && userData.session_id !== localSession) {
              alert("Sua conta foi aberta em outro dispositivo. Você foi desconectado.");
              await FirebaseCourse.signOutUser();
              return;
          }
          if (!localSession) localStorage.setItem('current_session_id', userData.session_id);

          // Validade
          const acessoAte = new Date(userData.acesso_ate);
          const hoje = new Date();

          if (acessoAte > hoje || userData.status === 'paid') {
            onLoginSuccess(user, userData);
          } else {
            // EXPIRED: Mostra modal de renovação
            if(expiredModal) {
                expiredModal.classList.add('show');
                // Se certifica que o modal de login sumiu
                loginModal?.classList.remove('show');
            }
            if(loginOverlay) loginOverlay.classList.add('show');
          }
          
        } catch (error) {
          console.error("Erro:", error);
          await FirebaseCourse.signOutUser();
        }
      } else {
        if(loginModal) loginModal.classList.add('show');
        if(loginOverlay) loginOverlay.classList.add('show');
      }
    });
  };
})();
