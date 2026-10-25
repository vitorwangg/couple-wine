// Cadastrar na adega (novo, "bebemos!" de um vinho da lista, ou editar).
import { sb, S, PESSOAS, esc, avatar, thumb, assinar, urlDe, comprimir, subirFoto, carregar, achar, atualizarPreco,
  estrelas, estrelasTxt, virgula, hojeIso, grupo, toast, TIPOS, ICONE } from "../core.js";
import { limparBusca } from "./buscar.js";

export async function telaForm(el, id, modo) {
  const existente = id ? achar(id) : null;
  if (id && !existente) { location.hash = "#/"; return; }
  const base = existente || S.draft || { tipo: "tinto" };
  if (existente) await assinar([existente.rotulo_path, existente.foto_path]);

  // estado do formulário
  const f = {
    quem: base.quem || "nos",
    nota: { wang: existente?.n.wang?.nota ?? null, clara: existente?.n.clara?.nota ?? null },
    compraria: base.compraria ?? null,
    foto: null,
  };
  const manual = !base.nome;

  el.innerHTML = `
    <div class="cab">
      <a href="${existente ? `#/vinho/${existente.id}` : "#/buscar"}" class="voltar" aria-label="Voltar">${ICONE.voltar}</a>
      <h1>${modo === "editar" ? "Editar vinho" : "Pra nossa adega"}</h1>
    </div>

    ${manual ? "" : `
    <div class="item" style="box-shadow:none">
      <div class="mini">${base._rotulo ? `<img src="${URL.createObjectURL(base._rotulo)}" alt="">` : thumb(base)}</div>
      <div class="info"><div class="nome" style="white-space:normal">${esc(base.nome)}</div><div class="peq">${esc([TIPOS[base.tipo], base.pais, base.uva].filter(Boolean).join(" · "))}</div></div>
    </div>`}

    <form id="f" style="display:flex;flex-direction:column;gap:20px">
      <details class="mais-dados" ${manual ? "open" : ""}>
        <summary>${manual ? "Dados do vinho" : "Corrigir dados do vinho"}</summary>
        <label class="campo"><span class="lbl">Nome</span><input class="inp" name="nome" required value="${esc(base.nome || "")}"></label>
        <label class="campo"><span class="lbl">Produtor</span><input class="inp" name="produtor" value="${esc(base.produtor || "")}"></label>
        <div class="campo" style="margin-top:12px"><span class="lbl">Tipo</span>
          <div class="seg" role="group" aria-label="Tipo" id="tipo">
            ${Object.entries(TIPOS).map(([k, t]) => `<button type="button" data-v="${k}" aria-pressed="${base.tipo === k}">${t}</button>`).join("")}
          </div>
        </div>
        <div class="grade2">
          <label class="campo"><span class="lbl">Uva</span><input class="inp" name="uva" value="${esc(base.uva || "")}"></label>
          <label class="campo"><span class="lbl">País</span><input class="inp" name="pais" value="${esc(base.pais || "")}"></label>
        </div>
        <label class="campo"><span class="lbl">Região</span><input class="inp" name="regiao" value="${esc(base.regiao || "")}"></label>
      </details>

      <div class="campo">
        <span class="lbl">Quem bebeu?</span>
        <div class="escolha" id="quem">
          <button type="button" data-v="nos"><span class="duo">${avatar("wang", 28)}${avatar("clara", 28)}</span>Nós dois</button>
          <button type="button" data-v="wang">${avatar("wang", 28)}Só o Wang</button>
          <button type="button" data-v="clara">${avatar("clara", 28)}Só a Clara</button>
        </div>
        <div class="mao" style="font-size:17px" id="dica"></div>
      </div>

      <div class="card notas" id="notas"></div>

      <div class="grade2">
        <label class="campo"><span class="lbl">Safra</span><input class="inp" name="safra" inputmode="numeric" pattern="[0-9]{4}" placeholder="2021" value="${esc(base.safra || "")}"></label>
        <label class="campo"><span class="lbl">Quando</span><input class="inp" name="bebido_em" type="date" value="${esc(base.bebido_em || hojeIso())}"></label>
      </div>
      <label class="campo"><span class="lbl">Quanto pagamos</span>
        <span class="inp prefixo"><span>R$</span><input name="preco_pago" inputmode="decimal" placeholder="0,00" value="${base.preco_pago != null ? esc(virgula(base.preco_pago)) : ""}"></span>
      </label>
      <label class="campo"><span class="lbl">Onde <span style="text-transform:none;font-weight:500">(opcional)</span></span><input class="inp" name="onde" placeholder="Restaurante, loja, casa…" value="${esc(base.onde || "")}"></label>

      <div class="campo">
        <span class="lbl">Compraria de novo?</span>
        <div class="simnao" id="compraria">
          <button type="button" data-v="sim">Sim</button>
          <button type="button" data-v="nao">Não</button>
        </div>
      </div>

      <div class="campo">
        <span class="lbl">Foto de vocês com a garrafa</span>
        <label class="foto-box" id="fotoBox">
          ${existente?.foto_path && urlDe(existente.foto_path) ? `<img src="${esc(urlDe(existente.foto_path))}" alt="Foto de vocês">` : `${ICONE.camera}<span>Adicionar foto</span>`}
          <input type="file" accept="image/*" id="fotoInp" aria-label="Foto de vocês com a garrafa">
        </label>
      </div>

      <div id="erro" class="erro" role="alert"></div>
      <button class="btn grande" id="salvar">Salvar</button>
    </form>`;

  const form = el.querySelector("#f");
  let tipo = base.tipo || "tinto";

  // tipo
  el.querySelectorAll("#tipo button").forEach((b) => b.addEventListener("click", () => {
    tipo = b.dataset.v;
    el.querySelectorAll("#tipo button").forEach((x) => x.setAttribute("aria-pressed", x === b));
  }));

  // quem bebeu + notas
  const notas = el.querySelector("#notas");
  const DICAS = { nos: "entra no ranking do casal, no do Wang e no da Clara", wang: "entra só no ranking do Wang", clara: "entra só no ranking da Clara" };
  const bebeuP = (p) => f.quem === "nos" || f.quem === p;
  const desenharNotas = () => {
    el.querySelectorAll("#quem button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === f.quem));
    el.querySelector("#dica").textContent = DICAS[f.quem];
    const ps = PESSOAS.filter(bebeuP);
    const dadas = ps.map((p) => f.nota[p]).filter((n) => n != null);
    const m = dadas.length ? dadas.reduce((a, b) => a + b, 0) / dadas.length : null;
    const e = estrelas(m);
    notas.innerHTML = ps.map((p) => `
      <div class="nota-linha">
        ${avatar(p)}
        <div class="quem">Nota ${p === "wang" ? "do Wang" : "da Clara"}${p !== S.pessoa && f.nota[p] == null ? `<div class="peq" style="font-weight:500">pode deixar pra ${p === "wang" ? "ele" : "ela"} dar depois</div>` : ""}</div>
        <button type="button" class="passo" data-p="${p}" data-d="-1" aria-label="Diminuir nota ${p === "wang" ? "do Wang" : "da Clara"}">−</button>
        <div class="nota-val ${f.nota[p] == null ? "vazia" : ""}" aria-live="polite">${f.nota[p] ?? "–"}</div>
        <button type="button" class="passo" data-p="${p}" data-d="1" aria-label="Aumentar nota ${p === "wang" ? "do Wang" : "da Clara"}">+</button>
      </div>`).join("") + `
      <div class="media">
        <div><div class="lbl">${f.quem === "nos" ? "Média do casal" : "Nota final"}</div>
          <div class="peq">${f.quem === "nos" && dadas.length === 2 ? `(${f.nota.wang} + ${f.nota.clara}) ÷ 2 = ${virgula(m)}` : "de 0 a 10, vira estrelas"}</div></div>
        <div><b>${e == null ? "–" : virgula(e)}</b><span class="estr" style="font-size:16px">${estrelasTxt(e)}</span></div>
      </div>`;
    notas.querySelectorAll(".passo").forEach((b) => b.addEventListener("click", () => {
      const p = b.dataset.p, d = Number(b.dataset.d);
      f.nota[p] = f.nota[p] == null ? (d > 0 ? 8 : 7) : Math.max(0, Math.min(10, f.nota[p] + d));
      desenharNotas();
    }));
  };
  el.querySelectorAll("#quem button").forEach((b) => b.addEventListener("click", () => { f.quem = b.dataset.v; desenharNotas(); }));
  desenharNotas();

  // compraria de novo
  const desenharSimNao = () => el.querySelectorAll("#compraria button").forEach((b) =>
    b.setAttribute("aria-pressed", f.compraria != null && (b.dataset.v === "sim") === f.compraria));
  el.querySelectorAll("#compraria button").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.v === "sim";
    f.compraria = f.compraria === v ? null : v;
    desenharSimNao();
  }));
  desenharSimNao();

  // foto de vocês
  el.querySelector("#fotoInp").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    f.foto = await comprimir(file);
    const box = el.querySelector("#fotoBox");
    box.querySelectorAll(":scope > :not(input)").forEach((n) => n.remove());
    box.insertAdjacentHTML("afterbegin", `<img src="${f.foto.url}" alt="Foto de vocês">`);
  });

  // salvar
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = el.querySelector("#erro");
    const btn = el.querySelector("#salvar");
    erro.textContent = "";
    const fd = new FormData(form);
    const nome = String(fd.get("nome") || "").trim();
    if (!nome) { erro.textContent = "Falta o nome do vinho."; el.querySelector("details").open = true; return; }
    if (bebeuP(S.pessoa) && f.nota[S.pessoa] == null) { erro.textContent = "Dê a sua nota (de 0 a 10)."; return; }
    const preco = String(fd.get("preco_pago") || "").replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    const safra = Number(fd.get("safra"));
    const linha = {
      nome,
      produtor: String(fd.get("produtor") || "").trim() || null,
      tipo,
      uva: String(fd.get("uva") || "").trim() || null,
      pais: String(fd.get("pais") || "").trim() || null,
      regiao: String(fd.get("regiao") || "").trim() || null,
      safra: safra > 1900 && safra < 2100 ? safra : null,
      status: "bebido",
      quem: f.quem,
      bebido_em: fd.get("bebido_em") || null,
      preco_pago: preco ? Number(preco) : null,
      onde: String(fd.get("onde") || "").trim() || null,
      compraria: f.compraria,
    };
    btn.disabled = true;
    btn.textContent = "Salvando…";
    try {
      const id = await salvar(existente, linha, f);
      await carregar();
      const v = achar(id);
      if (!existente || !existente.preco_em) atualizarPreco(v).catch(() => {});
      S.draft = null;
      limparBusca();
      toast(modo === "editar" ? "Alterações salvas." : "Salvo na adega!");
      location.hash = bebeuP(S.pessoa) && v.n[S.pessoa]?.ordem == null ? `#/comparar/${id}` : `#/vinho/${id}`;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Salvar";
      erro.textContent = "Não salvou: " + (err.message || err);
    }
  });
}

async function salvar(existente, linha, f) {
  let id = existente?.id;
  if (existente) {
    const { error } = await sb.from("cw_vinhos").update(linha).eq("id", id);
    if (error) throw error;
    // mudou de tinto pra branco/rosé (ou o contrário): cada um encaixa de novo
    if (grupo(existente.tipo) !== grupo(linha.tipo)) {
      const r = await sb.from("cw_notas").update({ ordem: null }).eq("vinho_id", id);
      if (r.error) throw r.error;
    }
  } else {
    const d = S.draft || {};
    const extra = { descricao: d.descricao, teor: d.teor, imagem_url: d.imagem_url, nota_critica: d.nota_critica, fonte_critica: d.fonte_critica };
    const { data, error } = await sb.from("cw_vinhos").insert({ ...extra, ...linha, criado_por: S.pessoa }).select("id").single();
    if (error) throw error;
    id = data.id;
    if (d._rotulo) {
      const path = await subirFoto(d._rotulo, `${id}/rotulo.jpg`);
      await sb.from("cw_vinhos").update({ rotulo_path: path }).eq("id", id);
    }
  }

  // notas: grava só a nota (a posição no ranking fica como está); tira quem não bebeu
  const bebeuP = (p) => linha.quem === "nos" || linha.quem === p;
  const comNota = PESSOAS.filter((p) => bebeuP(p) && f.nota[p] != null).map((p) => ({ vinho_id: id, pessoa: p, nota: f.nota[p] }));
  if (comNota.length) {
    const { error } = await sb.from("cw_notas").upsert(comNota, { onConflict: "vinho_id,pessoa" });
    if (error) throw error;
  }
  const fora = PESSOAS.filter((p) => !bebeuP(p));
  if (fora.length) {
    const { error } = await sb.from("cw_notas").delete().eq("vinho_id", id).in("pessoa", fora);
    if (error) throw error;
  }

  if (f.foto) {
    const path = await subirFoto(f.foto.blob, `${id}/casal-${Date.now()}.jpg`);
    await sb.from("cw_vinhos").update({ foto_path: path }).eq("id", id);
  }
  return id;
}
