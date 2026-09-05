// ==========================================
// ESCALA ASSISTENCIAL 4.1
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

  // Agora suporta setores maiores.
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
    passagem: ""
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

  // Não apagamos a escala silenciosamente.
  // Apenas removemos referências a leitos que deixaram de existir.
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
        calcularIndiceOperacional(
          leito
        );


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
}


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


  // Atualiza a exibição da escala atual
  // sem perder o vínculo pelo ID.
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

      // Compatibilidade com dados antigos
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

  if (!state.profissionais[indice]) {
    return;
  }

  state.profissionais[indice].tipo =
    valor;

  salvarDados(false);
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

  salvarDados(false);

  renderizarResultadoDimensionamento();
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
// PROFISSIONAIS DISPONÍVEIS
// ==========================================

function profissionaisParaEscala() {

  return state.profissionais.filter(
    profissional =>
      profissional.nome?.trim() &&
      profissional.tipo === "Técnico" &&
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


function sincronizarGruposComEquipe() {

  if (!state.dimensionamento) {
    return;
  }


  const profissionais =
    profissionaisParaEscala();


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

      Não existe limite máximo de pacientes por
      técnico.

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


        return `

          <div class="assignment-card">

            <h4>
              👤 ${escapeHtml(
                grupo.profissional
              )}
            </h4>


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
      onclick="salvarEscalaManual()"
    >
      💾 Salvar escala manual
    </button>


    ${
      state.escalaBase
        ? `
          <button
            class="secondary-btn full"
            onclick="restaurarEscalaBase()"
          >
            ↩️ Voltar à escala-base
          </button>
        `
        : ""
    }
  `;
}


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
        id: String(leitoId),
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


  // A primeira escala manual salva
  // torna-se a escala-base.
  if (!state.escalaBase) {

    state.escalaBase =
      copiarObjeto(
        state.dimensionamento
      );

    toast(
      "Primeira escala manual salva como escala-base."
    );
  }

  else {

    state.alteracoesEscala.push({

      id: gerarId(),

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
// RESULTADO / EDIÇÃO DA DISTRIBUIÇÃO
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
              id: String(item.id),
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


  const maximo =
    Math.max(...cargas, 0);


  const minimo =
    Math.min(...cargas, 0);


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


          return `

            <div class="assignment-card">

              <h4>
                👤 ${escapeHtml(
                  grupo.profissional
                )}
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
                  ${
                    grupo.leitos.length
                  }
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
        onclick="iniciarEscalaManual()"
      >
        ✏️ Editar distribuição completa
      </button>


      ${
        state.escalaBase
          ? `
            <button
              class="secondary-btn full"
              onclick="restaurarEscalaBase()"
            >
              ↩️ Voltar à escala-base
            </button>
          `
          : ""
      }


      <p class="muted">

        ⚠️ A distribuição é uma ferramenta de
        organização operacional. A decisão final
        permanece com o profissional responsável,
        conforme condições reais da unidade,
        protocolos institucionais e normas aplicáveis.

      </p>

    </div>
  `;
}


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
      behavior: "smooth",
      block: "start"
    });

  }, 100);
}


// ==========================================
// TRANSFERÊNCIA MANUAL
// ==========================================

function abrirTransferencia(
  profissionalOrigemId
) {

  if (!state.dimensionamento) {
    return;
  }


  const origem =
    state.dimensionamento.grupos.find(
      grupo =>
        grupo.profissionalId ===
        profissionalOrigemId
    );


  if (!origem?.leitos?.length) {

    toast(
      "Este profissional não possui pacientes/leitos para transferir."
    );

    return;
  }


  const opcoesLeitos =
    origem.leitos
      .map(
        item =>
          `${item.id}`
      )
      .join(", ");


  const leitoEscolhido =
    prompt(
      `Qual paciente/leito deseja transferir?\n\nLeitos de ${origem.profissional}: ${opcoesLeitos}`
    );


  if (!leitoEscolhido) {
    return;
  }


  const leito =
    origem.leitos.find(
      item =>
        String(item.id)
          .toLowerCase() ===
        String(leitoEscolhido)
          .trim()
          .toLowerCase()
    );


  if (!leito) {

    toast(
      "Paciente/leito não encontrado com este profissional."
    );

    return;
  }


  const destinos =
    state.dimensionamento.grupos
      .filter(
        grupo =>
          grupo.profissionalId !==
          profissionalOrigemId
      )
      .filter(grupo => {

        const profissional =
          state.profissionais.find(
            item =>
              item.id ===
              grupo.profissionalId
          );

        return (
          !profissional ||
          profissional.situacao ===
            "presente" ||
          profissional.situacao ===
            "cobertura"
        );
      });


  if (!destinos.length) {

    toast(
      "Não existe outro profissional disponível para receber este paciente/leito."
    );

    return;
  }


  const listaDestinos =
    destinos
      .map(
        (grupo, indice) =>
          `${indice + 1} - ${grupo.profissional}`
      )
      .join("\n");


  const escolha =
    prompt(
      `Transferir leito ${leito.id} para:\n\n${listaDestinos}\n\nDigite o número do profissional.`
    );


  if (!escolha) {
    return;
  }


  const indiceDestino =
    Number(escolha) - 1;


  const destino =
    destinos[indiceDestino];


  if (!destino) {

    toast(
      "Profissional de destino inválido."
    );

    return;
  }


  const motivo =
    prompt(
      "Motivo da alteração (opcional):\nEx.: complexidade, isolamento, necessidade do setor..."
    ) || "";


  origem.leitos =
    origem.leitos.filter(
      item =>
        String(item.id) !==
        String(leito.id)
    );


  destino.leitos =
    destino.leitos || [];


  destino.leitos.push(
    copiarObjeto(leito)
  );


  state.alteracoesEscala.push({

    id: gerarId(),

    data:
      new Date().toISOString(),

    tipo:
      "transferencia",

    leito:
      String(leito.id),

    origem:
      origem.profissional,

    destino:
      destino.profissional,

    motivo:
      motivo.trim()
  });


  recalcularCargasDimensionamento();

  salvarDados(false);

  renderizarResultadoDimensionamento();

  toast(
    `Leito ${leito.id} transferido para ${destino.profissional}.`
  );
}


// ==========================================
// ESCALA-BASE
// ==========================================

function restaurarEscalaBase() {

  if (!state.escalaBase) {

    toast(
      "Ainda não existe uma escala-base salva."
    );

    return;
  }


  const confirmar = confirm(
    "Deseja restaurar a escala-base? As alterações manuais deste plantão serão substituídas."
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


  recalcularCargasDimensionamento();

  salvarDados(false);

  renderizarResultadoDimensionamento();
  renderizarEditorEscalaManual();

  toast(
    "Escala-base restaurada."
  );
}


// ==========================================
// SUGESTÃO POR CARGA
// NÃO SUBSTITUI A ESCALA MANUAL
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
      id: String(leito.id),
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
    grupos.map(grupo =>
      `${grupo.profissional}: ${
        grupo.leitos
          .map(item => item.id)
          .join(", ") || "sem leitos"
      }`
    ).join("\n");


  const aplicar = confirm(
    `SUGESTÃO POR CARGA ASSISTENCIAL\n\n${resumo}\n\nEsta é apenas uma sugestão. Deseja aplicá-la ao plantão atual?`
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

    id: gerarId(),

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


// Compatibilidade com botão antigo,
// caso ainda exista em alguma versão do HTML.
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
// RODÍZIO CONFIGURÁVEL
// ==========================================

function abrirConfiguracaoRodizio() {

  const atual =
    state.rodizio.passos || 1;


  const escolha =
    prompt(
      "Quantas posições cada paciente/leito deve avançar no próximo plantão?\n\nExemplo:\n1 = 1→2, 2→3, 3→4\n2 = 1→3, 2→4, 3→5\n\nDigite um número:",
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
  state.rodizio.tipo = "sequencial";
  state.rodizio.passos = passos;


  salvarDados(false);


  toast(
    `Rodízio configurado para avançar ${passos} posição(ões).`
  );
}


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


  const grupos =
    copiarObjeto(
      origem.grupos || []
    );


  grupos.forEach(grupo => {

    const profissional =
      state.profissionais.find(
        item =>
          item.id ===
          grupo.profissionalId
      );


    // Titular ausente ou de troca
    // mantém a posição estrutural.
    // Não alteramos a escala-base.
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
            id: novoId,
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
      `Rodízio configurado: avanço de ${passos} posição(ões).`,

    grupos
  };


  salvarDados(false);

  renderizarPreDimensionamento();
}


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


  elemento.classList.remove("hidden");


  elemento.innerHTML = `

    <div class="alert-box">

      🔄 ${escapeHtml(
        proximo.modo
      )}

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
      onclick="aplicarPreDimensionamento()"
    >
      ✅ Usar como escala do próximo plantão
    </button>

  `;
}


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


  state.rodizio.ultimoPreDimensionamento =
    copiarObjeto(
      state.dimensionamento
    );


  state.rodizio.proximo = null;


  salvarDados(false);

  renderizarResultadoDimensionamento();

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
// TROCAS E COBERTURAS
// ==========================================

function abrirTrocasCoberturas() {

  const painel =
    document.getElementById(
      "painel-trocas-coberturas"
    );

  if (!painel) {
    return;
  }


  painel.classList.remove("hidden");


  painel.innerHTML = `

    <div class="alert-box">

      As alterações abaixo valem para o
      plantão atual e não substituem
      permanentemente o titular na escala-base.

    </div>


    ${
      state.profissionais.map(
        (profissional, indice) => `

          <div class="assignment-card">

            <h4>
              👤 ${escapeHtml(
                profissional.nome ||
                "Profissional sem identificação"
              )}
            </h4>


            <label>
              Situação neste plantão
            </label>


            <select
              onchange="
                atualizarSituacaoProfissional(
                  ${indice},
                  this.value
                );
                abrirTrocasCoberturas();
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
                🟢 Titular presente
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
                🔄 De troca — ausente neste plantão
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
                🟡 Cobertura de outro plantão
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


            ${
              profissional.situacao ===
              "cobertura"
                ? `

                  <label>
                    Quem está cobrindo?
                    / Observação
                  </label>

                  <input
                    value="${escapeHtml(
                      profissional.cobrindo || ""
                    )}"
                    placeholder="Ex.: cobrindo João / plantão noturno"
                    onchange="
                      state.profissionais[
                        ${indice}
                      ].cobrindo =
                        this.value.trim();

                      salvarDados(false);
                    "
                  >

                `
                : ""
            }

          </div>

        `
      ).join("")
    }


    <button
      class="primary-btn full"
      onclick="
        salvarDados(false);
        renderizarProfissionais();
        renderizarResultadoDimensionamento();
        toast('Trocas e coberturas atualizadas.');
      "
    >
      💾 Salvar alterações do plantão
    </button>

  `;
}


// ==========================================
// ENCERRAR PLANTÃO / PREPARAR PRÓXIMO
// ==========================================

function encerrarPlantaoEPrepararProximo() {

  salvarPlantaoHistorico();


  if (!state.dimensionamento) {

    toast(
      "Monte a escala manual antes de preparar o próximo plantão."
    );

    showTab("dimensionamento");

    return;
  }


  state.rodizio.ultimoPreDimensionamento =
    copiarObjeto(
      state.dimensionamento
    );


  state.rodizio.proximo = null;


  // Situações temporárias não devem
  // alterar permanentemente a equipe.
  state.profissionais.forEach(
    profissional => {

      if (
        profissional.situacao ===
        "troca" ||
        profissional.situacao ===
        "ausente"
      ) {

        profissional.situacao =
          "presente";

        profissional.ativo = true;
      }
    }
  );


  salvarDados(false);

  showTab("dimensionamento");

  preDimensionarProximoPlantao();

  toast(
    "Plantão salvo e próximo plantão preparado."
  );
}


// ==========================================
// PASSAGEM DE PLANTÃO
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


  elemento.innerHTML =
    itens.length

      ? itens.map(leito => `

          <div class="handover-item">

            <h4>

              🛏️ LEITO
              ${escapeHtml(leito.id)}

              —
              ${
                GRAVIDADES[
                  leito.gravidade
                ]
              }

            </h4>


            ${
              leito.pendenciasExames
                ? `
                  <p>
                    <strong>Exames:</strong>
                    ${escapeHtml(
                      leito.pendenciasExames
                    )}
                  </p>
                `
                : ""
            }


            ${
              leito.acontecimentos
                ? `
                  <p>
                    <strong>Acontecimentos:</strong>
                    ${escapeHtml(
                      leito.acontecimentos
                    )}
                  </p>
                `
                : ""
            }


            ${
              leito.condutas
                ? `
                  <p>
                    <strong>Pendências:</strong>
                    ${escapeHtml(
                      leito.condutas
                    )}
                  </p>
                `
                : ""
            }


            ${
              leito.passagem
                ? `
                  <p>
                    <strong>Próximo turno:</strong>
                    ${escapeHtml(
                      leito.passagem
                    )}
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
// PDF
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
    "ESCALA ASSISTENCIAL",
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


  adicionar(
    "AVALIACAO DOS LEITOS",
    14,
    true
  );


  y += 2;


  state.leitos.forEach(leito => {

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


    if (leito.pendenciasExames) {
      adicionar(
        `Exames pendentes: ${leito.pendenciasExames}`
      );
    }


    if (leito.acontecimentos) {
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


    y += 3;
  });


  if (
    state.dimensionamento
      ?.grupos?.length
  ) {

    if (y > 240) {

      doc.addPage();

      y = 15;
    }


    adicionar(
      "ESCALA ASSISTENCIAL DO PLANTAO",
      14,
      true
    );


    state.dimensionamento
      .grupos
      .forEach(grupo => {

        adicionar(
          `${grupo.profissional}: ${
            grupo.leitos.length
          } paciente(s)/leito(s) - ${
            grupo.leitos
              .map(item => item.id)
              .join(", ") ||
            "Sem leitos"
          } | Indice ${
            Number(
              grupo.carga || 0
            ).toFixed(1)
          }`
        );
      });
  }


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


    if (state.plantao.passagem) {

      adicionar(
        `Passagem geral: ${state.plantao.passagem}`
      );
    }
  }


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

    doc.setPage(pagina);

    doc.text(
      `Dia de Treinamento - Pagina ${pagina}/${paginas}`,
      15,
      290
    );
  }


  const nomeSetor =
    (
      state.config.setor ||
      "Plantao"
    )
      .replace(/\s+/g, "_")
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      );


  doc.save(
    `Escala_${nomeSetor}_${
      state.config.data ||
      "relatorio"
    }.pdf`
  );


  toast(
    "PDF gerado com sucesso."
  );
}


// ==========================================
// BACKUP
// ==========================================

function exportarBackup() {

  salvarDados(false);


  const payload = {

    app:
      "Escala Assistencial",

    versao:
      "4.1",

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
    `backup_escala_${
      new Date()
        .toISOString()
        .slice(0, 10)
    }.json`;


  link.click();

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
// INICIALIZAÇÃO
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
