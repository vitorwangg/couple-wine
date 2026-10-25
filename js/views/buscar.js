// Buscar: escreve o nome (a lista de opções aparece enquanto digita) ou tira foto do rótulo.
import { sb, S, esc, garrafa, comprimir, buscar, subirFoto, atualizarPreco, carregar, toast, virgula, TIPOS, ICONE } from "../core.js";

let ultimo = null; // última busca, pra voltar do formulário sem buscar de novo

export async function telaBuscar(el) {
  el.innerHTML = `
    <div class="cab">
      <a href="#/" class="voltar" aria-label="Voltar">${ICONE.voltar}</a>
      <h1>Qual foi o vinho?</h1>
    </div>
    <form id="f" class="busca-linha">
      <label class="busca">${ICONE.lupa}<input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Ex.: Montes, DV Catena 2020" aria-label="Nome do vinho" value="${esc(ultimo?.texto || "")}"></label>
      <label class="cam" aria-label="Fotografar rótulo">${ICONE.camera}<input id="foto" type="file" accept="image/*" capture="environment"></label>
    </form>
    <div class="mao" style="font-size:18px;margin-top:-6px">escreva o nome ou tire foto do rótulo</div>
    <div id="previa"></div>
    <div id="res" style="display:flex;flex-direction:column;gap:12px"></div>
    <a href="#/novo" id="mao" class="btn texto" style="align-self:flex-start">Cadastrar à mão</a>`;

  const q = el.querySelector("#q"), res = el.querySelector("#res"), previa = el.querySelector("#previa");
  let foto = null, timer = null, pedido = 0;

  el.querySelector("#mao").addEventListener("click", () => { S.draft = { nome: q.value.trim() || "", tipo: "tinto", _manual: true }; });

  const carregando = (msg) => {
    res.innerHTML = `<div class="carregando"><div class="taca-gira"></div><div><b>${msg}</b></div></div>`;
  };

  // por nome: lista rápida de opções
  const porNome = async () => {
    const texto = q.value.trim();
    if (texto.length < 3) return;
    if (ultimo?.texto === texto && !ultimo.foto) return;
    const meu = ++pedido;
    carregando(`Procurando “${esc(texto)}”…`);
    try {
      const r = await buscar({ modo: "sugerir", texto });
      if (meu !== pedido) return;
      ultimo = { texto, foto: null, candidatos: r.candidatos || [], escolhido: null };
      mostrar(res, ultimo);
    } catch (e) {
      if (meu === pedido) erro(res, e);
    }
  };

  // por foto: a IA lê o rótulo
  const porFoto = async () => {
    const meu = ++pedido;
    carregando("Lendo o rótulo… (uns 10 a 20 segundos)");
    try {
      const r = await buscar({ modo: "identificar", texto: q.value.trim(), imagem: foto.b64, mime: "image/jpeg" });
      if (meu !== pedido) return;
      ultimo = { texto: q.value.trim(), foto, candidatos: r.candidatos || [], escolhido: null };
      mostrar(res, ultimo);
    } catch (e) {
      if (meu === pedido) erro(res, e);
    }
  };

  q.addEventListener("input", () => {
    clearTimeout(timer);
    foto = null;
    previa.innerHTML = "";
    if (q.value.trim().length < 3) { pedido++; res.innerHTML = ""; return; }
    timer = setTimeout(porNome, 800);
  });
  el.querySelector("#f").addEventListener("submit", (e) => { e.preventDefault(); q.blur(); clearTimeout(timer); porNome(); });
  el.querySelector("#foto").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    foto = await comprimir(file, 1280, 0.8);
    previa.innerHTML = `<img class="previa" src="${foto.url}" alt="Foto do rótulo">`;
    porFoto();
  });

  if (ultimo?.candidatos) {
    foto = ultimo.foto;
    if (foto) previa.innerHTML = `<img class="previa" src="${foto.url}" alt="Foto do rótulo">`;
    mostrar(res, ultimo);
  }
}

function erro(res, e) {
  res.innerHTML = `<div class="card"><b>Não deu certo.</b><p class="sub" style="margin:6px 0 0">${esc(e.message)}</p></div>`;
}

const linha2 = (c) => [c.produtor, TIPOS[c.tipo], c.uva, c.pais].filter(Boolean).join(" · ");

function mostrar(res, r) {
  if (r.escolhido == null) return lista(res, r);
  ficha(res, r);
}

// lista de opções: toca na certa
function lista(res, r) {
  const cs = r.candidatos;
  if (!cs.length) {
    res.innerHTML = `<div class="card"><b>Não achei esse vinho.</b><p class="sub" style="margin:6px 0 0">Tente o nome do produtor e da linha (ex.: “Concha y Toro Marques de Casa Concha”), ou cadastre à mão.</p></div>`;
    return;
  }
  res.innerHTML = `
    <div class="lbl">${cs.length === 1 ? "É esse?" : "Qual deles?"}</div>
    <div class="lista">
      ${cs.map((c, i) => `
        <button class="item" data-i="${i}" style="border:0;text-align:left;width:100%">
          <span class="mini">${c.imagem_url ? `<img src="${esc(c.imagem_url)}" alt="">` : garrafa(c.tipo)}</span>
          <span class="info">
            <span class="nome" style="white-space:normal">${esc(c.nome)}${c.safra ? ` ${c.safra}` : ""}</span>
            <span class="peq">${esc(linha2(c))}</span>
          </span>
          <span style="color:var(--vinho)">${ICONE.seta}</span>
        </button>`).join("")}
    </div>
    <p class="peq" style="margin:0">Não está na lista? Escreva mais do nome (a uva, a linha ou o ano) ou cadastre à mão.</p>`;
  res.querySelectorAll(".item").forEach((b) => b.addEventListener("click", () => {
    r.escolhido = Number(b.dataset.i);
    ficha(res, r);
    res.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

// o vinho escolhido, com os botões
function ficha(res, r) {
  const c = r.candidatos[r.escolhido];
  const img = c.imagem_url || r.foto?.url;
  res.innerHTML = `
    <div class="resultado">
      <div class="vitrine ging"><div class="moldura" id="moldura">${img ? `<img src="${esc(img)}" alt="">` : garrafa(c.tipo, 120)}</div></div>
      <div class="corpo">
        <div>
          <h2>${esc(c.nome)}${c.safra ? ` ${c.safra}` : ""}</h2>
          <div class="sub" style="margin-top:3px">${esc([c.produtor, [c.regiao, c.pais].filter(Boolean).join(", ")].filter(Boolean).join(" · "))}</div>
        </div>
        <div class="chips">
          <span class="forte">${TIPOS[c.tipo]}</span>
          ${[c.uva, c.teor, c.pais].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")}
        </div>
        ${c.descricao ? `<p style="margin:0;font-size:14.5px;line-height:1.5">${esc(c.descricao)}</p>` : ""}
        ${c.nota_critica ? `<div class="dado"><span class="lbl">Nota da crítica</span><b>${virgula(c.nota_critica)} <span class="estr" style="font-size:15px">★</span> <span class="peq" style="font-family:var(--sans)">${esc(c.fonte_critica || "")}</span></b></div>` : ""}
        <div class="peq">O preço de mercado é pesquisado depois que vocês salvarem.</div>
      </div>
    </div>
    <div class="linha-btns">
      <button class="btn contorno" id="quero">${ICONE.coracao}Quero provar</button>
      <button class="btn" id="bebi">${ICONE.taca}Já bebemos</button>
    </div>
    ${r.candidatos.length > 1 ? `<button class="btn texto" id="outras" style="align-self:center">Não é esse? Ver outras opções</button>` : ""}`;

  // foto da garrafa: busca depois de escolher (a lista vem sem foto pra ser rápida)
  if (!c.imagem_url && !r.foto && !c._semFoto) {
    buscar({ modo: "foto", texto: `${c.produtor || ""} ${c.nome}` }).then((x) => {
      if (x.imagem_url) c.imagem_url = x.imagem_url; else c._semFoto = true;
      const m = res.querySelector("#moldura");
      if (x.imagem_url && m && r.candidatos[r.escolhido] === c) m.innerHTML = `<img src="${esc(x.imagem_url)}" alt="">`;
    }).catch(() => {});
  }

  res.querySelector("#outras")?.addEventListener("click", () => { r.escolhido = null; lista(res, r); });
  res.querySelector("#bebi").addEventListener("click", () => {
    S.draft = { ...c, _rotulo: r.foto?.blob || null };
    delete S.draft._semFoto;
    location.hash = "#/novo";
  });
  res.querySelector("#quero").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      await salvarQuero(c, r.foto?.blob);
      ultimo = null;
      S.tabAdega = "quero";
      toast("Guardado na lista de quero provar!");
      location.hash = "#/";
    } catch (err) {
      b.disabled = false;
      toast("Não salvou: " + err.message);
    }
  });
}

async function salvarQuero(c, rotulo) {
  const linha = { ...c, status: "quero", criado_por: S.pessoa };
  delete linha._rotulo;
  delete linha._semFoto;
  const { data, error } = await sb.from("cw_vinhos").insert(linha).select().single();
  if (error) throw error;
  if (rotulo) {
    const path = await subirFoto(rotulo, `${data.id}/rotulo.jpg`);
    await sb.from("cw_vinhos").update({ rotulo_path: path }).eq("id", data.id);
  }
  await carregar();
  atualizarPreco(data).catch(() => {});
}

export const limparBusca = () => { ultimo = null; };
