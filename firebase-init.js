/* firebase-init.js
   Funções de autenticação, CPF único e sessão única para o Projeto Bravo Charlie.
   VERSÃO CORRIGIDA FINAL: Uso de Batch Write para garantir gravação atômica (CPF + User).
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
    if (!window.__fbAuth || !window.__fbDB) {
      throw new Error('Firebase não inicializado.');
    }

    // 1. Limpa e Valida CPF
    const cpf = cpfRaw.replace(/[^\d]+/g,'');
    if (!validarCPF(cpf)) {
        throw new Error("CPF inválido. Verifique os números.");
    }

    // 2. Verifica se CPF já existe no banco (Leitura rápida)
    const cpfDocRef = __fbDB.collection('cpfs').doc(cpf);
    const cpfSnapshot = await cpfDocRef.get();
    
    if (cpfSnapshot.exists) {
        throw new Error("Este CPF já está cadastrado em outra conta.");
    }

    // 3. Cria o usuário no Authentication (Isso gera o UID)
    const userCred = await __fbAuth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;
    
    // 4. Define a data de expiração (30 dias a partir de agora)
    const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sessionId = Date.now().toString();

    try {
        // --- AQUI ESTÁ A CORREÇÃO MÁGICA: BATCH WRITE ---
        // Criamos um lote de gravações. Ou grava TUDO ou não grava NADA.
        const batch = __fbDB.batch();

        // A) Prepara a gravação na pasta CPFS
        batch.set(cpfDocRef, { uid: uid });

        // B) Prepara a gravação na pasta USERS
        const userDocRef = __fbDB.collection('users').doc(uid);
        batch.set(userDocRef, {
          name: name,
          email: email,
          cpf: cpf,
          status: 'trial', // 'trial', 'paid', 'expired'
          acesso_ate: trialEndDate.toISOString(),
          current_session_id: sessionId
        });

        // C) Executa as duas gravações simultaneamente
        await batch.commit();
        
        console.log(`Cadastro completo. Usuário ${uid} e CPF ${cpf} gravados com sucesso.`);
        return { uid, acesso_ate: trialEndDate.toISOString() };

    } catch (error) {
        console.error("Erro na gravação do banco:", error);
        // Se der erro no banco, deletamos o usuário do Auth para não ficar "zumbi" (login sem dados)
        await userCred.user.delete();
        throw new Error("Erro ao salvar dados. Tente novamente.");
    }
  };

  // --- 3. LOGIN (com geração de nova sessão) ---
  window.FirebaseCourse.signInWithEmail = async function(email, password){
    if (!window.__fbAuth) throw new Error('Firebase não inicializado.');
    
    const userCred = await __fbAuth.signInWithEmailAndPassword(email, password);
    
    // Atualiza o Session ID no Firestore para derrubar logins anteriores
    const newSessionId = Date.now().toString();
    
    try {
        await __fbDB.collection('users').doc(userCred.user.uid).update({
            current_session_id: newSessionId
        });
    } catch (e) {
        console.warn("Aviso: Não foi possível atualizar sessão única (pode ser atraso na criação).", e);
    }

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
    
    let unsubscribeUserDoc = null; 

    __fbAuth.onAuthStateChanged(async (user) => {
      if (user) {
        console.log("Auth detectado:", user.uid);
        
        unsubscribeUserDoc = __fbDB.collection('users').doc(user.uid)
            .onSnapshot((doc) => {
                // Se o documento não existe, aguarda (pode ser delay do batch)
                if (!doc.exists) {
                    console.warn("Documento do usuário ainda não disponível. Aguardando sincronização...");
                    return; 
                }
                
                const userData = doc.data();
                const acessoAte = new Date(userData.acesso_ate);
                const hoje = new Date();

                if (hoje > acessoAte) {
                    console.warn("Acesso expirado!");
                    if(expiredModal) {
                        expiredModal.classList.add('show');
                        if(loginOverlay) loginOverlay.classList.add('show');
                    }
                    return;
                }

                const localSession = localStorage.getItem('my_session_id');
                
                if (!localSession) {
                    localStorage.setItem('my_session_id', userData.current_session_id);
                    onLoginSuccess(user, userData);
                } else {
                    if (userData.current_session_id && localSession !== userData.current_session_id) {
                        console.warn("Sessão duplicada detectada. Deslogando...");
                        alert("Sua conta foi acessada em outro dispositivo. Você será desconectado.");
                        localStorage.removeItem('my_session_id');
                        if (unsubscribeUserDoc) unsubscribeUserDoc();
                        FirebaseCourse.signOutUser();
                        return;
                    }
                    onLoginSuccess(user, userData);
                }
                
            }, (error) => {
                console.error("Erro no listener de usuário:", error);
                // Se for erro de permissão crítico, desloga
                if (error.code === 'permission-denied') {
                    FirebaseCourse.signOutUser();
                }
            });

      } else {
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        localStorage.removeItem('my_session_id');
        
        console.log("Nenhum usuário logado. Mostrando modal de login.");
        if(loginModal) loginModal.classList.add('show');
        if(loginOverlay) loginOverlay.classList.add('show');
      }
    });
  };

})();
