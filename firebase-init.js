/* firebase-init.js
   Funções de autenticação, CPF único e sessão única para o Projeto Bravo Charlie.
*/

(function(){
  window.FirebaseCourse = window.FirebaseCourse || {};

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
      // Persistência local para manter o usuário logado
      window.__fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      console.log('Firebase Iniciado com Sucesso.');
    } catch(e){
      console.error('Erro ao iniciar Firebase:', e);
    }
  };

  // --- UTILITÁRIO: Validação de CPF ---
  function validarCPF(cpf) {
      cpf = cpf.replace(/[^\d]+/g,'');
      if(cpf == '') return false;
      // Elimina CPFs invalidos conhecidos
      if (cpf.length != 11 || 
          cpf == "00000000000" || 
          cpf == "11111111111" || 
          cpf == "22222222222" || 
          cpf == "33333333333" || 
          cpf == "44444444444" || 
          cpf == "55555555555" || 
          cpf == "66666666666" || 
          cpf == "77777777777" || 
          cpf == "88888888888" || 
          cpf == "99999999999")
              return false;
      // Valida 1o digito
      let add = 0;
      for (let i=0; i < 9; i ++) add += parseInt(cpf.charAt(i)) * (10 - i);
      let rev = 11 - (add % 11);
      if (rev == 10 || rev == 11) rev = 0;
      if (rev != parseInt(cpf.charAt(9))) return false;
      // Valida 2o digito
      add = 0;
      for (let i = 0; i < 10; i ++) add += parseInt(cpf.charAt(i)) * (11 - i);
      rev = 11 - (add % 11);
      if (rev == 10 || rev == 11) rev = 0;
      if (rev != parseInt(cpf.charAt(10))) return false;
      return true;
  }

  // --- 2. CADASTRO (com CPF e Trial de 30 dias) ---
  window.FirebaseCourse.signUpWithEmail = async function(name, email, password, cpfRaw){
    if (!window.__fbAuth || !window.__fbDB) {
      throw new Error('Firebase não inicializado.');
    }

    // 1. Limpa e Valida CPF
    const cpf = cpfRaw.replace(/[^\d]+/g,'');
    if (!validarCPF(cpf)) {
        throw new Error("CPF inválido. Verifique os números.");
    }

    // 2. Verifica se CPF já existe (Regra de Unicidade no Firestore)
    // A regra de segurança permite leitura em /cpfs/{cpf} para qualquer um
    const cpfDocRef = __fbDB.collection('cpfs').doc(cpf);
    const cpfSnapshot = await cpfDocRef.get();
    
    if (cpfSnapshot.exists) {
        throw new Error("Este CPF já está cadastrado em outra conta.");
    }

    // 3. Cria o usuário no Authentication
    const userCred = await __fbAuth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;
    
    // 4. Define a data de expiração (30 dias a partir de agora)
    const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sessionId = Date.now().toString(); // ID único para esta sessão

    try {
        // 5. Reserva o CPF
        await cpfDocRef.set({ uid: uid });

        // 6. Cria o documento do Usuário
        await __fbDB.collection('users').doc(uid).set({
          name: name,
          email: email,
          cpf: cpf,
          status: 'trial', // 'trial', 'paid', 'expired'
          acesso_ate: trialEndDate.toISOString(),
          current_session_id: sessionId // Controle de sessão única
        });
        
        console.log(`Usuário ${uid} criado com trial até ${trialEndDate.toLocaleDateString()}.`);
        return { uid, acesso_ate: trialEndDate.toISOString() };

    } catch (error) {
        // Se der erro no banco, tenta deletar o usuário do Auth para não ficar "zumbi"
        await userCred.user.delete();
        throw error;
    }
  };

  // --- 3. LOGIN (com geração de nova sessão) ---
  window.FirebaseCourse.signInWithEmail = async function(email, password){
    if (!window.__fbAuth) throw new Error('Firebase não inicializado.');
    
    const userCred = await __fbAuth.signInWithEmailAndPassword(email, password);
    
    // Atualiza o Session ID no Firestore para derrubar logins anteriores
    const newSessionId = Date.now().toString();
    await __fbDB.collection('users').doc(userCred.user.uid).update({
        current_session_id: newSessionId
    });

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
    console.log("Usuário deslogado.");
    window.location.reload(); // Recarrega a página para mostrar o login
  };

  // --- 6. O "PORTÃO" DE VERIFICAÇÃO E SESSÃO ÚNICA ---
  window.FirebaseCourse.checkAuth = function(onLoginSuccess) {
    if (!window.__fbAuth) {
        console.error("Auth não iniciado. Chamando checkAuth cedo demais.");
        return;
    }
    
    const loginModal = document.getElementById('name-prompt-modal');
    const loginOverlay = document.getElementById('name-modal-overlay');
    const expiredModal = document.getElementById('expired-modal');
    
    let unsubscribeUserDoc = null; // Para cancelar o listener quando deslogar

    __fbAuth.onAuthStateChanged(async (user) => {
      if (user) {
        // --- USUÁRIO ESTÁ LOGADO ---
        console.log("Auth detectado:", user.uid);
        
        // Listener em Tempo Real para detectar Sessão Dupla ou Expiração
        unsubscribeUserDoc = __fbDB.collection('users').doc(user.uid)
            .onSnapshot((doc) => {
                if (!doc.exists) {
                    console.error("Usuário sem documento.");
                    FirebaseCourse.signOutUser();
                    return;
                }
                
                const userData = doc.data();
                
                // 1. Verifica Validade do Acesso (Trial ou Pago)
                const acessoAte = new Date(userData.acesso_ate);
                const hoje = new Date();

                if (hoje > acessoAte) {
                    console.warn("Acesso expirado!");
                    if (unsubscribeUserDoc) unsubscribeUserDoc(); // Para de ouvir
                    // Mostra modal de expirado e bloqueia interação
                    if(expiredModal) {
                        expiredModal.classList.add('show');
                        // Garante que o overlay de login também apareça para bloquear fundo
                        if(loginOverlay) loginOverlay.classList.add('show');
                    }
                    return;
                }

                // 2. Verifica Sessão Única (Se o ID no banco for diferente, alguém logou em outro lugar)
                const localSession = localStorage.getItem('my_session_id');
                
                if (!localSession) {
                    // Primeira vez carregando após login
                    localStorage.setItem('my_session_id', userData.current_session_id);
                    // Libera o app
                    onLoginSuccess(user, userData);
                } else {
                    // Já temos uma sessão local. É igual a do banco?
                    if (localSession !== userData.current_session_id) {
                        console.warn("Sessão duplicada detectada. Deslogando...");
                        alert("Sua conta foi acessada em outro dispositivo. Você será desconectado.");
                        localStorage.removeItem('my_session_id');
                        if (unsubscribeUserDoc) unsubscribeUserDoc();
                        FirebaseCourse.signOutUser();
                        return;
                    }
                    // Se for igual, tudo certo, garante que o app tá rodando
                    onLoginSuccess(user, userData);
                }
                
            }, (error) => {
                console.error("Erro no listener de usuário:", error);
            });

      } else {
        // --- USUÁRIO ESTÁ DESLOGADO ---
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        localStorage.removeItem('my_session_id');
        
        console.log("Nenhum usuário logado. Mostrando modal de login.");
        if(loginModal) loginModal.classList.add('show');
        if(loginOverlay) loginOverlay.classList.add('show');
      }
    });
  };

})();
