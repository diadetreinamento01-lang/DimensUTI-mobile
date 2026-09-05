// ==========================================
// CADÊ A ESCALA? 4.2
// Dia de Treinamento
// ==========================================

const STORAGE_KEY = "dimensuti_mobile_v41";
const STORAGE_ANTIGOS = [
  "dimensuti_mobile_v30",
  "dimensuti_mobile_v2"
];

let deferredPrompt = null;


// ==========================================
// ESTADO PRINCIPAL
// ==========================================

const state = {

  config: {
    hospital: "",
    setor: "",
    data: new Date().toISOString().slice(0, 10),
    turno: "Diurno",
    enfermeiro: "",
    coren: "",
    qtdLeitos: 10,
    tipoLeito: "numerico",
    identificadores: ""
  },

  leitos: [],

  profissionais: [
    {
      id: gerarId(),
      nome: "Enfermeiro",
      tipo: "Enfermeiro",
      ativo: true,
      situacao: "presente",
      cobrindo: ""
    },
    {
      id: gerarId(),
      nome: "Técnico 1",
      tipo: "Técnico",
      ativo: true,
      situacao: "presente",
      cobrindo: ""
    },
    {
      id: gerarId(),
      nome: "Técnico 2",
      tipo: "Técnico",
      ativo: true,
      situacao: "presente",
      cobrindo: ""
    },
    {
      id: gerarId(),
      nome: "Técnico 3",
      tipo: "Técnico",
      ativo: true,
      situacao: "presente",
      cobrindo: ""
    },
    {
      id: gerarId(),
      nome: "Técnico 4",
      tipo: "Técnico",
      ativo: true,
      situacao: "presente",
      cobrindo: ""
    },
    {
      id: gerarId(),
      nome: "Técnico 5",
      tipo: "Técnico",
      ativo: true,
      situacao: "presente",
      cobrindo: ""
    }
  ],

  // Distribuição do plantão atual
  dimensionamento: null,

  // Primeira distribuição manual salva como referência
  escalaBase: null,

  plantao: {
    acontecimentos: "",
    passagem: ""
  },

  historico: [],

  rodizio: {
    ativo: false,
    tipo: "sequencial",
    passos: 1,
    sequencia: [],
    ultimoPreDimensionamento: null,
    proximo: null
  },

  alteracoesEscala: [],

  // Profissional que assume temporariamente a função de Apoio
  // apenas no plantão atual. Não altera a escala-base.
  apoioTemporarioId: null,

  ui: {
    dark: false
  }
};


// ==========================================
// CONSTANTES
// ==========================================

const GRAVIDADES = {
  0: "Mínima",
  1: "Baixa",
  2: "Moderada",
  3: "Alta",
  4: "Muito alta",
  5: "Crítico"
};

const RESPIRACOES = [
  "AA",
  "AA/CN",
  "AA/Máscara",
  "TOT VM",
  "TQT VM",
  "TQT Tenda",
  "TQT AA"
];

const DISPOSITIVOS = [
  "AVP",
  "SVD",
  "CVC",
  "CDL",
  "PAI",
  "GTT",
  "SNE",
  "SNG"
];

const PRECAUCOES = [
  "Padrão",
  "Vigilância",
  "Contato",
  "Aerossóis",
  "Gotículas"
];


// ==========================================
// UTILIDADES
// ==========================================

function gerarId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9)
  );
}


function escapeHtml(valor) {
  return String(valor ?? "").replace(
    /[&<>"']/g,
    caractere =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[caractere]
  );
}


function copiarObjeto(objeto) {
  return JSON.parse(JSON.stringify(objeto));
}


function toast(mensagem) {

  const elemento = document.getElementById("toast");

  if (!elemento) {
    console.log(mensagem);
    return;
  }

  elemento.textContent = mensagem;
  elemento.classList.add("show");

  setTimeout(() => {
    elemento.classList.remove("show");
  }, 2600);
}


// ==========================================
// LEITOS
// ==========================================

function gerarIdentificadores(config) {

  const quantidade = Math.max(
    1,
    Math.min(500, Number(config.qtdLeitos) || 10)
  );

  if (config.tipoLeito === "alfabetico") {

    return Array.from(
      { length: quantidade },
      (_, indice) => {

        if (indice < 26) {
          return String.fromCharCode(65 + indice);
        }

        return String(indice + 1);
      }
    );
  }


  if (config.tipoLeito === "personalizado") {

    const lista = (config.identificadores || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

    if (lista.length) {
      return lista.slice(0, quantidade);
    }
  }


  return Array.from(
    { length: quantidade },
    (_, indice) => String(indice + 1)
  );
}


function criarLeito(id) {

  return {
    id,
    diagnostico: "",
    gravidade: 2,
    respiracao: "AA",
    dispositivos: [],
    precaucoes: ["Padrão"],
    pendenciasExames: "",
    acontecimentos: "",
    condutas: "",
    passagem: "",

    avaliacaoImportada: false,
    importadoEm: null,
    confirmadoNoPlantaoAtual: true
  };
}


function normalizarLeitos() {

  const identificadores = gerarIdentificadores(state.config);

  const antigos = Object.fromEntries(
    state.leitos.map(leito => [
      String(leito.id),
      leito
    ])
  );

  state.leitos = identificadores.map(id => {

    if (antigos[String(id)]) {

      return {
        ...criarLeito(id),
        ...antigos[String(id)],
        id
      };
    }

    return criarLeito(id);
  });
}


// ==========================================
// MIGRAÇÃO DE DADOS ANTIGOS
// ==========================================

function normalizarProfissionais() {

  state.profissionais = (state.profissionais || []).map(profissional => {

    if (profissional.tipo === "Assistencial") {
      profissional.tipo = "Técnico";
    }

    return {
      id: profissional.id || gerarId(),
      nome: profissional.nome || "",
      tipo: profissional.tipo || "Técnico",
      ativo:
        profissional.ativo !== false,
      situacao:
        profissional.situacao || "presente",
      cobrindo:
        profissional.cobrindo || ""
    };
  });
}


function migrarDimensionamentoAntigo() {

  if (!state.dimensionamento?.grupos) {
    return;
  }

  state.dimensionamento.grupos =
    state.dimensionamento.grupos.map(grupo => {

      const profissionalEncontrado =
        state.profissionais.find(
          profissional =>
            profissional.nome === grupo.profissional
        );

      return {
        profissionalId:
          grupo.profissionalId ||
          profissionalEncontrado?.id ||
          gerarId(),

        profissional:
          grupo.profissional || "",

        tipo:
          grupo.tipo || "Técnico",

        leitos:
          (grupo.leitos || []).map(item => {

            if (
              typeof item === "string" ||
              typeof item === "number"
            ) {
              return {
                id: String(item),
                peso: calcularIndiceOperacional(
                  state.leitos.find(
                    leito =>
                      String(leito.id) === String(item)
                  ) || {}
                )
              };
            }

            return {
              id: String(item.id),
              peso:
                Number(item.peso) ||
                calcularIndiceOperacional(
                  state.leitos.find(
                    leito =>
                      String(leito.id) === String(item.id)
                  ) || {}
                )
            };
          }),

        carga: Number(grupo.carga) || 0
      };
    });

  recalcularCargasDimensionamento();
}


// ==========================================
// CARREGAR E SALVAR
// ==========================================

function carregarDados() {

  try {

    let dadosSalvos =
      localStorage.getItem(STORAGE_KEY);

    if (!dadosSalvos) {

      for (const chave of STORAGE_ANTIGOS) {

        dadosSalvos =
          localStorage.getItem(chave);

        if (dadosSalvos) {
          break;
        }
      }
    }


    if (dadosSalvos) {

      const salvo = JSON.parse(dadosSalvos);

      state.config = {
        ...state.config,
        ...(salvo.config || {})
      };

      state.leitos =
        salvo.leitos || [];

      state.profissionais =
        salvo.profissionais ||
        state.profissionais;

      state.dimensionamento =
        salvo.dimensionamento || null;

      state.escalaBase =
        salvo.escalaBase || null;

      state.plantao = {
        ...state.plantao,
        ...(salvo.plantao || {})
      };

      state.historico =
        salvo.historico || [];

      state.rodizio = {
        ...state.rodizio,
        ...(salvo.rodizio || {})
      };

      state.alteracoesEscala =
        salvo.alteracoesEscala || [];

      state.apoioTemporarioId =
        salvo.apoioTemporarioId || null;

      state.ui = {
        ...state.ui,
        ...(salvo.ui || {})
      };
    }

  } catch (erro) {

    console.warn(
      "Erro ao carregar dados:",
      erro
    );
  }


  normalizarProfissionais();
  normalizarLeitos();
  migrarDimensionamentoAntigo();

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );
}


function salvarDados(mensagem = true) {

  lerConfiguracoesDaTela();

  const acontecimentos =
    document.getElementById(
      "plantao-acontecimentos"
    );

  const passagem =
    document.getElementById(
      "plantao-passagem"
    );

  if (acontecimentos) {
    state.plantao.acontecimentos =
      acontecimentos.value;
  }

  if (passagem) {
    state.plantao.passagem =
      passagem.value;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );

  if (mensagem) {
    toast("Dados salvos neste dispositivo.");
  }

  atualizarDashboard();
}


// ==========================================
// NAVEGAÇÃO
// ==========================================

function showTab(id) {

  document
    .querySelectorAll(".tab")
    .forEach(tab =>
      tab.classList.remove("active")
    );

  document
    .getElementById("tab-" + id)
    ?.classList.add("active");

  document
    .querySelectorAll(".nav-item")
    .forEach(item =>
      item.classList.toggle(
        "active",
        item.dataset.tab === id
      )
    );


  if (id === "leitos") {
    renderizarLeitos();
  }

  if (id === "dimensionamento") {
    renderizarProfissionais();
    renderizarResultadoDimensionamento();
  }

  if (id === "plantao") {
    renderizarPreviaPlantao();
  }

  if (id === "config") {
    preencherConfiguracoes();
  }

  if (id === "historico") {
    renderizarHistorico();
  }

  if (id === "inicio") {
    atualizarDashboard();
  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ==========================================
// CONFIGURAÇÕES
// ==========================================

function preencherConfiguracoes() {

  const config = state.config;

  [
    "hospital",
    "setor",
    "data",
    "turno",
    "enfermeiro",
    "coren",
    "qtdLeitos",
    "tipoLeito",
    "identificadores"
  ].forEach(chave => {

    const elemento =
      document.getElementById(
        "cfg-" + chave
      );

    if (elemento) {
      elemento.value =
        config[chave] ?? "";
    }
  });

  alternarPersonalizado();
}


function lerConfiguracoesDaTela() {

  const obter = id =>
    document.getElementById(id);

  if (!obter("cfg-hospital")) {
    return;
  }

  state.config = {

    hospital:
      obter("cfg-hospital")
        .value.trim(),

    setor:
      obter("cfg-setor")
        .value.trim(),

    data:
      obter("cfg-data")
        .value,

    turno:
      obter("cfg-turno")
        .value,

    enfermeiro:
      obter("cfg-enfermeiro")
        .value.trim(),

    coren:
      obter("cfg-coren")
        .value.trim(),

    qtdLeitos:
      Number(
        obter("cfg-qtd-leitos").value
      ) || 10,

    tipoLeito:
      obter("cfg-tipo-leito")
        .value,

    identificadores:
      obter("cfg-identificadores")
        .value.trim()
  };
}


function alternarPersonalizado() {

  const campo =
    document.getElementById(
      "identificadores-personalizados"
    );

  const tipo =
    document.getElementById(
      "cfg-tipo-leito"
    )?.value;

  campo?.classList.toggle(
    "hidden",
    tipo !== "personalizado"
  );
}


function aplicarConfiguracaoLeitos() {

  lerConfiguracoesDaTela();

  normalizarLeitos();

  limparLeitosInexistentesDaEscala();

  salvarDados(false);

  renderizarLeitos();
  renderizarResultadoDimensionamento();
  atualizarDashboard();

  toast(
    "Configuração dos pacientes/leitos aplicada."
  );
}


function limparLeitosInexistentesDaEscala() {

  const idsValidos = new Set(
    state.leitos.map(leito =>
      String(leito.id)
    )
  );

  const limpar = escala => {

    if (!escala?.grupos) {
      return;
    }

    escala.grupos.forEach(grupo => {

      grupo.leitos =
        (grupo.leitos || []).filter(
          item =>
            idsValidos.has(
              String(item.id)
            )
        );
    });
  };

  limpar(state.dimensionamento);
  limpar(state.escalaBase);

  recalcularCargasDimensionamento();
}


// ==========================================
// ÍNDICE OPERACIONAL
// ==========================================

function gravidadeClasse(gravidade) {

  if (gravidade >= 5) {
    return "critical";
  }

  if (gravidade >= 4) {
    return "high";
  }

  if (gravidade >= 2) {
    return "moderate";
  }

  return "low";
}


function calcularIndiceOperacional(leito) {

  const base =
    Number(leito.gravidade) || 0;

  const respiracao = {

    "AA": 0,
    "AA/CN": 1,
    "AA/Máscara": 1,
    "TQT AA": 1,
    "TQT Tenda": 2,
    "TOT VM": 3,
    "TQT VM": 3

  }[leito.respiracao] ?? 0;


  const dispositivos =
    Math.min(
      (leito.dispositivos || []).length,
      4
    ) * 0.5;


  const precaucoes =
    (leito.precaucoes || [])
      .filter(item =>
        item !== "Padrão"
      ).length * 0.5;


  return Math.round(
    (
      base +
      respiracao +
      dispositivos +
      precaucoes
    ) * 10
  ) / 10;
}


function nivelIndice(valor) {

  if (valor >= 7) {
    return "Alta complexidade";
  }

  if (valor >= 4) {
    return "Complexidade intermediária";
  }

  return "Menor carga registrada";
}
// ==========================================
// RENDERIZAÇÃO DOS LEITOS
// ==========================================

function renderizarLeitos() {

  const filtro =
    document.getElementById(
      "filtro-gravidade"
    )?.value ?? "";

  const busca =
    (
      document.getElementById(
        "busca-leito"
      )?.value || ""
    )
      .trim()
      .toLowerCase();


  const lista =
    state.leitos.filter(leito => {

      const passaFiltro =
        filtro === "" ||
        String(leito.gravidade) === filtro;

      const passaBusca =
        !busca ||
        String(leito.id)
          .toLowerCase()
          .includes(busca);

      return passaFiltro && passaBusca;
    });


  const elemento =
    document.getElementById(
      "lista-leitos"
    );

  if (!elemento) {
    return;
  }


  elemento.innerHTML =
    lista.map(leito => {

      const pendencias = [
        leito.pendenciasExames,
        leito.condutas,
        leito.passagem
      ].filter(item =>
        item?.trim()
      ).length;


      const indice =
        calcularIndiceOperacional(leito);


      const avisoImportacao =
        leito.avaliacaoImportada &&
        !leito.confirmadoNoPlantaoAtual
          ? `
              <div class="alert-box">
                📥 <strong>Avaliação importada do plantão anterior.</strong>
                <br>
                Ainda não confirmada pelo enfermeiro atual.
              </div>
            `
          : "";


      return `
        <article
          class="bed-card ${gravidadeClasse(
            leito.gravidade
          )}"
        >

          <div class="bed-head">

            <h3>
              🛏️ LEITO ${escapeHtml(leito.id)}
            </h3>

            <span
              class="badge ${gravidadeClasse(
                leito.gravidade
              )}"
            >
              ${GRAVIDADES[leito.gravidade]}
            </span>

          </div>

          ${avisoImportacao}

          <div class="bed-meta">

            <span class="meta-pill">
              🫁 ${escapeHtml(
                leito.respiracao ||
                "Não informado"
              )}
            </span>

            <span class="meta-pill">
              💉 ${
                (leito.dispositivos || [])
                  .length
              } dispositivo(s)
            </span>

            <span class="meta-pill">
              ⚠️ ${pendencias} pendência(s)
            </span>

          </div>


          <div class="progress-wrap">

            <div
              class="progress-bar"
              style="width:${
                Math.min(
                  indice / 10 * 100,
                  100
                )
              }%"
            ></div>

          </div>


          <div class="severity-score">

            Índice operacional:

            <strong>
              ${indice}
            </strong>

            • ${nivelIndice(indice)}

          </div>


          <button
            class="secondary-btn"
            type="button"
            onclick="abrirLeito(
              '${encodeURIComponent(
                String(leito.id)
              )}'
            )"
          >
            📝 Avaliar / Editar
          </button>

        </article>
      `;
    }).join("") ||

    `
      <div class="card">
        <p class="muted">
          Nenhum leito encontrado.
        </p>
      </div>
    `;
}


// ==========================================
// DETALHE DO LEITO
// ==========================================

function abrirLeito(encodedId) {

  const id =
    decodeURIComponent(encodedId);

  const leito =
    state.leitos.find(
      item =>
        String(item.id) === String(id)
    );

  if (!leito) {
    return;
  }


  const radios =
    RESPIRACOES.map(respiracao => `

      <label class="choice radio-choice">

        <input
          type="radio"
          name="respiracao"
          value="${escapeHtml(respiracao)}"
          ${
            leito.respiracao === respiracao
              ? "checked"
              : ""
          }
        >

        ${escapeHtml(respiracao)}

      </label>

    `).join("");


  const criarChecks =
    (
      itens,
      selecionados,
      nome
    ) =>

      itens.map(item => `

        <label class="choice">

          <input
            type="checkbox"
            name="${nome}"
            value="${escapeHtml(item)}"
            ${
              (selecionados || [])
                .includes(item)
                ? "checked"
                : ""
            }
          >

          ${escapeHtml(item)}

        </label>

      `).join("");


  const detalhe =
    document.getElementById(
      "detalhe-leito"
    );

  if (!detalhe) {
    return;
  }


  const avisoImportado =
    leito.avaliacaoImportada &&
    !leito.confirmadoNoPlantaoAtual
      ? `
          <div class="alert-box">

            📥 <strong>AVALIAÇÃO IMPORTADA DO PLANTÃO ANTERIOR</strong>

            <br><br>

            Estes dados foram recebidos de outro plantão
            e ainda não foram confirmados pelo enfermeiro atual.

            <br><br>

            Confira a condição atual do paciente antes
            de utilizar esta avaliação no plantão.

            <div style="margin-top:12px;">

              <button
                class="primary-btn"
                type="button"
                onclick="confirmarAvaliacaoImportada(
                  '${encodeURIComponent(String(leito.id))}'
                )"
              >
                ✅ Manter avaliação
              </button>

              <button
                class="secondary-btn"
                type="button"
                onclick="reavaliarLeitoImportado(
                  '${encodeURIComponent(String(leito.id))}'
                )"
              >
                📝 Reavaliar
              </button>

            </div>

          </div>
        `
      : "";


  detalhe.innerHTML = `

    <div class="detail-title">

      <div class="hero-icon">
        🛏️
      </div>

      <div>

        <p class="eyebrow">
          AVALIAÇÃO CLÍNICA OPERACIONAL
        </p>

        <h2>
          LEITO ${escapeHtml(leito.id)}
        </h2>

      </div>

    </div>


    <div class="alert-box">

      🔒 Não utilize nomes, documentos
      ou outros identificadores pessoais
      do paciente.

    </div>

    ${avisoImportado}


    <div class="card form-card">

      <label>
        Gravidade
      </label>

      <select id="det-gravidade">

        ${
          Object.entries(GRAVIDADES)
            .map(([valor, nome]) => `

              <option
                value="${valor}"
                ${
                  Number(valor) ===
                  Number(leito.gravidade)
                    ? "selected"
                    : ""
                }
              >
                ${valor} - ${nome}
              </option>

            `).join("")
        }

      </select>


      <label>
        Diagnóstico / descrição clínica
      </label>

      <textarea
        id="det-diagnostico"
        rows="3"
        placeholder="Descrição sem identificação nominal..."
      >${escapeHtml(
        leito.diagnostico || ""
      )}</textarea>


      <div class="subhead">
        🫁 Respiração
      </div>

      <div class="option-grid">
        ${radios}
      </div>


      <div class="subhead">
        💉 Dispositivos em uso
      </div>

      <div class="option-grid">

        ${criarChecks(
          DISPOSITIVOS,
          leito.dispositivos,
          "dispositivo"
        )}

      </div>


      <div class="subhead">
        🦠 Precaução
      </div>

      <div class="option-grid">

        ${criarChecks(
          PRECAUCOES,
          leito.precaucoes,
          "precaucao"
        )}

      </div>


      <div class="subhead">
        📋 Pendências e passagem de plantão
      </div>


      <label>
        Pendências de exames
      </label>

      <textarea
        id="det-exames"
        rows="3"
      >${escapeHtml(
        leito.pendenciasExames || ""
      )}</textarea>


      <label>
        Acontecimentos do plantão
      </label>

      <textarea
        id="det-acontecimentos"
        rows="3"
      >${escapeHtml(
        leito.acontecimentos || ""
      )}</textarea>


      <label>
        Condutas / pendências
      </label>

      <textarea
        id="det-condutas"
        rows="3"
      >${escapeHtml(
        leito.condutas || ""
      )}</textarea>


      <label>
        Informações para o próximo plantão
      </label>

      <textarea
        id="det-passagem"
        rows="4"
      >${escapeHtml(
        leito.passagem || ""
      )}</textarea>


      <button
        class="primary-btn full"
        type="button"
        onclick="salvarLeito(
          '${encodeURIComponent(
            String(leito.id)
          )}'
        )"
      >
        💾 Salvar avaliação do leito
      </button>

    </div>
  `;


  showTab("leito-detalhe");
}


// ==========================================
// CONFIRMAÇÃO DE AVALIAÇÃO IMPORTADA
// ==========================================

function confirmarAvaliacaoImportada(encodedId) {

  const id =
    decodeURIComponent(encodedId);

  const leito =
    state.leitos.find(
      item =>
        String(item.id) === String(id)
    );

  if (!leito) {
    return;
  }


  const confirmar = confirm(
    `Confirma que você revisou a avaliação importada do leito ${id} e deseja mantê-la no plantão atual?`
  );

  if (!confirmar) {
    return;
  }


  leito.confirmadoNoPlantaoAtual = true;

  salvarDados(false);

  abrirLeito(
    encodeURIComponent(String(id))
  );

  toast(
    `Avaliação do leito ${id} confirmada para o plantão atual.`
  );
}


function reavaliarLeitoImportado(encodedId) {

  const id =
    decodeURIComponent(encodedId);

  const leito =
    state.leitos.find(
      item =>
        String(item.id) === String(id)
    );

  if (!leito) {
    return;
  }


  leito.confirmadoNoPlantaoAtual = false;

  const campo =
    document.getElementById(
      "det-gravidade"
    );

  campo?.focus();

  campo?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  toast(
    `Revise os dados do leito ${id} e salve a nova avaliação.`
  );
}


// ==========================================
// SALVAR LEITO
// ==========================================

function salvarLeito(encodedId) {

  const id =
    decodeURIComponent(encodedId);

  const leito =
    state.leitos.find(
      item =>
        String(item.id) === String(id)
    );

  if (!leito) {
    return;
  }


  const marcados = nome =>
    Array.from(
      document.querySelectorAll(
        `input[name="${nome}"]:checked`
      )
    ).map(input => input.value);


  leito.gravidade =
    Number(
      document.getElementById(
        "det-gravidade"
      ).value
    );


  leito.diagnostico =
    document.getElementById(
      "det-diagnostico"
    ).value.trim();


  leito.respiracao =
    document.querySelector(
      'input[name="respiracao"]:checked'
    )?.value || "AA";


  leito.dispositivos =
    marcados("dispositivo");


  leito.precaucoes =
    marcados("precaucao");


  leito.pendenciasExames =
    document.getElementById(
      "det-exames"
    ).value.trim();


  leito.acontecimentos =
    document.getElementById(
      "det-acontecimentos"
    ).value.trim();


  leito.condutas =
    document.getElementById(
      "det-condutas"
    ).value.trim();


  leito.passagem =
    document.getElementById(
      "det-passagem"
    ).value.trim();


  // Ao salvar, o enfermeiro atual assume a revisão
  // daquela avaliação, inclusive quando veio importada.
  leito.confirmadoNoPlantaoAtual = true;

  recalcularCargasDimensionamento();

  salvarDados(false);

  toast(
    `Leito ${id} salvo com sucesso.`
  );

  showTab("leitos");
}


// ==========================================
// EQUIPE
// ==========================================

function renderizarProfissionais() {

  const elemento =
    document.getElementById(
      "lista-profissionais"
    );

  if (!elemento) {
    return;
  }


  elemento.innerHTML =
    state.profissionais.map(
      (profissional, indice) => `

        <div class="staff-row">

          <input
            value="${escapeHtml(
              profissional.nome
            )}"
            onchange="
              atualizarNomeProfissional(
                ${indice},
                this.value
              )
            "
            placeholder="Identificação profissional"
          >


          <select
            onchange="
              atualizarTipoProfissional(
                ${indice},
                this.value
              )
            "
          >

            ${
              [
                "Enfermeiro",
                "Técnico",
                "Apoio"
              ].map(tipo => `

                <option
                  value="${tipo}"
                  ${
                    profissional.tipo === tipo
                      ? "selected"
                      : ""
                  }
                >
                  ${tipo}
                </option>

              `).join("")
            }

          </select>


          <select
            onchange="
              atualizarSituacaoProfissional(
                ${indice},
                this.value
              )
            "
          >

            <option
              value="presente"
              ${
                profissional.situacao ===
                "presente"
                  ? "selected"
                  : ""
              }
            >
              🟢 Presente
            </option>

            <option
              value="troca"
              ${
                profissional.situacao ===
                "troca"
                  ? "selected"
                  : ""
              }
            >
              🔄 De troca
            </option>

            <option
              value="cobertura"
              ${
                profissional.situacao ===
                "cobertura"
                  ? "selected"
                  : ""
              }
            >
              🟡 Cobertura
            </option>

            <option
              value="ausente"
              ${
                profissional.situacao ===
                "ausente"
                  ? "selected"
                  : ""
              }
            >
              ⚪ Ausente
            </option>

          </select>


          <button
            class="small-btn"
            type="button"
            onclick="removerProfissional(
              ${indice}
            )"
            title="Remover profissional"
          >
            ✕
          </button>

        </div>

      `
    ).join("");


  renderizarControleApoio();
}


// ==========================================
// CONTROLE DO APOIO
// ==========================================

function profissionaisApoio() {

  return state.profissionais.filter(
    profissional =>
      profissional.nome?.trim() &&
      profissional.tipo === "Apoio"
  );
}


function apoioPresente() {

  return profissionaisApoio().find(
    profissional =>
      profissional.situacao === "presente" ||
      profissional.situacao === "cobertura"
  ) || null;
}


function apoioTemporario() {

  if (!state.apoioTemporarioId) {
    return null;
  }

  return state.profissionais.find(
    profissional =>
      profissional.id ===
      state.apoioTemporarioId
  ) || null;
}


function renderizarControleApoio() {

  const lista =
    document.getElementById(
      "lista-profissionais"
    );

  if (!lista) {
    return;
  }


  let painel =
    document.getElementById(
      "controle-apoio-plantao"
    );

  if (!painel) {

    painel =
      document.createElement("div");

    painel.id =
      "controle-apoio-plantao";

    painel.className =
      "card";

    lista.insertAdjacentElement(
      "afterend",
      painel
    );
  }


  const apoio =
    apoioPresente();

  const temporario =
    apoioTemporario();


  if (apoio) {

    painel.innerHTML = `

      <h3>
        🩺 Apoio do plantão
      </h3>

      <p>
        <strong>
          ${escapeHtml(apoio.nome)}
        </strong>
        está definido como Apoio.
      </p>

      <div class="alert-box">

        O profissional de Apoio não participa
        do rodízio regular de pacientes.

        Ele pode receber paciente/leito somente
        como exceção quando houver necessidade
        assistencial ou desfalque.

      </div>

    `;

    return;
  }


  const candidatos =
    state.profissionais.filter(
      profissional =>
        profissional.nome?.trim() &&
        profissional.tipo === "Técnico" &&
        (
          profissional.situacao === "presente" ||
          profissional.situacao === "cobertura"
        )
    );


  painel.innerHTML = `

    <h3>
      🩺 Apoio do plantão
    </h3>

    ${
      profissionaisApoio().length
        ? `
            <div class="alert-box">
              ⚠️ O profissional cadastrado como Apoio
              está ausente neste plantão.
            </div>
          `
        : `
            <p class="muted">
              Nenhum profissional fixo foi definido
              como Apoio.
            </p>
          `
    }

    ${
      temporario
        ? `
            <p>
              Apoio temporário:
              <strong>
                ${escapeHtml(
                  temporario.nome
                )}
              </strong>
            </p>

            <p class="muted">
              Esta função vale somente para o plantão atual
              e não altera a escala-base.
            </p>

            <button
              class="secondary-btn full"
              type="button"
              onclick="removerApoioTemporario()"
            >
              ↩️ Remover Apoio temporário
            </button>
          `
        : candidatos.length
          ? `
              <label>
                Definir Apoio temporário
              </label>

              <select
                id="select-apoio-temporario"
              >
                <option value="">
                  Selecione um profissional
                </option>

                ${
                  candidatos.map(
                    profissional => `
                      <option
                        value="${profissional.id}"
                      >
                        ${escapeHtml(
                          profissional.nome
                        )}
                      </option>
                    `
                  ).join("")
                }

              </select>

              <button
                class="secondary-btn full"
                type="button"
                onclick="definirApoioTemporario()"
              >
                🩺 Definir Apoio somente neste plantão
              </button>
            `
          : `
              <p class="muted">
                Não há técnico disponível para assumir
                temporariamente a função de Apoio.
              </p>
            `
    }

  `;
}


function definirApoioTemporario() {

  const profissionalId =
    document.getElementById(
      "select-apoio-temporario"
    )?.value;

  if (!profissionalId) {

    toast(
      "Selecione o profissional que ficará como Apoio temporário."
    );

    return;
  }


  const profissional =
    state.profissionais.find(
      item =>
        item.id === profissionalId
    );

  if (!profissional) {
    return;
  }


  state.apoioTemporarioId =
    profissional.id;


  state.alteracoesEscala.push({

    id: gerarId(),

    data:
      new Date().toISOString(),

    tipo:
      "apoio_temporario",

    profissionalId:
      profissional.id,

    profissional:
      profissional.nome,

    descricao:
      `${profissional.nome} assumiu temporariamente a função de Apoio neste plantão.`
  });


  salvarDados(false);

  renderizarControleApoio();

  toast(
    `${profissional.nome} definido como Apoio temporário deste plantão.`
  );
}


function removerApoioTemporario() {

  const profissional =
    apoioTemporario();


  state.apoioTemporarioId = null;


  if (profissional) {

    state.alteracoesEscala.push({

      id: gerarId(),

      data:
        new Date().toISOString(),

      tipo:
        "fim_apoio_temporario",

      profissionalId:
        profissional.id,

      profissional:
        profissional.nome,

      descricao:
        `Função temporária de Apoio encerrada para ${profissional.nome}.`
    });
  }


  salvarDados(false);

  renderizarControleApoio();

  toast(
    "Apoio temporário removido."
  );
}


// ==========================================
// ATUALIZAÇÃO DA EQUIPE
// ==========================================

function atualizarNomeProfissional(
  indice,
  valor
) {

  const profissional =
    state.profissionais[indice];

  if (!profissional) {
    return;
  }

  const nomeAntigo =
    profissional.nome;

  profissional.nome =
    valor.trim();


  [
    state.dimensionamento,
    state.escalaBase
  ].forEach(escala => {

    escala?.grupos?.forEach(grupo => {

      if (
        grupo.profissionalId ===
        profissional.id
      ) {

        grupo.profissional =
          profissional.nome;
      }

      else if (
        !grupo.profissionalId &&
        grupo.profissional === nomeAntigo
      ) {

        grupo.profissionalId =
          profissional.id;

        grupo.profissional =
          profissional.nome;
      }
    });
  });


  salvarDados(false);
}


function atualizarTipoProfissional(
  indice,
  valor
) {

  const profissional =
    state.profissionais[indice];

  if (!profissional) {
    return;
  }


  profissional.tipo = valor;


  // Um Apoio fixo não pode continuar marcado
  // simultaneamente como Apoio temporário.
  if (
    valor === "Apoio" &&
    state.apoioTemporarioId ===
      profissional.id
  ) {

    state.apoioTemporarioId = null;
  }


  salvarDados(false);

  renderizarProfissionais();

  renderizarResultadoDimensionamento();
}


function atualizarSituacaoProfissional(
  indice,
  valor
) {

  const profissional =
    state.profissionais[indice];

  if (!profissional) {
    return;
  }

  profissional.situacao = valor;

  profissional.ativo =
    valor === "presente" ||
    valor === "cobertura";


  if (
    state.apoioTemporarioId ===
      profissional.id &&
    !profissional.ativo
  ) {

    state.apoioTemporarioId = null;
  }


  salvarDados(false);

  renderizarResultadoDimensionamento();

  renderizarControleApoio();
}


function adicionarProfissional() {

  state.profissionais.push({
    id: gerarId(),
    nome: "",
    tipo: "Técnico",
    ativo: true,
    situacao: "presente",
    cobrindo: ""
  });

  salvarDados(false);

  renderizarProfissionais();
}


function removerProfissional(indice) {

  const profissional =
    state.profissionais[indice];

  if (!profissional) {
    return;
  }


  const possuiLeitos =
    state.dimensionamento?.grupos?.some(
      grupo =>
        grupo.profissionalId ===
          profissional.id &&
        grupo.leitos?.length
    );


  if (possuiLeitos) {

    const confirmar = confirm(
      `${profissional.nome || "Este profissional"} possui pacientes/leitos atribuídos. Deseja remover o profissional da equipe? Os leitos voltarão a ficar sem profissional.`
    );

    if (!confirmar) {
      return;
    }
  }


  if (
    state.apoioTemporarioId ===
    profissional.id
  ) {

    state.apoioTemporarioId = null;
  }


  state.profissionais.splice(
    indice,
    1
  );


  if (state.dimensionamento?.grupos) {

    state.dimensionamento.grupos =
      state.dimensionamento.grupos.filter(
        grupo =>
          grupo.profissionalId !==
          profissional.id
      );
  }


  salvarDados(false);

  renderizarProfissionais();

  renderizarResultadoDimensionamento();
}


// ==========================================
// PROFISSIONAIS DISPONÍVEIS PARA ESCALA
// ==========================================

function profissionaisParaEscala() {

  return state.profissionais.filter(
    profissional =>
      profissional.nome?.trim() &&

      // Apoio fixo NÃO participa
      // da distribuição regular.
      profissional.tipo === "Técnico" &&

      // Apoio temporário também não entra
      // automaticamente na distribuição regular.
      profissional.id !==
        state.apoioTemporarioId &&

      (
        profissional.situacao ===
          "presente" ||
        profissional.situacao ===
          "cobertura"
      )
  );
}


function tecnicosAtuais() {

  return profissionaisParaEscala()
    .map(profissional =>
      profissional.nome.trim()
    );
}


// ==========================================
// PROFISSIONAIS QUE PODEM RECEBER LEITO
// ==========================================

function profissionaisQuePodemReceberLeito() {

  return state.profissionais.filter(
    profissional =>
      profissional.nome?.trim() &&
      (
        profissional.situacao ===
          "presente" ||
        profissional.situacao ===
          "cobertura"
      ) &&
      (
        profissional.tipo === "Técnico" ||
        profissional.tipo === "Apoio"
      )
  );
}


// ==========================================
// ATRIBUIÇÃO EXCEPCIONAL AO APOIO
// ==========================================

function atribuirLeitoAoApoio() {

  const apoiosDisponiveis =
    state.profissionais.filter(
      profissional =>
        profissional.nome?.trim() &&
        (
          profissional.tipo === "Apoio" ||
          profissional.id ===
            state.apoioTemporarioId
        ) &&
        (
          profissional.situacao ===
            "presente" ||
          profissional.situacao ===
            "cobertura"
        )
    );


  if (!apoiosDisponiveis.length) {

    toast(
      "Não existe profissional de Apoio disponível neste plantão."
    );

    return;
  }


  if (!state.dimensionamento) {

    toast(
      "Monte primeiro a distribuição do plantão."
    );

    return;
  }


  const leitosDisponiveis =
    state.leitos.filter(
      leito =>
        !leitoEstaAtribuido(leito.id)
    );


  const todosLeitos =
    state.leitos.map(
      leito => String(leito.id)
    );


  const sugestaoMenorCarga =
    [...state.leitos]
      .sort(
        (a, b) =>
          calcularIndiceOperacional(a) -
          calcularIndiceOperacional(b)
      )[0];


  const escolhaLeito =
    prompt(
      `Informe o leito que será atribuído excepcionalmente ao Apoio.\n\nLeitos: ${todosLeitos.join(", ")}\n\nPaciente com menor índice operacional registrado neste momento: ${
        sugestaoMenorCarga?.id || "não disponível"
      }\n\nSe o leito já estiver com outro profissional, ele será transferido somente após sua confirmação.`
    );


  if (!escolhaLeito) {
    return;
  }


  const leito =
    state.leitos.find(
      item =>
        String(item.id)
          .toLowerCase() ===
        String(escolhaLeito)
          .trim()
          .toLowerCase()
    );


  if (!leito) {

    toast(
      "Leito informado não encontrado."
    );

    return;
  }


  let apoioSelecionado =
    apoiosDisponiveis[0];


  if (apoiosDisponiveis.length > 1) {

    const lista =
      apoiosDisponiveis
        .map(
          (profissional, indice) =>
            `${indice + 1} - ${profissional.nome}`
        )
        .join("\n");


    const escolha =
      prompt(
        `Qual profissional de Apoio receberá o leito ${leito.id}?\n\n${lista}\n\nDigite o número.`
      );


    if (!escolha) {
      return;
    }


    apoioSelecionado =
      apoiosDisponiveis[
        Number(escolha) - 1
      ];


    if (!apoioSelecionado) {

      toast(
        "Profissional de Apoio inválido."
      );

      return;
    }
  }


  let grupoOrigem = null;


  state.dimensionamento.grupos.forEach(
    grupo => {

      if (
        (grupo.leitos || []).some(
          item =>
            String(item.id) ===
            String(leito.id)
        )
      ) {

        grupoOrigem = grupo;
      }
    }
  );


  if (grupoOrigem) {

    const confirmar =
      confirm(
        `O leito ${leito.id} está atualmente com ${grupoOrigem.profissional}.\n\nDeseja transferi-lo excepcionalmente para ${apoioSelecionado.nome} neste plantão?`
      );

    if (!confirmar) {
      return;
    }


    grupoOrigem.leitos =
      grupoOrigem.leitos.filter(
        item =>
          String(item.id) !==
          String(leito.id)
      );
  }


  let grupoApoio =
    state.dimensionamento.grupos.find(
      grupo =>
        grupo.profissionalId ===
        apoioSelecionado.id
    );


  if (!grupoApoio) {

    grupoApoio = {
      profissionalId:
        apoioSelecionado.id,

      profissional:
        apoioSelecionado.nome,

      tipo:
        apoioSelecionado.tipo === "Apoio"
          ? "Apoio"
          : "Apoio temporário",

      leitos: [],

      carga: 0,

      atribuicaoExcepcional: true
    };

    state.dimensionamento.grupos.push(
      grupoApoio
    );
  }


  const jaPossui =
    grupoApoio.leitos.some(
      item =>
        String(item.id) ===
        String(leito.id)
    );


  if (!jaPossui) {

    grupoApoio.leitos.push({
      id: String(leito.id),
      peso:
        calcularIndiceOperacional(leito)
    });
  }


  state.alteracoesEscala.push({

    id: gerarId(),

    data:
      new Date().toISOString(),

    tipo:
      "atribuicao_excepcional_apoio",

    leito:
      String(leito.id),

    profissionalId:
      apoioSelecionado.id,

    profissional:
      apoioSelecionado.nome,

    origem:
      grupoOrigem?.profissional || null,

    descricao:
      `Leito ${leito.id} atribuído excepcionalmente ao Apoio ${apoioSelecionado.nome} neste plantão.`
  });


  recalcularCargasDimensionamento();

  salvarDados(false);

  renderizarResultadoDimensionamento();

  toast(
    `Leito ${leito.id} atribuído excepcionalmente a ${apoioSelecionado.nome}.`
  );
}
// ==========================================
// PRIMEIRA ESCALA MANUAL
// ==========================================

function iniciarEscalaManual() {

  sincronizarEquipeDaTela();

  const profissionais =
    profissionaisParaEscala();


  if (!profissionais.length) {

    toast(
      "Cadastre pelo menos um técnico presente ou em cobertura."
    );

    return;
  }


  if (!state.dimensionamento) {

    state.dimensionamento = {

      geradoEm:
        new Date()
          .toLocaleString("pt-BR"),

      modo: "manual",

      grupos:
        profissionais.map(
          profissional => ({
            profissionalId:
              profissional.id,

            profissional:
              profissional.nome.trim(),

            tipo:
              profissional.tipo,

            leitos: [],

            carga: 0
          })
        ),

      enfermeiros:
        state.profissionais
          .filter(
            profissional =>
              profissional.nome?.trim() &&
              profissional.tipo ===
                "Enfermeiro"
          )
          .map(
            profissional =>
              profissional.nome.trim()
          )
    };
  }


  sincronizarGruposComEquipe();

  renderizarEditorEscalaManual();

  const editor =
    document.getElementById(
      "editor-escala-manual"
    );

  editor?.classList.remove("hidden");
}


function sincronizarEquipeDaTela() {

  const linhas =
    document.querySelectorAll(
      "#lista-profissionais .staff-row"
    );

  linhas.forEach(
    (linha, indice) => {

      const profissional =
        state.profissionais[indice];

      if (!profissional) {
        return;
      }

      const input =
        linha.querySelector("input");

      const selects =
        linha.querySelectorAll("select");

      if (input) {
        profissional.nome =
          input.value.trim();
      }

      if (selects[0]) {
        profissional.tipo =
          selects[0].value;
      }

      if (selects[1]) {
        profissional.situacao =
          selects[1].value;
      }

      profissional.ativo =
        profissional.situacao ===
          "presente" ||
        profissional.situacao ===
          "cobertura";
    }
  );
}


// ==========================================
// SINCRONIZAR GRUPOS COM A EQUIPE
// ==========================================

function sincronizarGruposComEquipe() {

  if (!state.dimensionamento) {
    return;
  }


  const regulares =
    profissionaisParaEscala();


  const apoios =
    state.profissionais.filter(
      profissional =>
        profissional.nome?.trim() &&
        (
          profissional.tipo === "Apoio" ||
          profissional.id ===
            state.apoioTemporarioId
        ) &&
        (
          profissional.situacao ===
            "presente" ||
          profissional.situacao ===
            "cobertura"
        )
    );


  const profissionais = [
    ...regulares,
    ...apoios
  ].filter(
    (profissional, indice, lista) =>
      lista.findIndex(
        item =>
          item.id === profissional.id
      ) === indice
  );


  profissionais.forEach(
    profissional => {

      const existente =
        state.dimensionamento.grupos.find(
          grupo =>
            grupo.profissionalId ===
            profissional.id
        );


      if (!existente) {

        state.dimensionamento.grupos.push({

          profissionalId:
            profissional.id,

          profissional:
            profissional.nome,

          tipo:
            profissional.tipo,

          leitos: [],

          carga: 0
        });
      }

      else {

        existente.profissional =
          profissional.nome;

        existente.tipo =
          profissional.tipo;
      }
    }
  );


  recalcularCargasDimensionamento();
}


// ==========================================
// VERIFICAR ATRIBUIÇÃO DO LEITO
// ==========================================

function leitoEstaAtribuido(
  leitoId,
  ignorarProfissionalId = null
) {

  if (!state.dimensionamento?.grupos) {
    return false;
  }


  return state.dimensionamento.grupos
    .some(grupo => {

      if (
        ignorarProfissionalId &&
        grupo.profissionalId ===
          ignorarProfissionalId
      ) {
        return false;
      }

      return (grupo.leitos || [])
        .some(
          item =>
            String(item.id) ===
            String(leitoId)
        );
    });
}


// ==========================================
// IDENTIFICAR APOIO
// ==========================================

function profissionalEhApoio(
  profissionalId
) {

  const profissional =
    state.profissionais.find(
      item =>
        item.id === profissionalId
    );


  return (
    profissional?.tipo === "Apoio" ||
    profissionalId ===
      state.apoioTemporarioId
  );
}


function descricaoTipoApoio(
  profissionalId
) {

  const profissional =
    state.profissionais.find(
      item =>
        item.id === profissionalId
    );


  if (
    profissional?.tipo === "Apoio"
  ) {
    return "APOIO";
  }


  if (
    profissionalId ===
    state.apoioTemporarioId
  ) {
    return "APOIO TEMPORÁRIO";
  }


  return "";
}


// ==========================================
// EDITOR DA ESCALA MANUAL
// ==========================================

function renderizarEditorEscalaManual() {

  const editor =
    document.getElementById(
      "editor-escala-manual"
    );

  if (!editor) {
    return;
  }


  if (!state.dimensionamento) {

    editor.innerHTML = "";

    editor.classList.add("hidden");

    return;
  }


  const grupos =
    state.dimensionamento.grupos || [];


  editor.innerHTML = `

    <div class="alert-box">

      📝 Selecione livremente os pacientes/leitos
      de cada profissional.

      <br><br>

      Não existe limite máximo de pacientes
      por técnico.

      <br><br>

      🩺 O profissional definido como
      <strong>Apoio</strong> fica fora do
      rodízio regular.

      Se ele receber paciente/leito,
      essa atribuição será considerada
      uma exceção do plantão atual.

    </div>


    ${
      grupos.map(grupo => {

        const profissional =
          state.profissionais.find(
            item =>
              item.id ===
              grupo.profissionalId
          );


        if (
          profissional &&
          (
            profissional.situacao ===
              "troca" ||
            profissional.situacao ===
              "ausente"
          )
        ) {

          return `

            <div class="assignment-card">

              <h4>
                👤 ${escapeHtml(
                  grupo.profissional
                )}
              </h4>

              <p>

                ${
                  profissional.situacao ===
                    "troca"

                    ? "🔄 De troca — não participa deste plantão."

                    : "⚪ Ausente neste plantão."
                }

              </p>

            </div>

          `;
        }


        const apoio =
          profissionalEhApoio(
            grupo.profissionalId
          );


        const descricaoApoio =
          descricaoTipoApoio(
            grupo.profissionalId
          );


        return `

          <div class="assignment-card">

            <h4>

              👤 ${escapeHtml(
                grupo.profissional
              )}

              ${
                apoio
                  ? ` • ${descricaoApoio}`
                  : ""
              }

            </h4>


            ${
              apoio

                ? `

                    <div class="alert-box">

                      🩺 ${descricaoApoio}

                      <br><br>

                      Este profissional não participa
                      do rodízio regular.

                      Pacientes/leitos atribuídos aqui
                      serão considerados exceção
                      deste plantão.

                    </div>

                  `

                : ""
            }


            <p class="muted">

              ${
                profissional?.situacao ===
                  "cobertura"

                  ? "🟡 Cobertura de outro plantão"

                  : "🟢 Presente"
              }

            </p>


            <div class="manual-bed-grid">

              ${
                state.leitos.map(leito => {

                  const selecionado =
                    (grupo.leitos || [])
                      .some(
                        item =>
                          String(item.id) ===
                          String(leito.id)
                      );


                  const atribuidoOutro =
                    leitoEstaAtribuido(
                      leito.id,
                      grupo.profissionalId
                    );


                  return `

                    <label
                      class="choice ${
                        selecionado
                          ? "selected-bed"
                          : ""
                      }"
                    >

                      <input
                        type="checkbox"

                        ${
                          selecionado
                            ? "checked"
                            : ""
                        }

                        ${
                          atribuidoOutro &&
                          !selecionado
                            ? "disabled"
                            : ""
                        }

                        onchange="
                          alternarLeitoProfissional(
                            '${grupo.profissionalId}',
                            '${encodeURIComponent(
                              String(leito.id)
                            )}',
                            this.checked
                          )
                        "
                      >

                      🛏️ ${escapeHtml(
                        leito.id
                      )}

                      ${
                        atribuidoOutro &&
                        !selecionado

                          ? " • já atribuído"

                          : ""
                      }

                    </label>

                  `;
                }).join("")
              }

            </div>


            <div class="workload-score">

              ${
                (grupo.leitos || []).length
              } paciente(s)/leito(s)

              • Índice operacional:

              ${
                Number(
                  grupo.carga || 0
                ).toFixed(1)
              }

            </div>

          </div>

        `;

      }).join("")
    }


    <button
      class="primary-btn full"
      type="button"
      onclick="salvarEscalaManual()"
    >
      💾 Salvar escala manual
    </button>


    ${
      state.escalaBase

        ? `

          <button
            class="secondary-btn full"
            type="button"
            onclick="restaurarEscalaBase()"
          >
            ↩️ Voltar à escala-base
          </button>

        `

        : ""
    }

  `;
}


// ==========================================
// MARCAR / DESMARCAR LEITO
// ==========================================

function alternarLeitoProfissional(
  profissionalId,
  encodedLeitoId,
  marcado
) {

  if (!state.dimensionamento) {
    return;
  }


  const leitoId =
    decodeURIComponent(
      encodedLeitoId
    );


  const grupo =
    state.dimensionamento.grupos.find(
      item =>
        item.profissionalId ===
        profissionalId
    );


  if (!grupo) {
    return;
  }


  grupo.leitos =
    grupo.leitos || [];


  if (marcado) {

    const jaAtribuido =
      leitoEstaAtribuido(
        leitoId,
        profissionalId
      );


    if (jaAtribuido) {

      toast(
        `O leito ${leitoId} já está atribuído a outro profissional. Use a opção de transferência.`
      );

      renderizarEditorEscalaManual();

      return;
    }


    const profissional =
      state.profissionais.find(
        item =>
          item.id ===
          profissionalId
      );


    if (
      profissionalEhApoio(
        profissionalId
      )
    ) {

      const confirmarApoio =
        confirm(
          `${profissional?.nome || "Este profissional"} está atuando como Apoio.\n\nDeseja atribuir o leito ${leitoId} excepcionalmente ao Apoio neste plantão?\n\nEsta atribuição não será incorporada ao rodízio regular.`
        );


      if (!confirmarApoio) {

        renderizarEditorEscalaManual();

        return;
      }


      state.alteracoesEscala.push({

        id: gerarId(),

        data:
          new Date().toISOString(),

        tipo:
          "atribuicao_excepcional_apoio",

        leito:
          String(leitoId),

        profissionalId:
          profissionalId,

        profissional:
          profissional?.nome || "",

        descricao:
          `Leito ${leitoId} atribuído excepcionalmente ao Apoio neste plantão.`
      });
    }


    const existe =
      grupo.leitos.some(
        item =>
          String(item.id) ===
          String(leitoId)
      );


    if (!existe) {

      const leito =
        state.leitos.find(
          item =>
            String(item.id) ===
            String(leitoId)
        );


      grupo.leitos.push({

        id:
          String(leitoId),

        peso:
          calcularIndiceOperacional(
            leito || {}
          )
      });
    }

  }

  else {

    grupo.leitos =
      grupo.leitos.filter(
        item =>
          String(item.id) !==
          String(leitoId)
      );
  }


  recalcularCargasDimensionamento();

  salvarDados(false);

  renderizarEditorEscalaManual();
}


// ==========================================
// SALVAR ESCALA MANUAL
// ==========================================

function salvarEscalaManual() {

  if (!state.dimensionamento) {

    toast(
      "Monte a distribuição antes de salvar."
    );

    return;
  }


  const totalAtribuidos =
    state.dimensionamento.grupos.reduce(
      (total, grupo) =>
        total +
        (grupo.leitos || []).length,
      0
    );


  if (!totalAtribuidos) {

    toast(
      "Atribua pelo menos um paciente/leito antes de salvar."
    );

    return;
  }


  const leitosSemProfissional =
    state.leitos.filter(
      leito =>
        !leitoEstaAtribuido(
          leito.id
        )
    );


  if (leitosSemProfissional.length) {

    const confirmar = confirm(
      `Existem ${leitosSemProfissional.length} paciente(s)/leito(s) sem profissional atribuído. Deseja salvar mesmo assim?`
    );

    if (!confirmar) {
      return;
    }
  }


  state.dimensionamento.modo =
    "manual";


  state.dimensionamento.geradoEm =
    new Date()
      .toLocaleString("pt-BR");


  // ========================================
  // PRIMEIRA ESCALA = ESCALA-BASE
  // ========================================

  if (!state.escalaBase) {

    state.escalaBase =
      copiarObjeto(
        state.dimensionamento
      );


    // Apoio não carrega pacientes para
    // a escala-base / rodízio futuro.
    state.escalaBase.grupos =
      (
        state.escalaBase.grupos || []
      ).map(grupo => {

        if (
          profissionalEhApoio(
            grupo.profissionalId
          )
        ) {

          return {
            ...grupo,
            leitos: [],
            carga: 0
          };
        }


        return grupo;
      });


    toast(
      "Primeira escala manual salva como escala-base."
    );
  }

  else {

    state.alteracoesEscala.push({

      id:
        gerarId(),

      data:
        new Date().toISOString(),

      tipo:
        "ajuste_manual",

      descricao:
        "Distribuição do plantão editada manualmente."
    });


    toast(
      "Alteração manual salva para este plantão."
    );
  }


  state.rodizio.ultimoPreDimensionamento =
    copiarObjeto(
      state.dimensionamento
    );


  salvarDados(false);

  renderizarResultadoDimensionamento();


  const editor =
    document.getElementById(
      "editor-escala-manual"
    );


  editor?.classList.add("hidden");
}


// ==========================================
// RECALCULAR CARGAS
// ==========================================

function recalcularCargasDimensionamento() {

  if (!state.dimensionamento?.grupos) {
    return;
  }


  state.dimensionamento.grupos.forEach(
    grupo => {

      grupo.leitos =
        (grupo.leitos || []).map(
          item => {

            const leito =
              state.leitos.find(
                registro =>
                  String(registro.id) ===
                  String(item.id)
              );


            return {

              id:
                String(item.id),

              peso:
                calcularIndiceOperacional(
                  leito || {}
                )
            };
          }
        );


      grupo.carga =
        Math.round(
          grupo.leitos.reduce(
            (total, item) =>
              total +
              (Number(item.peso) || 0),
            0
          ) * 10
        ) / 10;
    }
  );
}


// ==========================================
// RESULTADO DA DISTRIBUIÇÃO
// ==========================================

function renderizarResultadoDimensionamento() {

  const elemento =
    document.getElementById(
      "resultado-dimensionamento"
    );

  if (!elemento) {
    return;
  }


  if (!state.dimensionamento) {

    elemento.classList.add("hidden");

    elemento.innerHTML = "";

    return;
  }


  recalcularCargasDimensionamento();


  const grupos =
    state.dimensionamento.grupos || [];


  const cargas =
    grupos.map(
      grupo =>
        Number(grupo.carga) || 0
    );


  const totalCarga =
    cargas.reduce(
      (total, carga) =>
        total + carga,
      0
    );


  const totalPacientes =
    grupos.reduce(
      (total, grupo) =>
        total +
        (grupo.leitos || []).length,
      0
    );


  elemento.classList.remove("hidden");


  elemento.innerHTML = `

    <div class="card">

      <div class="section-head">

        <div>

          <h3>
            📋 Distribuição atual
          </h3>

          <p class="muted">

            ${
              state.dimensionamento.modo ===
                "manual"

                ? "Escala definida manualmente"

                : state.dimensionamento.modo ===
                    "rodizio_editavel"

                ? "Rodízio aplicado e editável"

                : "Escala preparada pelo sistema"
            }

            • ${escapeHtml(
              state.dimensionamento
                .geradoEm || ""
            )}

          </p>

        </div>

      </div>


      <div class="assignment-summary">

        <div>

          <strong>
            ${grupos.length}
          </strong>

          <small>
            Profissionais
          </small>

        </div>


        <div>

          <strong>
            ${totalPacientes}
          </strong>

          <small>
            Pacientes/leitos
          </small>

        </div>


        <div>

          <strong>
            ${totalCarga.toFixed(1)}
          </strong>

          <small>
            Carga total
          </small>

        </div>

      </div>


      ${
        grupos.map(grupo => {

          const profissional =
            state.profissionais.find(
              item =>
                item.id ===
                grupo.profissionalId
            );


          const situacao =
            profissional?.situacao ||
            "presente";


          const apoio =
            profissionalEhApoio(
              grupo.profissionalId
            );


          const descricaoApoio =
            descricaoTipoApoio(
              grupo.profissionalId
            );


          return `

            <div class="assignment-card">

              <h4>

                👤 ${escapeHtml(
                  grupo.profissional
                )}

                ${
                  apoio
                    ? ` • ${descricaoApoio}`
                    : ""
                }

              </h4>


              <p>

                ${
                  situacao === "cobertura"

                    ? "🟡 Cobertura"

                    : situacao === "troca"

                    ? "🔄 De troca"

                    : situacao === "ausente"

                    ? "⚪ Ausente"

                    : "🟢 Presente"
                }

              </p>


              ${
                apoio

                  ? `

                    <p class="muted">

                      🩺 Fora do rodízio regular.

                      ${
                        grupo.leitos?.length

                          ? " Possui atribuição excepcional neste plantão."

                          : " Sem pacientes/leitos atribuídos."
                      }

                    </p>

                  `

                  : ""
              }


              <p>

                🛏️ Pacientes/leitos:

                <strong>

                  ${
                    grupo.leitos
                      .map(item =>
                        escapeHtml(item.id)
                      )
                      .join(", ") ||
                    "Nenhum"
                  }

                </strong>

              </p>


              <p>

                Total:

                <strong>
                  ${grupo.leitos.length}
                </strong>

              </p>


              <span class="workload-score">

                Índice operacional:

                ${
                  Number(
                    grupo.carga || 0
                  ).toFixed(1)
                }

              </span>


              <button
                class="secondary-btn full"
                type="button"
                onclick="
                  editarDistribuicaoProfissional(
                    '${grupo.profissionalId}'
                  )
                "
              >
                ✏️ Editar pacientes/leitos
              </button>


              ${
                grupo.leitos.length

                  ? `

                    <button
                      class="secondary-btn full"
                      type="button"
                      onclick="
                        abrirTransferencia(
                          '${grupo.profissionalId}'
                        )
                      "
                    >
                      ↔️ Transferir paciente/leito
                    </button>

                  `

                  : ""
              }

            </div>

          `;

        }).join("")
      }


      <button
        class="primary-btn full"
        type="button"
        onclick="iniciarEscalaManual()"
      >
        ✏️ Editar distribuição completa
      </button>


      ${
        state.escalaBase

          ? `

            <button
              class="secondary-btn full"
              type="button"
              onclick="restaurarEscalaBase()"
            >
              ↩️ Voltar à escala-base
            </button>

          `

          : ""
      }


      <button
        class="primary-btn full"
        type="button"
        onclick="gerarPDFEscala()"
      >
        📄 GERAR ESCALA
      </button>


      <button
        class="secondary-btn full"
        type="button"
        onclick="atribuirLeitoAoApoio()"
      >
        🩺 Atribuição excepcional ao Apoio
      </button>


      <p class="muted">

        ⚠️ A distribuição é uma ferramenta de
        organização operacional.

        A decisão final permanece com o profissional
        responsável, conforme as condições reais
        da unidade, protocolos institucionais
        e normas aplicáveis.

      </p>

    </div>

  `;
}


// ==========================================
// EDITAR DISTRIBUIÇÃO
// ==========================================

function editarDistribuicaoProfissional(
  profissionalId
) {

  iniciarEscalaManual();


  setTimeout(() => {

    const editor =
      document.getElementById(
        "editor-escala-manual"
      );


    editor?.scrollIntoView({

      behavior:
        "smooth",

      block:
        "start"
    });

  }, 100);
}
// ==========================================
// TRANSFERÊNCIA DE PACIENTE / LEITO
// ==========================================

function abrirTransferencia(
  profissionalOrigemId
) {

  if (!state.dimensionamento?.grupos) {

    toast(
      "Ainda não existe uma distribuição para editar."
    );

    return;
  }


  const origem =
    state.dimensionamento.grupos.find(
      grupo =>
        grupo.profissionalId ===
        profissionalOrigemId
    );


  if (!origem) {

    toast(
      "Profissional de origem não encontrado."
    );

    return;
  }


  if (!origem.leitos?.length) {

    toast(
      `${origem.profissional} não possui pacientes/leitos para transferir.`
    );

    return;
  }


  const listaLeitos =
    origem.leitos
      .map(
        (item, indice) =>
          `${indice + 1} - Leito ${item.id}`
      )
      .join("\n");


  const escolhaLeito =
    prompt(
      `Qual paciente/leito deseja transferir de ${origem.profissional}?\n\n${listaLeitos}\n\nDigite o número correspondente.`
    );


  if (!escolhaLeito) {
    return;
  }


  const indiceLeito =
    Number(escolhaLeito) - 1;


  const itemLeito =
    origem.leitos[indiceLeito];


  if (!itemLeito) {

    toast(
      "Paciente/leito selecionado inválido."
    );

    return;
  }


  transferirLeito(
    profissionalOrigemId,
    String(itemLeito.id)
  );
}


function transferirLeito(
  profissionalOrigemId,
  leitoId
) {

  if (!state.dimensionamento?.grupos) {
    return;
  }


  const origem =
    state.dimensionamento.grupos.find(
      grupo =>
        grupo.profissionalId ===
        profissionalOrigemId
    );


  if (!origem) {
    return;
  }


  const leito =
    state.leitos.find(
      item =>
        String(item.id) ===
        String(leitoId)
    );


  if (!leito) {

    toast(
      "Paciente/leito não encontrado."
    );

    return;
  }


  const profissionaisDisponiveis =
    profissionaisQuePodemReceberLeito()
      .filter(
        profissional =>
          profissional.id !==
            profissionalOrigemId
      );


  if (!profissionaisDisponiveis.length) {

    toast(
      "Não existe outro profissional disponível para receber este paciente/leito."
    );

    return;
  }


  const listaDestinos =
    profissionaisDisponiveis
      .map(
        (profissional, indice) => {

          const apoio =
            profissionalEhApoio(
              profissional.id
            );

          return (
            `${indice + 1} - ` +
            `${profissional.nome}` +
            `${
              apoio
                ? " (APOIO)"
                : ""
            }`
          );
        }
      )
      .join("\n");


  const escolhaDestino =
    prompt(
      `Transferir leito ${leito.id} para:\n\n${listaDestinos}\n\nDigite o número do profissional.`
    );


  if (!escolhaDestino) {
    return;
  }


  const destinoProfissional =
    profissionaisDisponiveis[
      Number(escolhaDestino) - 1
    ];


  if (!destinoProfissional) {

    toast(
      "Profissional de destino inválido."
    );

    return;
  }


  const destinoEhApoio =
    profissionalEhApoio(
      destinoProfissional.id
    );


  if (destinoEhApoio) {

    const confirmarApoio =
      confirm(
        `${destinoProfissional.nome} está atuando como Apoio.\n\nDeseja transferir o leito ${leito.id} excepcionalmente para este profissional?\n\nEsta alteração vale somente para o plantão atual e não modifica a escala-base nem o rodízio regular.`
      );


    if (!confirmarApoio) {
      return;
    }
  }


  const motivo =
    prompt(
      "Motivo da alteração (opcional):\n\nEx.: complexidade, isolamento, desfalque, necessidade do setor..."
    ) || "";


  let destino =
    state.dimensionamento.grupos.find(
      grupo =>
        grupo.profissionalId ===
        destinoProfissional.id
    );


  if (!destino) {

    destino = {

      profissionalId:
        destinoProfissional.id,

      profissional:
        destinoProfissional.nome,

      tipo:
        destinoEhApoio
          ? descricaoTipoApoio(
              destinoProfissional.id
            )
          : destinoProfissional.tipo,

      leitos: [],

      carga: 0,

      atribuicaoExcepcional:
        destinoEhApoio
    };


    state.dimensionamento.grupos.push(
      destino
    );
  }


  origem.leitos =
    origem.leitos.filter(
      item =>
        String(item.id) !==
        String(leito.id)
    );


  destino.leitos =
    destino.leitos || [];


  if (
    !destino.leitos.some(
      item =>
        String(item.id) ===
        String(leito.id)
    )
  ) {

    destino.leitos.push({

      id:
        String(leito.id),

      peso:
        calcularIndiceOperacional(
          leito
        )
    });
  }


  state.alteracoesEscala.push({

    id:
      gerarId(),

    data:
      new Date().toISOString(),

    tipo:
      destinoEhApoio
        ? "transferencia_para_apoio"
        : "transferencia",

    leito:
      String(leito.id),

    origem:
      origem.profissional,

    origemId:
      origem.profissionalId,

    destino:
      destino.profissional,

    destinoId:
      destino.profissionalId,

    motivo:
      motivo.trim(),

    temporaria:
      destinoEhApoio,

    descricao:
      destinoEhApoio
        ? `Leito ${leito.id} transferido excepcionalmente para o Apoio ${destino.profissional}.`
        : `Leito ${leito.id} transferido de ${origem.profissional} para ${destino.profissional}.`
  });


  recalcularCargasDimensionamento();

  salvarDados(false);

  renderizarResultadoDimensionamento();

  renderizarEditorEscalaManual();


  toast(
    `Leito ${leito.id} transferido para ${destino.profissional}.`
  );
}


// ==========================================
// RESTAURAR ESCALA-BASE
// ==========================================

function restaurarEscalaBase() {

  if (!state.escalaBase) {

    toast(
      "Ainda não existe uma escala-base salva."
    );

    return;
  }


  const confirmar =
    confirm(
      "Deseja restaurar a escala-base?\n\nAs alterações manuais deste plantão serão substituídas. A escala-base original continuará preservada."
    );


  if (!confirmar) {
    return;
  }


  state.dimensionamento =
    copiarObjeto(
      state.escalaBase
    );


  state.dimensionamento.geradoEm =
    new Date()
      .toLocaleString("pt-BR");


  state.dimensionamento.modo =
    "manual";


  // Apoio temporário pertence somente
  // ao plantão atual.
  state.apoioTemporarioId = null;


  recalcularCargasDimensionamento();

  salvarDados(false);

  renderizarResultadoDimensionamento();

  renderizarEditorEscalaManual();

  renderizarProfissionais();


  toast(
    "Escala-base restaurada."
  );
}


// ==========================================
// SUGESTÃO POR CARGA ASSISTENCIAL
// ==========================================
// A sugestão nunca substitui automaticamente
// a decisão do enfermeiro.
// Apoio não participa da distribuição regular.
// ==========================================

function gerarSugestaoPorCarga() {

  sincronizarEquipeDaTela();


  const profissionais =
    profissionaisParaEscala();


  if (!profissionais.length) {

    toast(
      "Cadastre os técnicos disponíveis antes de gerar uma sugestão."
    );

    return;
  }


  const grupos =
    profissionais.map(
      profissional => ({

        profissionalId:
          profissional.id,

        profissional:
          profissional.nome,

        tipo:
          profissional.tipo,

        leitos: [],

        carga: 0
      })
    );


  const leitos =
    [...state.leitos].sort(
      (a, b) =>
        calcularIndiceOperacional(b) -
        calcularIndiceOperacional(a)
    );


  leitos.forEach(leito => {

    grupos.sort(
      (a, b) =>
        a.carga - b.carga
    );


    const grupo =
      grupos[0];


    const peso =
      calcularIndiceOperacional(
        leito
      );


    grupo.leitos.push({

      id:
        String(leito.id),

      peso
    });


    grupo.carga += peso;
  });


  grupos.forEach(grupo => {

    grupo.carga =
      Math.round(
        grupo.carga * 10
      ) / 10;
  });


  const resumo =
    grupos
      .map(
        grupo =>
          `${grupo.profissional}: ${
            grupo.leitos
              .map(item => item.id)
              .join(", ") ||
            "sem leitos"
          }`
      )
      .join("\n");


  const aplicar =
    confirm(
      `SUGESTÃO POR CARGA ASSISTENCIAL\n\n${resumo}\n\nEsta distribuição é somente uma sugestão operacional e continua totalmente editável.\n\nDeseja aplicá-la ao plantão atual?`
    );


  if (!aplicar) {

    toast(
      "Sugestão visualizada. A escala atual não foi alterada."
    );

    return;
  }


  state.dimensionamento = {

    geradoEm:
      new Date()
        .toLocaleString("pt-BR"),

    modo:
      "sugestao_editavel",

    grupos,

    enfermeiros:
      state.profissionais
        .filter(
          profissional =>
            profissional.nome?.trim() &&
            profissional.tipo ===
              "Enfermeiro"
        )
        .map(
          profissional =>
            profissional.nome.trim()
        )
  };


  state.alteracoesEscala.push({

    id:
      gerarId(),

    data:
      new Date().toISOString(),

    tipo:
      "sugestao_aplicada",

    descricao:
      "Sugestão por carga assistencial aplicada e mantida editável."
  });


  salvarDados(false);

  renderizarResultadoDimensionamento();


  toast(
    "Sugestão aplicada. Você ainda pode editar qualquer paciente/leito."
  );
}


// ==========================================
// COMPATIBILIDADE COM BOTÃO ANTIGO
// ==========================================

function gerarDimensionamento() {

  if (!state.escalaBase) {

    toast(
      "A primeira escala deve ser montada manualmente."
    );

    iniciarEscalaManual();

    return;
  }


  gerarSugestaoPorCarga();
}


// ==========================================
// RODÍZIO
// ==========================================
// IMPORTANTE:
// - somente profissionais regulares participam;
// - Apoio fixo fica fora;
// - Apoio temporário fica fora;
// - coberturas temporárias não destroem a base;
// - a escala gerada continua editável.
// ==========================================

function abrirConfiguracaoRodizio() {

  const atual =
    state.rodizio.passos || 1;


  const escolha =
    prompt(
      "Quantas posições os pacientes/leitos devem avançar no próximo plantão?\n\nExemplo:\n1 = avanço de uma posição\n2 = avanço de duas posições\n\nO profissional de Apoio não participa deste rodízio.\n\nDigite um número:",
      String(atual)
    );


  if (escolha === null) {
    return;
  }


  const passos =
    Number(escolha);


  if (
    !Number.isInteger(passos) ||
    passos < 1
  ) {

    toast(
      "Informe um número inteiro maior que zero."
    );

    return;
  }


  state.rodizio.ativo = true;

  state.rodizio.tipo =
    "sequencial";

  state.rodizio.passos =
    passos;


  salvarDados(false);


  toast(
    `Rodízio configurado para avançar ${passos} posição(ões).`
  );
}


// ==========================================
// PRÓXIMO LEITO DA SEQUÊNCIA
// ==========================================

function proximoIdLeito(
  id,
  passos = 1
) {

  const ids =
    state.leitos.map(
      leito =>
        String(leito.id)
    );


  const indice =
    ids.indexOf(
      String(id)
    );


  if (
    indice < 0 ||
    !ids.length
  ) {

    return String(id);
  }


  const deslocamento =
    Number(passos) || 1;


  return ids[
    (
      indice +
      deslocamento
    ) % ids.length
  ];
}


// ==========================================
// PREPARAR PRÓXIMO PLANTÃO
// ==========================================

function preDimensionarProximoPlantao() {

  if (!state.escalaBase) {

    toast(
      "Primeiro monte e salve a escala-base manualmente."
    );

    iniciarEscalaManual();

    return;
  }


  const origem =
    state.dimensionamento ||
    state.escalaBase;


  const passos =
    state.rodizio.ativo
      ? Number(
          state.rodizio.passos
        ) || 1
      : 1;


  // Só os grupos regulares seguem para
  // o rodízio do próximo plantão.
  const grupos =
    copiarObjeto(
      origem.grupos || []
    )
      .filter(grupo => {

        const profissional =
          state.profissionais.find(
            item =>
              item.id ===
              grupo.profissionalId
          );


        if (!profissional) {
          return false;
        }


        if (
          profissional.tipo === "Apoio"
        ) {
          return false;
        }


        if (
          profissional.id ===
          state.apoioTemporarioId
        ) {
          return false;
        }


        return (
          profissional.tipo ===
          "Técnico"
        );
      });


  grupos.forEach(grupo => {

    const profissional =
      state.profissionais.find(
        item =>
          item.id ===
          grupo.profissionalId
      );


    grupo.leitos =
      (grupo.leitos || []).map(
        item => {

          const novoId =
            proximoIdLeito(
              item.id,
              passos
            );


          const leito =
            state.leitos.find(
              registro =>
                String(registro.id) ===
                String(novoId)
            );


          return {

            id:
              novoId,

            peso:
              calcularIndiceOperacional(
                leito || {}
              )
          };
        }
      );


    grupo.carga =
      Math.round(
        grupo.leitos.reduce(
          (total, item) =>
            total +
            (Number(item.peso) || 0),
          0
        ) * 10
      ) / 10;


    grupo.situacaoPrevista =
      profissional?.situacao ||
      "presente";
  });


  state.rodizio.proximo = {

    geradoEm:
      new Date()
        .toLocaleString("pt-BR"),

    modo:
      `Rodízio configurado: avanço de ${passos} posição(ões). Apoio fora do rodízio.`,

    grupos
  };


  salvarDados(false);

  renderizarPreDimensionamento();


  toast(
    "Pré-dimensionamento do próximo plantão preparado."
  );
}


// ==========================================
// MOSTRAR PRÉ-DIMENSIONAMENTO
// ==========================================

function renderizarPreDimensionamento() {

  const elemento =
    document.getElementById(
      "resultado-rodizio"
    );


  if (
    !elemento ||
    !state.rodizio?.proximo
  ) {

    return;
  }


  const proximo =
    state.rodizio.proximo;


  elemento.classList.remove(
    "hidden"
  );


  elemento.innerHTML = `

    <div class="alert-box">

      🔄 ${escapeHtml(
        proximo.modo
      )}

      <br><br>

      Esta é uma preparação para o próximo
      plantão e pode ser editada antes
      de ser utilizada.

    </div>


    ${
      proximo.grupos.map(
        grupo => `

          <div class="rotation-card">

            <h4>

              👤 ${escapeHtml(
                grupo.profissional
              )}

            </h4>


            <div class="beds-line">

              🛏️ ${
                grupo.leitos
                  .map(item =>
                    escapeHtml(item.id)
                  )
                  .join(" • ") ||
                "Sem leitos"
              }

            </div>


            <small>

              ${
                grupo.leitos.length
              } paciente(s)/leito(s)

              • Índice:

              ${
                Number(
                  grupo.carga || 0
                ).toFixed(1)
              }

            </small>

          </div>

        `
      ).join("")
    }


    <button
      class="primary-btn full"
      type="button"
      onclick="aplicarPreDimensionamento()"
    >
      ✅ Usar como escala do próximo plantão
    </button>

  `;
}


// ==========================================
// APLICAR PRÉ-DIMENSIONAMENTO
// ==========================================

function aplicarPreDimensionamento() {

  if (!state.rodizio?.proximo) {

    toast(
      "Prepare primeiro o próximo plantão."
    );

    return;
  }


  state.dimensionamento = {

    geradoEm:
      new Date()
        .toLocaleString("pt-BR"),

    modo:
      "rodizio_editavel",

    grupos:
      copiarObjeto(
        state.rodizio.proximo.grupos
      ),

    enfermeiros:
      state.profissionais
        .filter(
          profissional =>
            profissional.nome?.trim() &&
            profissional.tipo ===
              "Enfermeiro"
        )
        .map(
          profissional =>
            profissional.nome.trim()
        )
  };


  state.rodizio
    .ultimoPreDimensionamento =
      copiarObjeto(
        state.dimensionamento
      );


  state.rodizio.proximo =
    null;


  // Apoio temporário do plantão anterior
  // não é carregado para o novo plantão.
  state.apoioTemporarioId =
    null;


  salvarDados(false);

  renderizarResultadoDimensionamento();

  renderizarProfissionais();


  const resultadoRodizio =
    document.getElementById(
      "resultado-rodizio"
    );


  if (resultadoRodizio) {

    resultadoRodizio.classList.add(
      "hidden"
    );
  }


  toast(
    "Escala do próximo plantão aplicada. Ela continua totalmente editável."
  );
}
// ==========================================
// TROCAS, AUSÊNCIAS E COBERTURAS
// ==========================================

function abrirTrocasCoberturas() {

  const elemento =
    document.getElementById(
      "painel-trocas-coberturas"
    );

  if (!elemento) {

    toast(
      "Área de trocas e coberturas não encontrada."
    );

    return;
  }


  const titulares =
    state.profissionais.filter(
      profissional =>
        profissional.nome?.trim()
    );


  const apoioFixo =
    profissionaisApoio()[0] || null;

  const apoioAtual =
    apoioPresente();

  const apoioTemp =
    apoioTemporario();


  elemento.classList.remove("hidden");


  elemento.innerHTML = `

    <div class="card">

      <h3>
        🔄 Trocas, ausências e coberturas
      </h3>

      <p class="muted">
        Registre alterações somente para o plantão atual.
        A escala-base e a sequência regular permanecem
        preservadas.
      </p>


      <div class="alert-box">

        Uma cobertura de outro plantão não substitui
        permanentemente o titular.

        <br><br>

        No próximo plantão, o profissional titular
        retorna à posição normal da sequência,
        salvo nova alteração manual.

      </div>


      ${
        titulares.map(
          profissional => {

            const situacao =
              profissional.situacao ||
              "presente";


            const cobrindo =
              profissional.cobrindo ||
              "";


            return `

              <div class="assignment-card">

                <h4>
                  👤 ${escapeHtml(
                    profissional.nome
                  )}
                </h4>

                <p class="muted">
                  ${escapeHtml(
                    profissional.tipo
                  )}
                </p>


                <label>
                  Situação neste plantão
                </label>

                <select
                  onchange="
                    alterarSituacaoTroca(
                      '${profissional.id}',
                      this.value
                    )
                  "
                >

                  <option
                    value="presente"
                    ${
                      situacao ===
                        "presente"
                        ? "selected"
                        : ""
                    }
                  >
                    🟢 Presente
                  </option>


                  <option
                    value="troca"
                    ${
                      situacao ===
                        "troca"
                        ? "selected"
                        : ""
                    }
                  >
                    🔄 De troca — ausente neste plantão
                  </option>


                  <option
                    value="cobertura"
                    ${
                      situacao ===
                        "cobertura"
                        ? "selected"
                        : ""
                    }
                  >
                    🟡 Cobertura de outro plantão
                  </option>


                  <option
                    value="ausente"
                    ${
                      situacao ===
                        "ausente"
                        ? "selected"
                        : ""
                    }
                  >
                    ⚪ Ausente
                  </option>

                </select>


                ${
                  situacao === "cobertura"

                    ? `

                      <label>
                        Está cobrindo quem?
                      </label>

                      <input
                        value="${escapeHtml(
                          cobrindo
                        )}"
                        placeholder="Nome do titular"
                        onchange="
                          alterarProfissionalCoberto(
                            '${profissional.id}',
                            this.value
                          )
                        "
                      >

                    `

                    : ""
                }


                ${
                  situacao === "troca"

                    ? `

                      <p class="muted">
                        🔄 ${escapeHtml(
                          profissional.nome
                        )} permanece cadastrado como
                        titular, mas não participa
                        deste plantão.
                      </p>

                    `

                    : ""
                }


                ${
                  situacao === "ausente"

                    ? `

                      <p class="muted">
                        ⚪ Ausência registrada somente
                        para o plantão atual.
                      </p>

                    `

                    : ""
                }

              </div>

            `;
          }
        ).join("")
      }


      <button
        class="secondary-btn full"
        type="button"
        onclick="adicionarCoberturaPlantao()"
      >
        ➕ Adicionar profissional de cobertura
      </button>

    </div>


    <div class="card">

      <h3>
        🩺 Apoio do plantão
      </h3>


      ${
        apoioAtual

          ? `

            <div class="assignment-card">

              <strong>
                ${escapeHtml(
                  apoioAtual.nome
                )}
              </strong>

              <p>
                🩺 Apoio regular deste plantão.
              </p>

              <p class="muted">
                Não participa do rodízio regular
                de pacientes/leitos.
              </p>

            </div>

          `

          : apoioFixo

          ? `

            <div class="alert-box">

              ⚠️ O profissional definido como Apoio,

              <strong>
                ${escapeHtml(
                  apoioFixo.nome
                )}
              </strong>,

              não está disponível neste plantão.

              <br><br>

              Se necessário, escolha um técnico
              para assumir temporariamente
              a função de Apoio.

            </div>

          `

          : `

            <p class="muted">
              Nenhum Apoio fixo cadastrado.
            </p>

          `
      }


      ${
        apoioTemp

          ? `

            <div class="assignment-card">

              <strong>
                ${escapeHtml(
                  apoioTemp.nome
                )}
              </strong>

              <p>
                🩺 Apoio temporário
              </p>

              <p class="muted">
                Esta função vale somente para
                o plantão atual e não modifica
                a escala-base.
              </p>


              <button
                class="secondary-btn full"
                type="button"
                onclick="removerApoioTemporario()"
              >
                ↩️ Remover Apoio temporário
              </button>

            </div>

          `

          : !apoioAtual

          ? `

            <label>
              Técnico para Apoio temporário
            </label>


            <select
              id="troca-apoio-temporario"
            >

              <option value="">
                Selecione
              </option>

              ${
                state.profissionais
                  .filter(
                    profissional =>
                      profissional.nome?.trim() &&
                      profissional.tipo ===
                        "Técnico" &&
                      (
                        profissional.situacao ===
                          "presente" ||
                        profissional.situacao ===
                          "cobertura"
                      )
                  )
                  .map(
                    profissional => `

                      <option
                        value="${profissional.id}"
                      >
                        ${escapeHtml(
                          profissional.nome
                        )}
                      </option>

                    `
                  )
                  .join("")
              }

            </select>


            <button
              class="secondary-btn full"
              type="button"
              onclick="definirApoioTemporarioTrocas()"
            >
              🩺 Definir Apoio temporário
            </button>

          `

          : ""
      }

    </div>

  `;


  elemento.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


// ==========================================
// ALTERAR SITUAÇÃO DO PROFISSIONAL
// ==========================================

function alterarSituacaoTroca(
  profissionalId,
  situacao
) {

  const profissional =
    state.profissionais.find(
      item =>
        item.id ===
        profissionalId
    );


  if (!profissional) {
    return;
  }


  const situacaoAnterior =
    profissional.situacao;


  profissional.situacao =
    situacao;


  profissional.ativo =
    situacao === "presente" ||
    situacao === "cobertura";


  if (situacao !== "cobertura") {
    profissional.cobrindo = "";
  }


  if (
    state.apoioTemporarioId ===
      profissional.id &&
    !profissional.ativo
  ) {

    state.apoioTemporarioId =
      null;
  }


  state.alteracoesEscala.push({

    id:
      gerarId(),

    data:
      new Date().toISOString(),

    tipo:
      "situacao_profissional",

    profissionalId:
      profissional.id,

    profissional:
      profissional.nome,

    situacaoAnterior,

    situacaoNova:
      situacao,

    descricao:
      `${profissional.nome}: ${situacaoAnterior} → ${situacao}.`
  });


  salvarDados(false);

  renderizarProfissionais();

  renderizarResultadoDimensionamento();

  abrirTrocasCoberturas();


  toast(
    `Situação de ${profissional.nome} atualizada.`
  );
}


// ==========================================
// REGISTRAR QUEM ESTÁ SENDO COBERTO
// ==========================================

function alterarProfissionalCoberto(
  profissionalId,
  nomeTitular
) {

  const profissional =
    state.profissionais.find(
      item =>
        item.id ===
        profissionalId
    );


  if (!profissional) {
    return;
  }


  profissional.cobrindo =
    nomeTitular.trim();


  salvarDados(false);


  toast(
    "Cobertura atualizada."
  );
}


// ==========================================
// ADICIONAR COBERTURA
// ==========================================

function adicionarCoberturaPlantao() {

  const nome =
    prompt(
      "Nome ou identificação do profissional que veio de outro plantão para realizar a cobertura:"
    );


  if (!nome?.trim()) {
    return;
  }


  const titular =
    prompt(
      "Quem este profissional está cobrindo?\n\nOpcional — deixe em branco se não houver titular específico."
    ) || "";


  const profissional = {

    id:
      gerarId(),

    nome:
      nome.trim(),

    tipo:
      "Técnico",

    ativo:
      true,

    situacao:
      "cobertura",

    cobrindo:
      titular.trim()
  };


  state.profissionais.push(
    profissional
  );


  state.alteracoesEscala.push({

    id:
      gerarId(),

    data:
      new Date().toISOString(),

    tipo:
      "cobertura_adicionada",

    profissionalId:
      profissional.id,

    profissional:
      profissional.nome,

    cobrindo:
      profissional.cobrindo,

    descricao:
      `${profissional.nome} adicionado como cobertura${
        profissional.cobrindo
          ? ` de ${profissional.cobrindo}`
          : ""
      }.`
  });


  salvarDados(false);

  renderizarProfissionais();

  abrirTrocasCoberturas();


  toast(
    `${profissional.nome} adicionado como cobertura deste plantão.`
  );
}


// ==========================================
// DEFINIR APOIO TEMPORÁRIO PELA ÁREA DE TROCAS
// ==========================================

function definirApoioTemporarioTrocas() {

  const profissionalId =
    document.getElementById(
      "troca-apoio-temporario"
    )?.value;


  if (!profissionalId) {

    toast(
      "Selecione o profissional que assumirá o Apoio."
    );

    return;
  }


  const profissional =
    state.profissionais.find(
      item =>
        item.id ===
        profissionalId
    );


  if (!profissional) {
    return;
  }


  state.apoioTemporarioId =
    profissional.id;


  state.alteracoesEscala.push({

    id:
      gerarId(),

    data:
      new Date().toISOString(),

    tipo:
      "apoio_temporario",

    profissionalId:
      profissional.id,

    profissional:
      profissional.nome,

    descricao:
      `${profissional.nome} assumiu temporariamente a função de Apoio neste plantão.`
  });


  salvarDados(false);

  renderizarProfissionais();

  abrirTrocasCoberturas();

  renderizarResultadoDimensionamento();


  toast(
    `${profissional.nome} definido como Apoio temporário.`
  );
}


// ==========================================
// PDF DA ESCALA
// ==========================================

function gerarPDFEscala() {

  if (!state.dimensionamento?.grupos?.length) {

    toast(
      "Monte e salve a escala antes de gerar o PDF."
    );

    return;
  }


  if (
    !window.jspdf ||
    !window.jspdf.jsPDF
  ) {

    toast(
      "O gerador de PDF não foi carregado."
    );

    return;
  }


  lerConfiguracoesDaTela();

  recalcularCargasDimensionamento();


  const { jsPDF } =
    window.jspdf;


  const doc =
    new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });


  const larguraPagina =
    doc.internal.pageSize.getWidth();


  const alturaPagina =
    doc.internal.pageSize.getHeight();


  const margem =
    14;


  const larguraUtil =
    larguraPagina -
    margem * 2;


  let y =
    16;


  function verificarPagina(
    alturaNecessaria = 20
  ) {

    if (
      y + alturaNecessaria >
      alturaPagina - 18
    ) {

      adicionarRodape();

      doc.addPage();

      y = 16;
    }
  }


  function adicionarRodape() {

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(8);

    doc.text(
      "Cadê a Escala? | Dia de Treinamento",
      margem,
      alturaPagina - 8
    );


    doc.text(
      `Página ${doc.internal.getNumberOfPages()}`,
      larguraPagina - margem,
      alturaPagina - 8,
      {
        align: "right"
      }
    );
  }


  function textoQuebrado(
    texto,
    x,
    largura,
    tamanho = 10,
    estilo = "normal"
  ) {

    doc.setFont(
      "helvetica",
      estilo
    );

    doc.setFontSize(
      tamanho
    );


    const linhas =
      doc.splitTextToSize(
        String(texto || ""),
        largura
      );


    doc.text(
      linhas,
      x,
      y
    );


    y +=
      linhas.length *
      (
        tamanho <= 9
          ? 4
          : 5
      );


    return linhas;
  }


  // ========================================
  // CABEÇALHO
  // ========================================

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(
    20
  );


  doc.text(
    "CADE A ESCALA?",
    margem,
    y
  );


  y += 7;


  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(
    10
  );


  doc.text(
    "Dia de Treinamento | Escala Assistencial do Plantao",
    margem,
    y
  );


  y += 9;


  doc.line(
    margem,
    y,
    larguraPagina - margem,
    y
  );


  y += 8;


  // ========================================
  // DADOS DO PLANTÃO
  // ========================================

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(
    11
  );


  doc.text(
    "DADOS DO PLANTAO",
    margem,
    y
  );


  y += 6;


  textoQuebrado(
    `Instituicao: ${
      state.config.hospital ||
      "Nao informado"
    }`,
    margem,
    larguraUtil,
    10
  );


  textoQuebrado(
    `Setor: ${
      state.config.setor ||
      "Nao informado"
    }`,
    margem,
    larguraUtil,
    10
  );


  textoQuebrado(
    `Data: ${
      formatarData(
        state.config.data
      )
    } | Turno: ${
      state.config.turno ||
      "Nao informado"
    }`,
    margem,
    larguraUtil,
    10
  );


  textoQuebrado(
    `Enfermeiro: ${
      state.config.enfermeiro ||
      "Nao informado"
    }${
      state.config.coren
        ? ` | COREN: ${state.config.coren}`
        : ""
    }`,
    margem,
    larguraUtil,
    10
  );


  y += 4;


  // ========================================
  // DISTRIBUIÇÃO
  // ========================================

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(
    12
  );


  doc.text(
    "DISTRIBUICAO ASSISTENCIAL",
    margem,
    y
  );


  y += 7;


  state.dimensionamento.grupos
    .forEach(
      (grupo, indice) => {

        verificarPagina(30);


        const profissional =
          state.profissionais.find(
            item =>
              item.id ===
              grupo.profissionalId
          );


        const apoio =
          profissionalEhApoio(
            grupo.profissionalId
          );


        const tipoApoio =
          descricaoTipoApoio(
            grupo.profissionalId
          );


        const situacao =
          profissional?.situacao ||
          "presente";


        const situacaoTexto = {

          presente:
            "Presente",

          troca:
            "De troca - ausente neste plantao",

          cobertura:
            "Cobertura de outro plantao",

          ausente:
            "Ausente"

        }[situacao] ||
        situacao;


        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          11
        );


        doc.text(
          `${indice + 1}. ${
            grupo.profissional ||
            "Profissional"
          }${
            apoio
              ? ` - ${tipoApoio}`
              : ""
          }`,
          margem,
          y
        );


        y += 5;


        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          9
        );


        textoQuebrado(
          `Situacao: ${situacaoTexto}${
            profissional?.cobrindo
              ? ` | Cobrindo: ${profissional.cobrindo}`
              : ""
          }`,
          margem + 4,
          larguraUtil - 4,
          9
        );


        textoQuebrado(
          `Pacientes/Leitos: ${
            grupo.leitos?.length
              ? grupo.leitos
                  .map(item => item.id)
                  .join(", ")
              : "Nenhum"
          }`,
          margem + 4,
          larguraUtil - 4,
          9
        );


        textoQuebrado(
          `Quantidade: ${
            grupo.leitos?.length || 0
          } | Indice operacional: ${
            Number(
              grupo.carga || 0
            ).toFixed(1)
          }`,
          margem + 4,
          larguraUtil - 4,
          9
        );


        if (apoio) {

          textoQuebrado(
            grupo.leitos?.length
              ? "Observacao: atribuicao excepcional ao Apoio somente neste plantao."
              : "Observacao: profissional de Apoio fora do rodizio regular.",
            margem + 4,
            larguraUtil - 4,
            8
          );
        }


        y += 4;
      }
    );


  // ========================================
  // ALTERAÇÕES DO PLANTÃO
  // ========================================

  const alteracoes =
    state.alteracoesEscala || [];


  if (alteracoes.length) {

    verificarPagina(25);


    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(
      11
    );


    doc.text(
      "ALTERACOES REGISTRADAS NO PLANTAO",
      margem,
      y
    );


    y += 6;


    alteracoes
      .slice(-10)
      .forEach(alteracao => {

        verificarPagina(12);


        textoQuebrado(
          `- ${
            alteracao.descricao ||
            alteracao.tipo ||
            "Alteracao registrada"
          }`,
          margem + 2,
          larguraUtil - 2,
          8
        );
      });


    y += 3;
  }


  // ========================================
  // AVISO
  // ========================================

  verificarPagina(25);


  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(
    9
  );


  doc.text(
    "OBSERVACAO",
    margem,
    y
  );


  y += 5;


  textoQuebrado(
    "Documento destinado a organizacao operacional da escala assistencial. A distribuicao deve ser revisada pelo profissional responsavel conforme as condicoes reais da unidade, protocolos institucionais e normas aplicaveis.",
    margem,
    larguraUtil,
    8
  );


  adicionarRodape();


  const setor =
    nomeSeguroArquivo(
      state.config.setor ||
      "setor"
    );


  const data =
    state.config.data ||
    new Date()
      .toISOString()
      .slice(0, 10);


  doc.save(
    `Escala_${setor}_${data}.pdf`
  );


  toast(
    "PDF da escala gerado com sucesso."
  );
}


// ==========================================
// COMPATIBILIDADE COM NOMES DE FUNÇÕES
// ==========================================

function gerarEscalaPDF() {
  gerarPDFEscala();
}


// ==========================================
// FORMATAÇÃO DE DATA
// ==========================================

function formatarData(data) {

  if (!data) {
    return "Não informada";
  }


  const partes =
    String(data).split("-");


  if (partes.length !== 3) {
    return String(data);
  }


  return (
    `${partes[2]}/` +
    `${partes[1]}/` +
    `${partes[0]}`
  );
}


// ==========================================
// NOME SEGURO PARA ARQUIVOS
// ==========================================

function nomeSeguroArquivo(valor) {

  return String(
    valor || "arquivo"
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .slice(0, 60) ||
    "arquivo";
}
// ==========================================
// BAIXAR ARQUIVO
// ==========================================

function baixarArquivo(
  conteudo,
  nome,
  tipo = "application/json"
) {

  const blob =
    new Blob(
      [conteudo],
      { type: tipo }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = nome;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(
    () => URL.revokeObjectURL(url),
    1000
  );
}


// ==========================================
// EXPORTAR PASSAGEM PARA O PRÓXIMO ENFERMEIRO
// ==========================================

function exportarPassagemPlantao() {

  salvarDados(false);


  const payload = {

    app:
      "Cadê a Escala?",

    marca:
      "Dia de Treinamento",

    tipo:
      "passagem_plantao",

    versao:
      "1.0",

    exportadoEm:
      new Date().toISOString(),

    avisoPrivacidade:
      "Arquivo destinado à passagem assistencial sem identificação nominal do paciente.",

    config: {

      hospital:
        state.config.hospital || "",

      setor:
        state.config.setor || "",

      data:
        state.config.data || "",

      turno:
        state.config.turno || "",

      qtdLeitos:
        state.config.qtdLeitos,

      tipoLeito:
        state.config.tipoLeito,

      identificadores:
        state.config.identificadores || ""
    },


    plantao: {

      acontecimentos:
        state.plantao.acontecimentos || "",

      passagem:
        state.plantao.passagem || ""
    },


    leitos:
      state.leitos.map(
        leito => ({

          id:
            String(leito.id),

          diagnostico:
            leito.diagnostico || "",

          gravidade:
            Number(leito.gravidade) || 0,

          respiracao:
            leito.respiracao || "AA",

          dispositivos:
            copiarObjeto(
              leito.dispositivos || []
            ),

          precaucoes:
            copiarObjeto(
              leito.precaucoes || []
            ),

          pendenciasExames:
            leito.pendenciasExames || "",

          acontecimentos:
            leito.acontecimentos || "",

          condutas:
            leito.condutas || "",

          passagem:
            leito.passagem || "",

          indiceOperacional:
            calcularIndiceOperacional(
              leito
            )
        }))
  };


  const setor =
    nomeSeguroArquivo(
      state.config.setor ||
      "plantao"
    );


  const data =
    state.config.data ||
    new Date()
      .toISOString()
      .slice(0, 10);


  baixarArquivo(

    JSON.stringify(
      payload,
      null,
      2
    ),

    `passagem_${setor}_${data}.cde`,

    "application/json"
  );


  toast(
    "Arquivo de passagem gerado. Encaminhe-o ao próximo enfermeiro."
  );
}


// ==========================================
// SELECIONAR ARQUIVO DE PASSAGEM
// ==========================================

function selecionarArquivoPassagem() {

  let input =
    document.getElementById(
      "arquivo-passagem-cde"
    );


  if (!input) {

    input =
      document.createElement(
        "input"
      );

    input.type =
      "file";

    input.id =
      "arquivo-passagem-cde";

    input.accept =
      ".cde,application/json";

    input.style.display =
      "none";


    input.addEventListener(
      "change",
      importarPassagemPlantao
    );


    document.body.appendChild(
      input
    );
  }


  input.value = "";

  input.click();
}


// ==========================================
// IMPORTAR PLANTÃO ANTERIOR
// ==========================================

function importarPassagemPlantao(
  event
) {

  const arquivo =
    event.target.files?.[0];


  if (!arquivo) {
    return;
  }


  const leitor =
    new FileReader();


  leitor.onload = () => {

    try {

      const payload =
        JSON.parse(
          String(
            leitor.result || ""
          )
        );


      // ====================================
      // VALIDAR ARQUIVO
      // ====================================

      if (
        payload.tipo !==
          "passagem_plantao" ||
        !Array.isArray(
          payload.leitos
        )
      ) {

        throw new Error(
          "Arquivo de passagem inválido."
        );
      }


      const confirmar =
        confirm(
          `IMPORTAR PLANTÃO ANTERIOR\n\nForam encontrados ${payload.leitos.length} leito(s).\n\nAs avaliações serão marcadas como IMPORTADAS e deverão ser confirmadas ou reavaliadas pelo enfermeiro atual.\n\nDeseja continuar?`
        );


      if (!confirmar) {
        return;
      }


      const configuracaoAnterior =
        payload.config || {};


      // ====================================
      // HOSPITAL E SETOR
      // ====================================
      // Só aproveita esses dados se ainda
      // não estiverem preenchidos no app.
      // ====================================

      state.config.hospital =
        state.config.hospital ||
        configuracaoAnterior.hospital ||
        "";


      state.config.setor =
        state.config.setor ||
        configuracaoAnterior.setor ||
        "";


      // ====================================
      // IDENTIFICAÇÃO DOS LEITOS
      // ====================================

      state.config.qtdLeitos =
        payload.leitos.length ||
        state.config.qtdLeitos;


      state.config.tipoLeito =
        "personalizado";


      state.config.identificadores =
        payload.leitos
          .map(
            leito =>
              String(leito.id)
          )
          .join(", ");


      // ====================================
      // IMPORTAR AVALIAÇÕES
      // ====================================

      state.leitos =
        payload.leitos.map(
          registro => ({

            ...criarLeito(
              String(registro.id)
            ),


            id:
              String(registro.id),


            diagnostico:
              registro.diagnostico ||
              "",


            gravidade:
              Math.max(
                0,
                Math.min(
                  5,
                  Number(
                    registro.gravidade
                  ) || 0
                )
              ),


            respiracao:
              RESPIRACOES.includes(
                registro.respiracao
              )

                ? registro.respiracao

                : "AA",


            dispositivos:
              Array.isArray(
                registro.dispositivos
              )

                ? registro.dispositivos.filter(
                    item =>
                      DISPOSITIVOS.includes(
                        item
                      )
                  )

                : [],


            precaucoes:
              Array.isArray(
                registro.precaucoes
              ) &&
              registro.precaucoes.length

                ? registro.precaucoes.filter(
                    item =>
                      PRECAUCOES.includes(
                        item
                      )
                  )

                : ["Padrão"],


            pendenciasExames:
              registro.pendenciasExames ||
              "",


            acontecimentos:
              registro.acontecimentos ||
              "",


            condutas:
              registro.condutas ||
              "",


            passagem:
              registro.passagem ||
              "",


            // =================================
            // MUITO IMPORTANTE:
            // A avaliação veio de outro plantão.
            // O novo enfermeiro precisa confirmar
            // ou reavaliar.
            // =================================

            avaliacaoImportada:
              true,


            importadoEm:
              new Date()
                .toISOString(),


            confirmadoNoPlantaoAtual:
              false
          })
        );


      // ====================================
      // PASSAGEM GERAL DO PLANTÃO
      // ====================================

      state.plantao.acontecimentos =
        payload.plantao
          ?.acontecimentos ||
        "";


      state.plantao.passagem =
        payload.plantao
          ?.passagem ||
        "";


      // ====================================
      // NÃO IMPORTAR A ESCALA DA EQUIPE
      // ====================================
      //
      // O próximo enfermeiro recebe as
      // informações assistenciais dos leitos,
      // mas monta a escala com a própria equipe.
      //
      // ====================================

      state.dimensionamento =
        null;


      state.rodizio.proximo =
        null;


      // ====================================
      // SALVAR
      // ====================================

      salvarDados(false);


      preencherConfiguracoes();

      atualizarDashboard();

      renderizarLeitos();

      renderizarPreviaPlantao();

      renderizarResultadoDimensionamento();


      // Depois da importação,
      // abre diretamente os leitos.

      showTab(
        "leitos"
      );


      toast(
        "Plantão anterior importado. Confirme ou reavalie cada leito."
      );
    }


    catch (erro) {

      console.error(
        "Erro ao importar passagem:",
        erro
      );


      toast(
        "Não foi possível importar este arquivo de passagem."
      );
    }
  };


  leitor.readAsText(
    arquivo
  );
}
// ==========================================
// HISTÓRICO
// ==========================================

function salvarPlantaoHistorico() {

  salvarDados(false);


  state.historico.unshift({

    id:
      Date.now(),

    salvoEm:
      new Date()
        .toLocaleString("pt-BR"),

    config:
      copiarObjeto(
        state.config
      ),

    dimensionamento:
      copiarObjeto(
        state.dimensionamento
      ),

    leitos:
      copiarObjeto(
        state.leitos
      ),

    plantao:
      copiarObjeto(
        state.plantao
      ),

    resumo: {

      criticos:
        state.leitos.filter(
          leito =>
            Number(leito.gravidade) === 5
        ).length,

      pendencias:
        contarPendencias()
    }
  });


  state.historico =
    state.historico.slice(0, 50);


  salvarDados(false);

  renderizarHistorico();

  toast(
    "Plantão salvo no histórico."
  );
}


function renderizarHistorico() {

  const elemento =
    document.getElementById(
      "lista-historico"
    );

  if (!elemento) {
    return;
  }


  elemento.innerHTML =
    state.historico.length

      ? state.historico.map(
          historico => `

            <div class="history-card">

              <h3>
                📋 ${escapeHtml(
                  historico.config.setor ||
                  "Setor não informado"
                )}
              </h3>

              <p>

                ${escapeHtml(
                  historico.config.hospital ||
                  "Instituição não informada"
                )}

                •

                ${escapeHtml(
                  historico.config.data || ""
                )}

              </p>

              <p>

                🕒 ${escapeHtml(
                  historico.config.turno || ""
                )}

                •

                🔴 ${
                  historico.resumo
                    ?.criticos || 0
                } crítico(s)

                •

                ⚠️ ${
                  historico.resumo
                    ?.pendencias || 0
                } pendência(s)

              </p>

              <p>
                <small>
                  Salvo em
                  ${escapeHtml(
                    historico.salvoEm
                  )}
                </small>
              </p>

            </div>

          `
        ).join("")

      : `
          <div class="card">

            <p class="muted">
              Nenhum plantão salvo neste dispositivo.
            </p>

          </div>
        `;
}


function limparHistorico() {

  if (
    confirm(
      "Deseja apagar todo o histórico deste dispositivo?"
    )
  ) {

    state.historico = [];

    salvarDados(false);

    renderizarHistorico();

    toast(
      "Histórico apagado."
    );
  }
}


function contarPendencias() {

  return state.leitos.reduce(
    (total, leito) =>

      total +

      [
        leito.pendenciasExames,
        leito.condutas,
        leito.passagem
      ].filter(item =>
        item?.trim()
      ).length,

    0
  );
}


// ==========================================
// DASHBOARD
// ==========================================

function atualizarDashboard() {

  const ativos =
    state.profissionais.filter(
      profissional =>
        profissional.nome?.trim() &&
        (
          profissional.situacao ===
            "presente" ||
          profissional.situacao ===
            "cobertura"
        )
    ).length;


  const criticos =
    state.leitos.filter(
      leito =>
        Number(leito.gravidade) === 5
    ).length;


  const definir =
    (id, valor) => {

      const elemento =
        document.getElementById(id);

      if (elemento) {
        elemento.textContent = valor;
      }
    };


  definir(
    "stat-leitos",
    state.leitos.length
  );

  definir(
    "stat-equipe",
    ativos
  );

  definir(
    "stat-criticos",
    criticos
  );

  definir(
    "stat-pendencias",
    contarPendencias()
  );


  const resumo =
    document.getElementById(
      "inicio-resumo"
    );


  if (resumo) {

    resumo.innerHTML = `

      <div>
        🏥
        <strong>
          ${escapeHtml(
            state.config.hospital ||
            "Instituição não configurada"
          )}
        </strong>
      </div>

      <div>
        📍
        ${escapeHtml(
          state.config.setor ||
          "Setor não configurado"
        )}
      </div>

      <div>
        📅
        ${escapeHtml(
          state.config.data || ""
        )}

        •

        ${escapeHtml(
          state.config.turno || ""
        )}
      </div>

      <div>
        👩‍⚕️
        ${escapeHtml(
          state.config.enfermeiro ||
          "Responsável não informado"
        )}
      </div>

    `;
  }


  const mapa =
    document.getElementById(
      "mapa-gravidade"
    );


  if (mapa) {

    mapa.innerHTML =
      state.leitos.map(
        leito => `

          <div
            class="severity-dot g${
              Number(leito.gravidade)
            }"
          >

            <strong>
              ${escapeHtml(leito.id)}
            </strong>

            <span>
              ${leito.gravidade}
            </span>

          </div>

        `
      ).join("");
  }
}
// ==========================================
// RELATÓRIO FINAL DO PLANTÃO — PDF
// ==========================================

async function gerarPDF() {

  salvarDados(false);


  if (!window.jspdf) {

    toast(
      "Biblioteca de PDF não carregada. Verifique a conexão."
    );

    return;
  }


  const { jsPDF } =
    window.jspdf;


  const doc =
    new jsPDF({
      unit: "mm",
      format: "a4"
    });


  let y = 15;


  const adicionar =
    (
      texto,
      tamanho = 10,
      negrito = false
    ) => {

      doc.setFont(
        "helvetica",
        negrito
          ? "bold"
          : "normal"
      );

      doc.setFontSize(tamanho);


      doc
        .splitTextToSize(
          String(texto),
          180
        )
        .forEach(linha => {

          if (y > 280) {

            doc.addPage();

            y = 15;
          }


          doc.text(
            linha,
            15,
            y
          );


          y +=
            tamanho * 0.55 + 2;
        });
    };


  // ========================================
  // CABEÇALHO
  // ========================================

  doc.setFillColor(
    17,
    24,
    39
  );


  doc.rect(
    0,
    0,
    210,
    30,
    "F"
  );


  doc.setTextColor(
    255,
    255,
    255
  );


  doc.setFontSize(18);


  doc.setFont(
    "helvetica",
    "bold"
  );


  doc.text(
    "CADE A ESCALA?",
    15,
    14
  );


  doc.setFontSize(10);


  doc.text(
    "Dia de Treinamento | Relatorio Final do Plantao",
    15,
    22
  );


  doc.setTextColor(
    20,
    30,
    45
  );


  y = 40;


  // ========================================
  // IDENTIFICAÇÃO DO PLANTÃO
  // ========================================

  adicionar(
    `Instituicao: ${
      state.config.hospital ||
      "Nao informado"
    }`,
    11,
    true
  );


  adicionar(
    `Setor: ${
      state.config.setor ||
      "Nao informado"
    }`
  );


  adicionar(
    `Data: ${
      state.config.data || ""
    } | Turno: ${
      state.config.turno || ""
    }`
  );


  adicionar(
    `Responsavel: ${
      state.config.enfermeiro ||
      "Nao informado"
    } | COREN: ${
      state.config.coren ||
      "Nao informado"
    }`
  );


  y += 3;


  // ========================================
  // AVALIAÇÃO DOS LEITOS
  // ========================================

  adicionar(
    "AVALIACAO DOS LEITOS",
    14,
    true
  );


  y += 2;


  state.leitos.forEach(
    leito => {

      adicionar(
        `LEITO ${leito.id} - Gravidade: ${
          GRAVIDADES[
            leito.gravidade
          ]
        } - Indice operacional: ${
          calcularIndiceOperacional(
            leito
          )
        }`,
        11,
        true
      );


      if (leito.diagnostico) {

        adicionar(
          `Diagnostico/descricao: ${leito.diagnostico}`
        );
      }


      adicionar(
        `Respiracao: ${
          leito.respiracao ||
          "Nao informado"
        }`
      );


      adicionar(
        `Dispositivos: ${
          (leito.dispositivos || [])
            .join(", ") ||
          "Nenhum registrado"
        }`
      );


      adicionar(
        `Precaucoes: ${
          (leito.precaucoes || [])
            .join(", ") ||
          "Nao informado"
        }`
      );


      if (
        leito.pendenciasExames
      ) {

        adicionar(
          `Exames pendentes: ${leito.pendenciasExames}`
        );
      }


      if (
        leito.acontecimentos
      ) {

        adicionar(
          `Acontecimentos: ${leito.acontecimentos}`
        );
      }


      if (leito.condutas) {

        adicionar(
          `Condutas/pendencias: ${leito.condutas}`
        );
      }


      if (leito.passagem) {

        adicionar(
          `Proximo plantao: ${leito.passagem}`
        );
      }


      if (
        leito.avaliacaoImportada &&
        !leito.confirmadoNoPlantaoAtual
      ) {

        adicionar(
          "ATENCAO: avaliacao importada do plantao anterior e ainda nao confirmada no plantao atual.",
          9,
          true
        );
      }


      y += 3;
    }
  );


  // ========================================
  // DISTRIBUIÇÃO ASSISTENCIAL
  // ========================================

  if (
    state.dimensionamento
      ?.grupos?.length
  ) {

    if (y > 240) {

      doc.addPage();

      y = 15;
    }


    adicionar(
      "DISTRIBUICAO ASSISTENCIAL DO PLANTAO",
      14,
      true
    );


    state.dimensionamento
      .grupos
      .forEach(
        grupo => {

          const profissional =
            state.profissionais.find(
              item =>
                item.id ===
                grupo.profissionalId
            );


          const apoio =
            profissionalEhApoio(
              grupo.profissionalId
            );


          const tipoApoio =
            descricaoTipoApoio(
              grupo.profissionalId
            );


          adicionar(
            `${grupo.profissional}${
              apoio
                ? ` - ${tipoApoio}`
                : ""
            }: ${
              grupo.leitos.length
            } paciente(s)/leito(s) - ${
              grupo.leitos
                .map(
                  item =>
                    item.id
                )
                .join(", ") ||
              "Sem leitos"
            } | Indice ${
              Number(
                grupo.carga || 0
              ).toFixed(1)
            }`
          );


          if (
            profissional?.situacao ===
            "cobertura"
          ) {

            adicionar(
              `Situacao: cobertura${
                profissional.cobrindo
                  ? ` de ${profissional.cobrindo}`
                  : ""
              }.`,
              9
            );
          }


          if (apoio) {

            adicionar(
              grupo.leitos.length
                ? "Atribuicao excepcional ao Apoio neste plantao."
                : "Profissional de Apoio fora do rodizio regular.",
              9
            );
          }
        }
      );
  }


  // ========================================
  // ALTERAÇÕES DA ESCALA
  // ========================================

  if (
    state.alteracoesEscala?.length
  ) {

    if (y > 245) {

      doc.addPage();

      y = 15;
    }


    adicionar(
      "ALTERACOES DA ESCALA",
      14,
      true
    );


    state.alteracoesEscala
      .forEach(
        alteracao => {

          adicionar(
            `- ${
              alteracao.descricao ||
              alteracao.tipo ||
              "Alteracao registrada"
            }`,
            9
          );
        }
      );
  }


  // ========================================
  // INFORMAÇÕES GERAIS DO PLANTÃO
  // ========================================

  if (
    state.plantao.acontecimentos ||
    state.plantao.passagem
  ) {

    if (y > 245) {

      doc.addPage();

      y = 15;
    }


    adicionar(
      "INFORMACOES GERAIS DO PLANTAO",
      14,
      true
    );


    if (
      state.plantao.acontecimentos
    ) {

      adicionar(
        `Acontecimentos gerais: ${state.plantao.acontecimentos}`
      );
    }


    if (
      state.plantao.passagem
    ) {

      adicionar(
        `Passagem geral: ${state.plantao.passagem}`
      );
    }
  }


  // ========================================
  // AVISO OPERACIONAL
  // ========================================

  if (y > 250) {

    doc.addPage();

    y = 15;
  }


  y += 4;


  adicionar(
    "OBSERVACAO",
    10,
    true
  );


  adicionar(
    "Este documento auxilia a organizacao e a passagem do plantao. As informacoes devem ser revisadas pelo profissional responsavel de acordo com a avaliacao atual, protocolos institucionais e normas aplicaveis.",
    8
  );


  // ========================================
  // RODAPÉ
  // ========================================

  doc.setFontSize(8);


  doc.setTextColor(
    100,
    116,
    139
  );


  const paginas =
    doc.internal
      .getNumberOfPages();


  for (
    let pagina = 1;
    pagina <= paginas;
    pagina++
  ) {

    doc.setPage(
      pagina
    );


    doc.text(
      `Cadê a Escala? | Dia de Treinamento - Pagina ${pagina}/${paginas}`,
      15,
      290
    );
  }


  // ========================================
  // SALVAR PDF
  // ========================================

  const nomeSetor =
    nomeSeguroArquivo(
      state.config.setor ||
      "plantao"
    );


  doc.save(
    `Relatorio_Plantao_${nomeSetor}_${
      state.config.data ||
      "sem_data"
    }.pdf`
  );


  toast(
    "Relatório final do plantão gerado com sucesso."
  );
}


// ==========================================
// FINALIZAR PLANTÃO
// ==========================================

async function finalizarPlantao() {

  salvarDados(false);


  const naoConfirmados =
    state.leitos.filter(
      leito =>
        leito.avaliacaoImportada &&
        !leito.confirmadoNoPlantaoAtual
    );


  if (
    naoConfirmados.length
  ) {

    const continuar =
      confirm(
        `ATENÇÃO\n\nExistem ${naoConfirmados.length} leito(s) com avaliação importada do plantão anterior que ainda não foram confirmados ou reavaliados neste plantão.\n\nDeseja continuar mesmo assim?`
      );


    if (!continuar) {

      showTab(
        "leitos"
      );

      return;
    }
  }


  const confirmar =
    confirm(
      "Deseja finalizar este plantão?\n\nO plantão será salvo no histórico antes da preparação do próximo."
    );


  if (!confirmar) {
    return;
  }


  // ========================================
  // CONTROLE COMERCIAL / TRIAL
  // ========================================
  // Se o auth.js disponibilizar o controle
  // de finalização, utilizamos a função dele.
  // ========================================

  if (
    typeof window
      .finalizarPlantaoComControle ===
      "function"
  ) {

    try {

      const permitido =
        await window
          .finalizarPlantaoComControle();


      if (permitido === false) {

        toast(
          "Não foi possível finalizar o plantão. Verifique o status do seu acesso."
        );

        return;
      }
    }

    catch (erro) {

      console.error(
        "Erro no controle de finalização:",
        erro
      );


      toast(
        "Não foi possível validar a finalização do plantão."
      );

      return;
    }
  }


  salvarPlantaoHistorico();


  await gerarPDF();


  // ========================================
  // PREPARAR PRÓXIMO PLANTÃO
  // ========================================

  encerrarPlantaoEPrepararProximo();
}


// ==========================================
// ENCERRAR E PREPARAR PRÓXIMO PLANTÃO
// ==========================================

function encerrarPlantaoEPrepararProximo() {

  // O Apoio temporário existe apenas
  // no plantão que está sendo encerrado.

  state.apoioTemporarioId =
    null;


  // As alterações manuais pertencem
  // ao plantão encerrado.

  state.alteracoesEscala =
    [];


  // A escala-base permanece preservada.
  // A partir dela / da distribuição atual,
  // podemos preparar o próximo rodízio.

  if (
    state.escalaBase &&
    state.rodizio?.ativo
  ) {

    preDimensionarProximoPlantao();
  }


  // ========================================
  // LIMPAR CAMPOS GERAIS DO PLANTÃO
  // ========================================

  state.plantao = {

    acontecimentos:
      "",

    passagem:
      ""
  };


  // ========================================
  // AS AVALIAÇÕES DOS LEITOS NÃO SÃO
  // AUTOMATICAMENTE APAGADAS.
  //
  // Isso permite continuidade assistencial
  // no mesmo dispositivo.
  //
  // Elas passam a ser tratadas como
  // informações provenientes do plantão
  // anterior até nova confirmação.
  // ========================================

  state.leitos =
    state.leitos.map(
      leito => ({

        ...leito,

        avaliacaoImportada:
          true,

        importadoEm:
          new Date()
            .toISOString(),

        confirmadoNoPlantaoAtual:
          false
      })
    );


  // A distribuição atual é encerrada.
  // O próximo enfermeiro poderá aplicar
  // o pré-dimensionamento ou montar
  // manualmente sua própria escala.

  state.dimensionamento =
    null;


  salvarDados(false);


  atualizarDashboard();

  renderizarLeitos();

  renderizarPreviaPlantao();

  renderizarProfissionais();

  renderizarResultadoDimensionamento();


  showTab(
    "inicio"
  );


  toast(
    "Plantão finalizado e próximo plantão preparado."
  );
}
// ==========================================
// PRÉVIA / PASSAGEM DO PLANTÃO
// ==========================================

function renderizarPreviaPlantao() {

  const acontecimentos =
    document.getElementById(
      "plantao-acontecimentos"
    );

  const passagem =
    document.getElementById(
      "plantao-passagem"
    );


  if (acontecimentos) {
    acontecimentos.value =
      state.plantao.acontecimentos || "";
  }

  if (passagem) {
    passagem.value =
      state.plantao.passagem || "";
  }


  const elemento =
    document.getElementById(
      "previa-plantao"
    );

  if (!elemento) {
    return;
  }


  const itens =
    state.leitos.filter(leito =>
      [
        leito.pendenciasExames,
        leito.acontecimentos,
        leito.condutas,
        leito.passagem
      ].some(item =>
        item?.trim()
      )
    );


  const acoesPassagem = `

    <div class="card">

      <h3>
        📦 Passagem entre plantões
      </h3>

      <p class="muted">
        Exporte um arquivo do Cadê a Escala? para o
        próximo enfermeiro. Não inclua nomes, documentos
        ou outros identificadores pessoais dos pacientes.
      </p>

      <button
        type="button"
        class="primary-btn full"
        onclick="exportarPassagemPlantao()"
      >
        📤 Exportar plantão para o próximo enfermeiro
      </button>

      <button
        type="button"
        class="secondary-btn full"
        onclick="selecionarArquivoPassagem()"
      >
        📎 IMPORTAR PLANTÃO ANTERIOR
      </button>

    </div>
  `;


  const resumo =
    itens.length

      ? itens.map(leito => `

          <div class="handover-item">

            <h4>
              🛏️ LEITO ${escapeHtml(leito.id)}
              — ${GRAVIDADES[leito.gravidade]}
            </h4>

            ${
              leito.avaliacaoImportada &&
              !leito.confirmadoNoPlantaoAtual
                ? `
                    <p>
                      <strong>
                        📥 Avaliação importada do plantão anterior
                        — ainda não confirmada.
                      </strong>
                    </p>
                  `
                : ""
            }

            ${
              leito.pendenciasExames
                ? `
                    <p>
                      <strong>Exames:</strong>
                      ${escapeHtml(leito.pendenciasExames)}
                    </p>
                  `
                : ""
            }

            ${
              leito.acontecimentos
                ? `
                    <p>
                      <strong>Acontecimentos:</strong>
                      ${escapeHtml(leito.acontecimentos)}
                    </p>
                  `
                : ""
            }

            ${
              leito.condutas
                ? `
                    <p>
                      <strong>Pendências:</strong>
                      ${escapeHtml(leito.condutas)}
                    </p>
                  `
                : ""
            }

            ${
              leito.passagem
                ? `
                    <p>
                      <strong>Próximo turno:</strong>
                      ${escapeHtml(leito.passagem)}
                    </p>
                  `
                : ""
            }

          </div>

        `).join("")

      : `
          <p class="muted">
            Nenhuma pendência registrada nos leitos.
          </p>
        `;


  elemento.innerHTML =
    acoesPassagem + resumo;
}


// ==========================================
// BACKUP
// ==========================================

function exportarBackup() {

  salvarDados(false);


  const payload = {

    app:
      "Cadê a Escala?",

    versao:
      "4.2",

    exportadoEm:
      new Date().toISOString(),

    dados:
      state
  };


  const blob =
    new Blob(
      [
        JSON.stringify(
          payload,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );


  const url =
    URL.createObjectURL(blob);


  const link =
    document.createElement("a");


  link.href = url;

  link.download =
    `backup_cade_a_escala_${
      new Date()
        .toISOString()
        .slice(0, 10)
    }.json`;


  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(url);


  toast(
    "Backup exportado."
  );
}


function importarBackup(event) {

  const arquivo =
    event.target.files?.[0];


  if (!arquivo) {
    return;
  }


  const leitor =
    new FileReader();


  leitor.onload = () => {

    try {

      const payload =
        JSON.parse(
          leitor.result
        );


      const dados =
        payload.dados ||
        payload;


      if (
        !dados.config ||
        !Array.isArray(
          dados.leitos
        )
      ) {

        throw new Error(
          "Formato inválido"
        );
      }


      Object.assign(
        state,
        dados
      );


      state.rodizio = {
        ativo: false,
        tipo: "sequencial",
        passos: 1,
        sequencia: [],
        ultimoPreDimensionamento: null,
        proximo: null,
        ...(dados.rodizio || {})
      };


      state.ui = {
        dark: false,
        ...(dados.ui || {})
      };


      state.escalaBase =
        dados.escalaBase ||
        null;


      state.alteracoesEscala =
        dados.alteracoesEscala ||
        [];


      state.apoioTemporarioId =
        dados.apoioTemporarioId ||
        null;


      normalizarProfissionais();

      normalizarLeitos();

      migrarDimensionamentoAntigo();

      salvarDados(false);

      aplicarTema();

      preencherConfiguracoes();

      atualizarDashboard();

      renderizarLeitos();

      renderizarHistorico();

      renderizarProfissionais();

      renderizarResultadoDimensionamento();

      renderizarPreviaPlantao();


      toast(
        "Backup restaurado com sucesso."
      );

    }

    catch (erro) {

      console.error(erro);

      toast(
        "Não foi possível restaurar este arquivo."
      );
    }
  };


  leitor.readAsText(
    arquivo
  );


  event.target.value = "";
}


// ==========================================
// TEMA
// ==========================================

function aplicarTema() {

  document.body.classList.toggle(
    "dark-mode",
    !!state.ui.dark
  );


  const botao =
    document.getElementById(
      "btn-theme"
    );


  if (botao) {

    botao.textContent =
      state.ui.dark
        ? "☀️"
        : "🌙";
  }
}


function alternarTema() {

  state.ui.dark =
    !state.ui.dark;

  aplicarTema();

  salvarDados(false);
}


// ==========================================
// PWA
// ==========================================

window.addEventListener(
  "beforeinstallprompt",
  evento => {

    evento.preventDefault();

    deferredPrompt = evento;


    const botao =
      document.getElementById(
        "btn-install"
      );


    if (botao) {
      botao.hidden = false;
    }
  }
);


document
  .getElementById(
    "btn-install"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (!deferredPrompt) {
        return;
      }


      deferredPrompt.prompt();

      await deferredPrompt.userChoice;

      deferredPrompt = null;


      const botao =
        document.getElementById(
          "btn-install"
        );


      if (botao) {
        botao.hidden = true;
      }
    }
  );


// ==========================================
// INICIALIZAÇÃO DO APLICATIVO
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    carregarDados();

    aplicarTema();

    preencherConfiguracoes();

    atualizarDashboard();

    renderizarLeitos();

    renderizarHistorico();

    renderizarProfissionais();

    renderizarResultadoDimensionamento();

    renderizarPreviaPlantao();


    document
      .getElementById(
        "cfg-tipo-leito"
      )
      ?.addEventListener(
        "change",
        alternarPersonalizado
      );


    document
      .getElementById(
        "btn-theme"
      )
      ?.addEventListener(
        "click",
        alternarTema
      );


    if (
      "serviceWorker" in navigator
    ) {

      navigator.serviceWorker
        .register("sw.js")
        .catch(console.warn);
    }
  }
);
