// Base do app: Supabase, estado compartilhado, notas, rankings e fotos.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "../config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// estado compartilhado entre as telas
export const S = {
  session: null,
  pessoa: null,        // 'wang' | 'clara'
  vinhos: [],          // todos os vinhos, com as notas em v.n.wang / v.n.clara
  draft: null,         // vinho vindo da busca, antes de salvar
  tabAdega: "bebido",
  dono: "nos",
  tipoRank: "geral",
};

export const NOMES = { wang: "Wang", clara: "Clara" };
export const PESSOAS = ["wang", "clara"];
export const outra = (p) => (p === "wang" ? "clara" : "wang");
export const TIPOS = { tinto: "Tinto", branco: "Branco", rose: "Rosé" };

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const brl = (v) => (v == null || !isFinite(v) ? "–" : "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
export const virgula = (n) => String(n).replace(".", ",");
const pad = (n) => String(n).padStart(2, "0");
export const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const fmtData = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "–");
export const plain = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("on"), 3200);
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------
export async function carregar() {
  const [v, n] = await Promise.all([
    sb.from("cw_vinhos").select("*").order("criado_em", { ascending: false }),
    sb.from("cw_notas").select("*"),
  ]);
  if (v.error) throw v.error;
  if (n.error) throw n.error;
  const porVinho = {};
  for (const r of n.data) (porVinho[r.vinho_id] ||= {})[r.pessoa] = r;
  S.vinhos = v.data.map((x) => ({ ...x, n: porVinho[x.id] || {} }));
  return S.vinhos;
}

export const achar = (id) => S.vinhos.find((v) => v.id === id);
export const bebidos = () => S.vinhos.filter((v) => v.status === "bebido");
export const bebeu = (v, p) => v.status === "bebido" && (v.quem === "nos" || v.quem === p);
export const notaDe = (v, p) => v.n[p]?.nota ?? null;
// tintos de um lado, brancos e rosés do outro
export const grupo = (tipo) => (tipo === "tinto" ? "tinto" : "branco");
export const GRUPOS = { tinto: "Tintos", branco: "Brancos e rosés" };

// média de quem já deu nota (0 a 10); null se ninguém deu
export function media(v) {
  const ns = PESSOAS.filter((p) => bebeu(v, p)).map((p) => notaDe(v, p)).filter((x) => x != null);
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
}
// 0–10 vira 0–5 estrelas, de meia em meia
export const estrelas = (m) => (m == null ? null : Math.round(m) / 2);
export function estrelasTxt(e) {
  if (e == null) return "☆☆☆☆☆";
  const f = Math.floor(e), h = e - f >= 0.5;
  return "★".repeat(f) + (h ? "½" : "") + "☆".repeat(5 - f - (h ? 1 : 0));
}

// o que falta pra pessoa: dar a nota ou encaixar no ranking
export function pendentes(p) {
  return bebidos().filter((v) => bebeu(v, p) && (notaDe(v, p) == null || v.n[p]?.ordem == null))
    .map((v) => ({ v, falta: notaDe(v, p) == null ? "nota" : "ranking" }));
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------
// dono: 'nos' | 'wang' | 'clara'; tipo: 'geral' | 'tinto' | 'branco'
export function ranking(dono, tipo) {
  const doTipo = (v) => tipo === "geral" || grupo(v.tipo) === tipo;
  if (dono === "nos") {
    return bebidos().filter((v) => v.quem === "nos" && doTipo(v) && notaDe(v, "wang") != null && notaDe(v, "clara") != null)
      .sort((a, b) => media(b) - media(a) || (a.n.wang.ordem ?? 0) + (a.n.clara.ordem ?? 0) - ((b.n.wang.ordem ?? 0) + (b.n.clara.ordem ?? 0)));
  }
  const dele = bebidos().filter((v) => bebeu(v, dono) && doTipo(v) && notaDe(v, dono) != null);
  if (tipo === "geral") return dele.sort((a, b) => notaDe(b, dono) - notaDe(a, dono) || (a.n[dono].ordem ?? 1e9) - (b.n[dono].ordem ?? 1e9));
  // na ordem das comparações; quem ainda não foi encaixado vai pro fim, pela nota
  const ok = dele.filter((v) => v.n[dono].ordem != null).sort((a, b) => a.n[dono].ordem - b.n[dono].ordem);
  const falta = dele.filter((v) => v.n[dono].ordem == null).sort((a, b) => notaDe(b, dono) - notaDe(a, dono));
  return [...ok, ...falta];
}

export function posicao(v, dono, tipo) {
  const i = ranking(dono, tipo).findIndex((x) => x.id === v.id);
  return i < 0 ? null : i + 1;
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------
const urlCache = {};
// links temporários das fotos privadas (1 h)
export async function assinar(paths) {
  const faltam = [...new Set(paths.filter((p) => p && !urlCache[p]))];
  if (faltam.length) {
    const { data } = await sb.storage.from("cw-fotos").createSignedUrls(faltam, 3600);
    for (const d of data || []) if (d.signedUrl) urlCache[d.path] = d.signedUrl;
  }
  return urlCache;
}
export const urlDe = (path) => (path ? urlCache[path] : null);

// diminui a foto antes de mandar (a do celular tem vários MB)
export async function comprimir(file, max = 1600, q = 0.82) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
  const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
  return { blob, b64, url: URL.createObjectURL(blob) };
}

export async function subirFoto(blob, path) {
  const { error } = await sb.storage.from("cw-fotos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  delete urlCache[path];
  return path;
}

// ---------------------------------------------------------------------------
// Busca (função buscar-vinho no Supabase)
// ---------------------------------------------------------------------------
export async function buscar(body) {
  const { data, error } = await sb.functions.invoke("buscar-vinho", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).erro || msg; } catch { /* resposta sem JSON */ }
    throw new Error(msg);
  }
  if (data?.erro) throw new Error(data.erro);
  return data;
}

// pesquisa o preço de mercado e guarda no vinho (roda em segundo plano)
export async function atualizarPreco(v) {
  const p = await buscar({ modo: "preco", nome: v.nome, produtor: v.produtor, safra: v.safra });
  const campos = { preco_min: p.preco_min, preco_max: p.preco_max, preco_lojas: p.lojas, preco_em: hojeIso() };
  const { error } = await sb.from("cw_vinhos").update(campos).eq("id", v.id);
  if (error) throw error;
  Object.assign(v, campos);
  return v;
}

// ---------------------------------------------------------------------------
// Pedaços de interface
// ---------------------------------------------------------------------------
const COR_GARRAFA = { tinto: "#7A1F2B", branco: "#D9C36A", rose: "#E39AA2" };
export const garrafa = (tipo, h = 52) =>
  `<svg width="${Math.round(h * 18 / 52)}" height="${h}" viewBox="0 0 18 52" aria-hidden="true"><path d="M6 1h6v12c0 3 5 6 5 12v24a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V25c0-6 5-9 5-12z" fill="${COR_GARRAFA[tipo] || COR_GARRAFA.tinto}"/><rect x="3" y="30" width="12" height="11" rx="1" fill="#FBF6EC"/></svg>`;

// miniatura: foto da garrafa, foto do rótulo ou o desenho
export function thumb(v, h = 52) {
  const src = v.imagem_url || urlDe(v.rotulo_path);
  return src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.replaceWith(document.createRange().createContextualFragment(this.dataset.f))" data-f="${esc(garrafa(v.tipo, h))}">` : garrafa(v.tipo, h);
}

export const avatar = (p, size = 36) => `<span class="av av-${p}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px">${p === "wang" ? "W" : "C"}</span>`;

export const origem = (v) => [v.pais, v.uva, v.safra].filter(Boolean).join(" · ");

export function notasCurtas(v) {
  return PESSOAS.filter((p) => bebeu(v, p)).map((p) => `${p === "wang" ? "W" : "C"} ${notaDe(v, p) ?? "–"}`).join(" · ");
}

export const quemTxt = (q) => ({ nos: "Nós dois", wang: "Só Wang", clara: "Só Clara" }[q] || "");

export const ICONE = {
  voltar: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`,
  seta: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
  camera: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  lupa: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`,
  coracao: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>`,
  taca: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 3h10l-1 7a4 4 0 0 1-8 0z"/><path d="M12 14v7M8 21h8"/></svg>`,
  avancar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
};
