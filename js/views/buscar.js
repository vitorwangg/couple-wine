// Buscar: escreve o nome e/ou tira foto do rótulo; a IA acha o vinho.
import { sb, S, esc, garrafa, comprimir, buscar, subirFoto, atualizarPreco, carregar, toast, virgula, TIPOS, ICONE } from "../core.js";

let ultimo = null; // última busca, pra voltar do formulário sem buscar de novo

export async function telaBuscar(el) {
  el.innerHTML = `
    <div class="cab">
      <a href="#/" class="voltar" aria-label="Voltar">${ICONE.voltar}</a>
      <h1>Qual foi o vinho?</h1>
    </div>
    <form id="f" class="busca-linha">
      <label class="busca">${ICONE.lupa}<input id="q" type="search" enterkeyhint="search" placeholder="Ex.: catena malbec 2021" aria-label="Nome do vinho" value="${esc(ultimo?.texto || "")}"></label>
      <label class="cam" aria-label="Fotografar rótulo">${ICONE.camera}<input id="foto" type="file" accept="image/*" capture="environment"></label>
    </form>
    <div class="mao" style="font-size:18px;margin-top:-6px">escreva o nome ou tire foto do rótulo</div>
    <div id="previa"></div>
    <div id="res"></div>
    <a href="#/novo" id="mao" class="btn texto" style="align-self:flex-start">Cadastrar à mão, sem buscar</a>`;

  const q = el.querySelector("#q"), res = el.querySelector("#res"), previa = el.querySelector("#previa");
  let foto = null;

  el.querySelector("#mao").addEventListener("click", () => { S.draft = { nome: q.value.trim() || "", tipo: "tinto" }; });

  const rodar = async () => {
    const texto = q.value.trim();
    if (!texto && !foto) { q.focus(); return; }
    res.innerHTML = `<div class="carregando"><div class="taca-gira"></div><div><b>Procurando nas adegas do mundo…</b><br><span class="peq">leva uns 10 a 20 segundos</span></div></div>`;
    try {
      const r = await buscar({ modo: "identificar", texto, imagem: foto?.b64, mime: "image/jpeg" });
      ultimo = { texto, foto, ...r, escolhido: 0 };
      mostrarResultado(res, ultimo);
    } catch (e) {
      res.innerHTML = `<div class="card"><b>Não deu certo.</b><p class="sub" style="margin:6px 0 0">${esc(e.message)}</p></div>`;
    }
  };

  el.querySelector("#f").addEventListener("submit", (e) => { e.preventDefault(); q.blur(); rodar(); });
  el.querySelector("#foto").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    foto = await comprimir(file, 1280, 0.8);
    previa.innerHTML = `<img class="previa" src="${foto.url}" alt="Foto do rótulo">`;
    rodar();
  });

  if (ultimo?.candidatos) {
    foto = ultimo.foto;
    if (foto) previa.innerHTML = `<img class="previa" src="${foto.url}" alt="Foto do rótulo">`;
    mostrarResultado(res, ultimo);
  }
}

function mostrarResultado(res, r) {
  const cs = r.candidatos || [];
  if (!cs.length) {
    res.innerHTML = `<div class="card"><b>Não achei esse vinho.</b><p class="sub" style="margin:6px 0 0">Tente escrever o nome do produtor e da linha (ex.: “Concha y Toro Marques de Casa Concha”), ou cadastre à mão.</p></div>`;
    return;
  }
  const c = cs[r.escolhido];
  const img = c.imagem_url || r.foto?.url;
  res.innerHTML = `
    <div class="resultado">
      <div class="vitrine ging"><div class="moldura">${img ? `<img src="${esc(img)}" alt="">` : garrafa(c.tipo, 120)}</div></div>
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
        ${r.fontes?.length ? `<div class="peq">Fontes: ${esc(r.fontes.slice(0, 4).join(" · "))}</div>` : ""}
      </div>
    </div>
    <div class="linha-btns">
      <button class="btn contorno" id="quero">${ICONE.coracao}Quero provar</button>
      <button class="btn" id="bebi">${ICONE.taca}Já bebemos</button>
    </div>
    ${cs.length > 1 ? `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="lbl">Não é esse?</div>
        ${cs.map((o, i) => i === r.escolhido ? "" : `<button class="alt" data-i="${i}">${esc(o.nome)}${o.safra ? ` ${o.safra}` : ""} <span class="peq">· ${esc(o.produtor || o.pais || "")}</span></button>`).join("")}
      </div>` : ""}`;

  res.querySelectorAll(".alt").forEach((b) => b.addEventListener("click", () => { r.escolhido = Number(b.dataset.i); mostrarResultado(res, r); }));
  res.querySelector("#bebi").addEventListener("click", () => {
    S.draft = { ...c, _rotulo: r.foto?.blob || null };
    location.hash = "#/novo";
  });
  res.querySelector("#quero").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      await salvarQuero(c, r.foto?.blob);
      ultimo = null;
      S.tabAdega = "quero";
      toast("Guardado na lista de quero provar!");
      location.hash = "#/";
    } catch (err) {
      e.currentTarget.disabled = false;
      toast("Não salvou: " + err.message);
    }
  });
}

async function salvarQuero(c, rotulo) {
  const linha = { ...c, status: "quero", criado_por: S.pessoa };
  delete linha._rotulo;
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
