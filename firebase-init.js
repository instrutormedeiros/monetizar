/* firebase-init.js
   Funções de autenticação e sessão com BATCH WRITE para evitar erros de cadastro.
*/

(function(){
  window.FirebaseCourse = window.FirebaseCourse || {};

  // --- 1. INICIALIZAÇÃO ---
  window.FirebaseCourse.init = function(config){
    if (!config || !window.firebase) return;
    if (!firebase.apps.length) firebase.initializeApp(config);
    window.__fbAuth = firebase.auth();
    window.__fbDB = firebase.firestore();
    window.__fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  };

  // --- VALIDAÇÃO CPF ---
  function validarCPF(cpf) {
      cpf = cpf.replace(/[^\d]+/g,'');
      if(cpf.length != 11 || /^(\d)\1+$/.test(cpf)) return false;
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

  // --- 2. CADASTRO BLINDADO (BATCH WRITE) ---
  window.FirebaseCourse.signUpWithEmail = async function(name, email, password, cpfRaw){
    const cpf = cpfRaw.replace(/[^\d]+/g,'');
    if (!validarCPF(cpf)) throw new Error("CPF inválido.");

    // Verifica CPF
    const cpfDocRef = __fbDB.collection('cpfs').doc(cpf);
    const cpfSnapshot = await cpfDocRef.get();
    if (cpfSnapshot.exists) throw new Error("CPF já cadastrado.");

    // Cria Auth
    const userCred = await __fbAuth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;
    const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const sessionId = Date.now().toString();

    try {
        // GRAVAÇÃO ATÔMICA (Tudo ou Nada)
        const batch = __fbDB.batch();
        batch.set(cpfDocRef, { uid: uid });
        
        const userDocRef = __fbDB.collection('users').doc(uid);
        batch.set(userDocRef, {
          name: name,
          email: email,
          cpf: cpf,
          status: 'trial',
          acesso_ate: trialEndDate,
          current_session_id: sessionId
        });

        await batch.commit(); // Executa a gravação
        return { uid, acesso_ate: trialEndDate };

    } catch (error) {
        await userCred.user.delete(); // Se falhar no banco, deleta o login para não travar
        throw new Error("Erro ao salvar dados. Tente novamente.");
    }
  };

  // --- 3. LOGIN ---
  window.FirebaseCourse.signInWithEmail = async function(email, password){
    const userCred = await __fbAuth.signInWithEmailAndPassword(email, password);
    const newSessionId = Date.now().toString();
    // Atualiza sessão sem travar o login se falhar
    __fbDB.collection('users').doc(userCred.user.uid).update({ current_session_id: newSessionId }).catch(()=>{});
    return userCred.user;
  };
  
  // --- 4. LOGOUT ---
  window.FirebaseCourse.signOutUser = async function() {
    await __fbAuth.signOut();
    window.location.reload();
  };

  // --- 5. MONITORAMENTO DE SESSÃO ---
  window.FirebaseCourse.checkAuth = function(onLoginSuccess) {
    const loginModal = document.getElementById('name-prompt-modal');
    const loginOverlay = document.getElementById('name-modal-overlay');
    const expiredModal = document.getElementById('expired-modal');
    let unsubscribe = null;

    __fbAuth.onAuthStateChanged(async (user) => {
      if (user) {
        // Monitora o documento do usuário em tempo real
        unsubscribe = __fbDB.collection('users').doc(user.uid).onSnapshot((doc) => {
            if (!doc.exists) return; // Aguarda criação se for novo cadastro
            
            const userData = doc.data();
            const hoje = new Date();
            const validade = new Date(userData.acesso_ate);

            // Verifica validade
            if (hoje > validade) {
                if(expiredModal) {
                    expiredModal.classList.add('show');
                    if(loginOverlay) loginOverlay.classList.add('show');
                }
                return;
            }

            // Verifica sessão única
            const localSession = localStorage.getItem('my_session_id');
            if (!localSession) {
                localStorage.setItem('my_session_id', userData.current_session_id);
                onLoginSuccess(user, userData);
            } else if (localSession !== userData.current_session_id) {
                alert("Conta acessada em outro dispositivo. Desconectando...");
                localStorage.removeItem('my_session_id');
                FirebaseCourse.signOutUser();
            } else {
                onLoginSuccess(user, userData);
            }
        });
      } else {
        if (unsubscribe) unsubscribe();
        localStorage.removeItem('my_session_id');
        if(loginModal) loginModal.classList.add('show');
        if(loginOverlay) loginOverlay.classList.add('show');
      }
    });
  };
})();
