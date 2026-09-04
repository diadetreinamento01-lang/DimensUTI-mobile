// ==========================================
// DIMENSUTI MOBILE 4.0
// AUTENTICAÇÃO E CONTROLE DE ACESSO
// ==========================================

var usuarioAtual = window.usuarioAtual || null;
window.usuarioAtual = usuarioAtual;


// ==========================================
// VERIFICAR USUÁRIO LOGADO
// ==========================================

async function verificarSessao() {

  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Erro ao verificar sessão:", error);
    return;
  }

  if (session && session.user) {

    usuarioAtual = session.user;

    mostrarAplicativo();

    await atualizarStatusAssinatura();

  } else {

    mostrarTelaLogin();

  }

}


// ==========================================
// MOSTRAR TELA DE LOGIN
// ==========================================

function mostrarTelaLogin() {

  const authScreen = document.getElementById("auth-screen");
  const appContainer = document.getElementById("app-container");

  if (authScreen) {
    authScreen.style.display = "flex";
  }

  if (appContainer) {
    appContainer.style.display = "none";
  }

}


// ==========================================
// MOSTRAR APLICATIVO
// ==========================================

function mostrarAplicativo() {

  const authScreen = document.getElementById("auth-screen");
  const appContainer = document.getElementById("app-container");

  if (authScreen) {
    authScreen.style.display = "none";
  }

  if (appContainer) {
    appContainer.style.display = "block";
  }

}


// ==========================================
// CRIAR CONTA
// ==========================================

async function criarConta(nome, email, senha) {

  try {

    const {
      data,
      error
    } = await supabaseClient.auth.signUp({

      email: email,

      password: senha,

      options: {

        data: {
          nome: nome
        },

        emailRedirectTo:
          window.location.origin

      }

    });


    if (error) {
      throw error;
    }


    alert(
      "Conta criada com sucesso! Verifique seu e-mail para confirmar seu cadastro."
    );


    return {
      sucesso: true,
      data: data
    };


  } catch (erro) {

    console.error("Erro ao criar conta:", erro);

    alert(
      erro.message ||
      "Não foi possível criar sua conta."
    );


    return {
      sucesso: false,
      erro: erro
    };

  }

}


// ==========================================
// LOGIN
// ==========================================

async function fazerLogin(email, senha) {

  try {

    const {
      data,
      error
    } = await supabaseClient.auth.signInWithPassword({

      email: email,

      password: senha

    });


    if (error) {
      throw error;
    }


    usuarioAtual = data.user;

    mostrarAplicativo();

    await atualizarStatusAssinatura();


    return {
      sucesso: true
    };


  } catch (erro) {

    console.error("Erro no login:", erro);

    alert(
      erro.message ||
      "E-mail ou senha incorretos."
    );


    return {
      sucesso: false,
      erro: erro
    };

  }

}


// ==========================================
// LOGOUT
// ==========================================

async function fazerLogout() {

  const confirmar = confirm(
    "Deseja realmente sair da sua conta?"
  );

  if (!confirmar) return;


  try {

    const { error } =
      await supabaseClient.auth.signOut();

    if (error) throw error;


    usuarioAtual = null;

    mostrarTelaLogin();


  } catch (erro) {

    console.error("Erro ao sair:", erro);

    alert("Não foi possível sair da conta.");

  }

}


// ==========================================
// RECUPERAR SENHA
// ==========================================

async function recuperarSenha(email) {

  if (!email) {

    alert(
      "Digite seu e-mail para recuperar a senha."
    );

    return;

  }


  try {

    const {
      error
    } = await supabaseClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: window.location.origin
      }
    );


    if (error) throw error;


    alert(
      "Enviamos um link para recuperação da sua senha."
    );


  } catch (erro) {

    console.error(
      "Erro ao recuperar senha:",
      erro
    );

    alert(
      erro.message ||
      "Não foi possível enviar o e-mail."
    );

  }

}


// ==========================================
// STATUS DA ASSINATURA
// ==========================================

async function atualizarStatusAssinatura() {

  if (!usuarioAtual) return;


  try {

    const {
      data,
      error
    } = await supabaseClient
      .from("assinaturas")
      .select("*")
      .eq("user_id", usuarioAtual.id)
      .single();


    if (error) {

      console.error(
        "Erro ao buscar assinatura:",
        error
      );

      return;

    }


    window.assinaturaAtual = data;


    atualizarIndicadorTrial(data);


  } catch (erro) {

    console.error(
      "Erro ao atualizar assinatura:",
      erro
    );

  }

}


// ==========================================
// ATUALIZAR INDICADOR DO TESTE
// ==========================================

function atualizarIndicadorTrial(assinatura) {

  const indicador =
    document.getElementById("trial-indicator");

  if (!indicador) return;


  const agora = new Date();


  // Assinatura ativa

  if (
    assinatura.status === "active" &&
    assinatura.vencimento_assinatura &&
    new Date(
      assinatura.vencimento_assinatura
    ) > agora
  ) {

    indicador.innerHTML =
      "✅ Assinatura ativa";

    return;

  }


  // Período gratuito

  const usados =
    assinatura["plantões_gratuitos_usados"] || 0;

  const restantes =
    Math.max(0, 3 - usados);


  if (restantes > 0) {

    indicador.innerHTML =
      `🎁 ${restantes} plantão(ões) gratuito(s) restante(s)`;

  } else {

    indicador.innerHTML =
      "🔒 Período gratuito encerrado";

  }

}


// ==========================================
// VERIFICAR SE PODE UTILIZAR O APP
// ==========================================

function usuarioTemAcesso() {

  if (!window.assinaturaAtual) {
    return true;
  }


  const assinatura =
    window.assinaturaAtual;


  // Assinatura anual ativa

  if (
    assinatura.status === "active" &&
    assinatura.vencimento_assinatura &&
    new Date(
      assinatura.vencimento_assinatura
    ) > new Date()
  ) {

    return true;

  }


  // Teste gratuito

  const usados =
    assinatura["plantões_gratuitos_usados"] || 0;


  return usados < 3;

}


// ==========================================
// CONSUMIR UM PLANTÃO GRATUITO
// ==========================================

async function finalizarPlantaoComControle() {

  if (!usuarioAtual) {

    alert(
      "Você precisa estar conectado à sua conta."
    );

    return {
      permitido: false
    };

  }


  try {

    const {
      data,
      error
    } = await supabaseClient.rpc(
      "finalizar_plantao_gratuito"
    );


    if (error) {
      throw error;
    }


    await atualizarStatusAssinatura();


    return data;


  } catch (erro) {

    console.error(
      "Erro ao finalizar plantão:",
      erro
    );


    alert(
      "Não foi possível atualizar o status do plantão."
    );


    return {
      permitido: false
    };

  }

}


// ==========================================
// OBSERVAR ALTERAÇÃO DE LOGIN
// ==========================================

supabaseClient.auth.onAuthStateChange(
  async (event, session) => {

    if (session && session.user) {

      usuarioAtual = session.user;

      mostrarAplicativo();

      setTimeout(
        atualizarStatusAssinatura,
        500
      );

    } else {

      usuarioAtual = null;

      mostrarTelaLogin();

    }

  }
);


// ==========================================
// INICIAR AUTENTICAÇÃO
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  verificarSessao
);
// ==========================================
// FUNÇÕES DOS BOTÕES DA TELA
// ==========================================

// Mostrar cadastro
function mostrarCadastro() {

  document.getElementById("login-form").style.display = "none";

  document.getElementById("register-form").style.display = "block";

}


// Mostrar login
function mostrarLogin() {

  document.getElementById("register-form").style.display = "none";

  document.getElementById("login-form").style.display = "block";

}


// Botão ENTRAR
async function entrarNoSistema() {

  const email =
    document.getElementById("login-email").value.trim();

  const senha =
    document.getElementById("login-password").value;


  if (!email || !senha) {

    alert("Digite seu e-mail e sua senha.");

    return;

  }


  const resultado =
    await fazerLogin(email, senha);


  if (resultado.sucesso) {

    document.getElementById("login-password").value = "";

  }

}


// Botão CRIAR CONTA
async function registrarUsuario() {

  const nome =
    document.getElementById("register-name").value.trim();

  const email =
    document.getElementById("register-email").value.trim();

  const senha =
    document.getElementById("register-password").value;


  if (!nome) {

    alert("Digite seu nome.");

    return;

  }


  if (!email) {

    alert("Digite seu e-mail.");

    return;

  }


  if (!senha || senha.length < 6) {

    alert(
      "Sua senha precisa ter pelo menos 6 caracteres."
    );

    return;

  }


  const resultado =
    await criarConta(nome, email, senha);


  if (resultado.sucesso) {

    // Limpar formulário

    document.getElementById("register-name").value = "";

    document.getElementById("register-email").value = "";

    document.getElementById("register-password").value = "";


    // Voltar para login

    mostrarLogin();

  }

}


// Recuperação de senha
async function esqueciMinhaSenha() {

  const email =
    document.getElementById("login-email").value.trim();


  if (!email) {

    alert(
      "Digite primeiro seu e-mail no campo acima."
    );

    return;

  }


  await recuperarSenha(email);

}
