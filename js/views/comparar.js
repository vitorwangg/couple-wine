// Encaixar no ranking: "qual foi melhor?" (busca binária, no máximo ~log2(n) perguntas).
import { sb, S, NOMES, esc, avatar, thumb, origem, bebidos, bebeu, notaDe, grupo, GRUPOS, achar, carregar, assinar, outra, toast, ICONE } from "../core.js";

export async function telaComparar(el, id) {
  const v = achar(id);
  const eu = S.pessoa;
  if (!v || !bebeu(v, eu) || notaDe(v, eu) == null) { location.hash = v ? `#/vinho/${id}` : "#/"; return; }

  // meu ranking desse tipo, sem o vinho novo
  const lista = bebidos().filter((x) => x.id !== v.id && bebeu(x, eu) && grupo(x.tipo) === grupo(v.tipo) && x.n[eu]?.ordem != null)
    .sort((a, b) => a.n[eu].ordem - b.n[eu].ordem);
  await assinar([v, ...lista].map((x) => x.rotulo_path));
  let lo = 0, hi = lista.length, perguntas = 0;
  const total = Math.max(1, Math.ceil(Math.log2(lista.length + 1)));

  const cabecalho = () => `
    <div style="display:flex;align-items:center;gap:10px">
      <a href="#/vinho/${v.id}" class="voltar" aria-label="Voltar">${ICONE.voltar}</a>
      ${avatar(eu)}
      <div>
        <div class="lbl">Ranking ${eu === "wang" ? "do Wang" : "da Clara"} · ${GRUPOS[grupo(v.tipo)]}</div>
        <div class="peq">${lo < hi ? `Pergunta ${perguntas + 1} de até ${total}` : `Encaixado com ${perguntas} ${perguntas === 1 ? "pergunta" : "perguntas"}`}</div>
      </div>
    </div>`;

  const cartao = (x, selo) => `
    <span class="mini">${thumb(x, 64)}</span>
    <span style="display:flex;flex-direction:column;gap:4px">
      ${selo}
      <span class="nm">${esc(x.nome)}</span>
      <span class="peq">${esc(origem(x))} · sua nota ${notaDe(x, eu)}</span>
    </span>`;

  const perguntar = () => {
    const mid = Math.floor((lo + hi) / 2);
    const rival = lista[mid];
    el.innerHTML = cabecalho() + `
      <h1>Qual foi <em style="font-style:italic">melhor</em>?</h1>
      <button class="duelo" id="novo">${cartao(v, `<span class="tag" style="align-self:flex-start;background:var(--toalha);color:var(--papel)">NOVO</span>`)}</button>
      <div class="ou">ou</div>
      <button class="duelo" id="rival">${cartao(rival, `<span class="tag" style="align-self:flex-start">#${mid + 1} no seu ranking</span>`)}</button>
      <button class="btn texto" id="empate" style="align-self:center">Empate / não lembro bem</button>`;
    el.querySelector("#novo").addEventListener("click", () => { hi = mid; perguntas++; seguir(); });
    el.querySelector("#rival").addEventListener("click", () => { lo = mid + 1; perguntas++; seguir(); });
    el.querySelector("#empate").addEventListener("click", () => { lo = hi = mid + 1; perguntas++; seguir(); });
  };

  const seguir = async () => {
    if (lo < hi) return perguntar();
    // posição nova = no meio dos vizinhos (números com vírgula, não precisa renumerar ninguém)
    const antes = lista[lo - 1]?.n[eu].ordem, depois = lista[lo]?.n[eu].ordem;
    const ordem = antes == null && depois == null ? 0 : antes == null ? depois - 1 : depois == null ? antes + 1 : (antes + depois) / 2;
    const { error } = await sb.from("cw_notas").update({ ordem }).eq("vinho_id", v.id).eq("pessoa", eu);
    if (error) { toast("Não salvou: " + error.message); return; }
    await carregar();
    pronto(lo + 1);
  };

  const pronto = (pos) => {
    const final = [...lista.slice(0, pos - 1), v, ...lista.slice(pos - 1)];
    const o = outra(eu);
    const outraFalta = bebeu(v, o) && (notaDe(v, o) == null || achar(v.id).n[o]?.ordem == null);
    el.innerHTML = cabecalho() + `
      <div class="mao" style="font-size:24px">perfetto!</div>
      <h1 style="margin-top:-8px">${esc(v.nome)} entrou em <em>#${pos}</em></h1>
      <div class="card" style="padding:6px 14px">
        ${final.map((x, i) => `
          <div style="display:flex;align-items:center;gap:12px;min-height:46px;border-bottom:1px solid var(--linha);${x.id === v.id ? "font-weight:700;color:var(--vinho)" : ""}">
            <span style="width:26px;font-family:var(--serif);font-size:19px">${i + 1}</span>
            <span style="flex:1">${esc(x.nome)}</span>
            <span class="peq">${x.id === v.id ? "novo" : ""}</span>
          </div>`).join("")}
      </div>
      ${outraFalta ? `<p class="sub" style="margin:0">${NOMES[o]} vai ver um aviso pra ${notaDe(v, o) == null ? "dar a nota e " : ""}encaixar no ranking ${o === "wang" ? "dele" : "dela"}.</p>` : ""}
      <div class="linha-btns">
        <a href="#/comparar/${v.id}" class="btn contorno" id="refazer">Refazer</a>
        <a href="#/rankings" class="btn">Ver rankings</a>
      </div>
      <a href="#/" class="btn texto" style="align-self:center">Voltar pra adega</a>`;
    el.querySelector("#refazer").addEventListener("click", (e) => { e.preventDefault(); lo = 0; hi = lista.length; perguntas = 0; inicio(); });
  };

  const inicio = () => (lista.length ? perguntar() : seguir());
  inicio();
}
