// Busca de vinhos do Couple Wine (Supabase Edge Function "buscar-vinho").
// modo "identificar": nome digitado e/ou foto do rótulo → até 3 vinhos com ficha.
// modo "preco": preço de mercado no Brasil de um vinho já identificado.
// Usa o Gemini (plano grátis) com pesquisa no Google. A chave fica no segredo GEMINI_API_KEY.

const KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
// no plano grátis o Google às vezes responde "alta demanda": tenta o próximo modelo
const MODELS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!KEY) throw new Error("Falta configurar o segredo GEMINI_API_KEY no Supabase.");
    if (!(await doCasal(req.headers.get("Authorization")))) return json({ erro: "Só o casal pode buscar." }, 403);
    const body = await req.json();
    return json(body.modo === "preco" ? await preco(body) : body.modo === "sugerir" ? await sugerir(body) : await identificar(body));
  } catch (e) {
    return json({ erro: String((e as Error).message || e) }, 500);
  }
});

// só quem está em cw_casal usa a busca (gasta a cota grátis do Gemini)
async function doCasal(auth: string | null) {
  if (!auth) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cw_membro`, {
    method: "POST",
    headers: { Authorization: auth, apikey: ANON, "Content-Type": "application/json" },
    body: "{}",
  });
  return r.ok && (await r.json()) != null;
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

// pesquisar=true usa a pesquisa do Google; se a cota grátis dela acabar, responde com o que o modelo sabe
async function gemini(parts: Part[], pesquisar = true) {
  let last: unknown;
  for (const comBusca of pesquisar ? [true, false] : [false]) {
    const body = { contents: [{ parts }], ...(comBusca ? { tools: [{ google_search: {} }] } : {}), generationConfig: { temperature: 0.2 } };
    for (const model of comBusca ? MODELS : [...MODELS].reverse()) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": KEY!, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json();
        const cand = d.candidates?.[0];
        if (!cand?.content?.parts) throw new Error(d.error?.message || "resposta vazia");
        const text = cand.content.parts.map((p: { text?: string }) => p.text || "").join("");
        const fontes = [...new Set((cand.groundingMetadata?.groundingChunks || [])
          .map((c: { web?: { title?: string } }) => c.web?.title).filter(Boolean))] as string[];
        return { data: lerJson(text), fontes, pesquisou: comBusca };
      } catch (e) {
        last = e;
        console.log(`[gemini] ${model}${comBusca ? " +google" : ""}: ${String((e as Error).message || e).slice(0, 120)}`);
      }
    }
  }
  throw new Error(`A busca está sobrecarregada agora. Tente de novo em alguns minutos. (${String((last as Error)?.message || last).slice(0, 80)})`);
}

// o modelo às vezes embrulha o JSON em ```json … ```
function lerJson(text: string) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("resposta sem JSON");
  return JSON.parse(text.slice(a, b + 1));
}

async function identificar(body: { texto?: string; imagem?: string; mime?: string }) {
  const texto = (body.texto || "").trim().slice(0, 200);
  if (!texto && !body.imagem) throw new Error("Escreva o nome ou mande a foto do rótulo.");
  const parts: Part[] = [{
    text: `Você é um sommelier brasileiro. Identifique o vinho ${body.imagem ? "da foto do rótulo" : ""}${texto ? ` (o casal escreveu: "${texto}")` : ""}.
Pesquise no Google para confirmar produtor, safra e dados.
Responda SOMENTE com um JSON neste formato, sem texto antes ou depois:
{"candidatos":[{"nome":"nome comercial sem a safra","produtor":"vinícola","safra":2021,"tipo":"tinto|branco|rose","uva":"uva ou corte","pais":"país em português","regiao":"região","teor":"13,5%","descricao":"2 frases em português sobre aromas e boca","nota_critica":4.1,"fonte_critica":"Vivino"}]}
Regras: até 3 candidatos, o mais provável primeiro. safra null se não souber. nota_critica de 0 a 5 (nota média no Vivino, se achar), senão null. Espumante conta como "branco". Não invente: deixe null o que não achar.`,
  }];
  if (body.imagem) parts.push({ inline_data: { mime_type: body.mime || "image/jpeg", data: body.imagem } });
  const { data, fontes } = await gemini(parts);
  const candidatos = (data.candidatos || []).slice(0, 3).map(limpar);
  if (candidatos[0]) candidatos[0].imagem_url = await imagemVivino(`${candidatos[0].produtor || ""} ${candidatos[0].nome}`);
  return { candidatos, fontes };
}

// enquanto digita no cadastro: rápido, sem pesquisa no Google, até 4 vinhos
async function sugerir(body: { texto?: string }) {
  const texto = (body.texto || "").trim().slice(0, 120);
  if (texto.length < 3) return { candidatos: [] };
  const { data } = await gemini([{
    text: `Você é um sommelier brasileiro. O casal está digitando o nome de um vinho: "${texto}".
Liste os vinhos reais que mais provavelmente correspondem (pode ser nome incompleto, abreviado ou com erro de digitação; ex.: "DV Catena" = linha D.V. Catena da Catena Zapata). Se o texto tiver um ano, use como safra.
Responda SOMENTE com um JSON, sem texto antes ou depois:
{"candidatos":[{"nome":"nome comercial sem a safra","produtor":"vinícola","safra":2020,"tipo":"tinto|branco|rose","uva":"uva ou corte","pais":"país em português","regiao":"região","teor":"13,5%","descricao":"2 frases em português sobre aromas e boca","nota_critica":4.1,"fonte_critica":"Vivino"}]}
Regras: até 4 candidatos, o mais provável primeiro. nota_critica de 0 a 5 só se souber, senão null. Espumante conta como "branco". Não invente vinhos que não existem.`,
  }], false);
  return { candidatos: (data.candidatos || []).slice(0, 4).map(limpar).filter((c: { nome: string }) => c.nome) };
}

async function preco(body: { nome: string; produtor?: string; safra?: number }) {
  const vinho = [body.produtor, body.nome, body.safra].filter(Boolean).join(" ");
  const { data, fontes, pesquisou } = await gemini([{
    text: `Pesquise no Google o preço atual de venda no Brasil, em reais, da garrafa de 750 ml do vinho "${vinho}" — os mesmos preços que aparecem quando se busca o nome do vinho no Google (Google Shopping).
Inclua lojas de vinho e importadoras (Wine.com.br, Evino, Grand Cru, Divvino, Mistral, Vinci, Casa Flora, World Wine, Vivino Brasil), supermercados e empórios (Pão de Açúcar, Carrefour, Zona Sul, St Marche, Verdemar), Amazon (vendido pela Amazon) e lojas online confiáveis.
NÃO use marketplaces de vendedores avulsos: Mercado Livre, Shopee, OLX, Magalu marketplace, AliExpress.
Ignore kits, caixas com várias garrafas, garrafas de outro tamanho e safras muito diferentes.
Responda SOMENTE com um JSON, sem texto antes ou depois:
{"preco_min":89.9,"preco_max":129.9,"lojas":[{"loja":"Evino","preco":109.9}]}
Use só preços que você encontrou de verdade (até 8 lojas, do mais barato ao mais caro).
Se você não conseguir pesquisar na internet, estime a faixa de preço típica desse vinho no varejo brasileiro hoje e deixe "lojas" vazia. Se não conhecer o vinho, use null nos preços.`,
  }]);
  const proibida = /mercado\s*livre|shopee|olx|aliexpress/i;
  const lojas = (data.lojas || []).filter((l: { loja?: string; preco?: unknown }) => num(l.preco) != null && !proibida.test(String(l.loja)))
    .map((l: { loja?: string; preco?: unknown }) => ({ loja: String(l.loja || "loja"), preco: num(l.preco) as number }))
    .sort((a: { preco: number }, b: { preco: number }) => a.preco - b.preco).slice(0, 8);
  const ps = lojas.map((l: { preco: number }) => l.preco);
  return {
    preco_min: num(data.preco_min) ?? (ps.length ? Math.min(...ps) : null),
    preco_max: num(data.preco_max) ?? (ps.length ? Math.max(...ps) : null),
    lojas: pesquisou ? lojas : [], fontes, estimado: !pesquisou,
  };
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/[^\d,.]/g, "").replace(",", ".")) : Number(v);
  return v == null || !isFinite(n) || n <= 0 ? null : Math.round(n * 100) / 100;
};

function limpar(c: Record<string, unknown>) {
  const tipo = String(c.tipo || "").toLowerCase();
  const nota = num(c.nota_critica);
  return {
    nome: String(c.nome || "").trim(),
    produtor: c.produtor ? String(c.produtor) : null,
    safra: Number.isInteger(Number(c.safra)) && Number(c.safra) > 1900 ? Number(c.safra) : null,
    tipo: tipo.startsWith("bran") ? "branco" : tipo.startsWith("ros") ? "rose" : "tinto",
    uva: c.uva ? String(c.uva) : null,
    pais: c.pais ? String(c.pais) : null,
    regiao: c.regiao ? String(c.regiao) : null,
    teor: c.teor ? String(c.teor) : null,
    descricao: c.descricao ? String(c.descricao) : null,
    nota_critica: nota != null && nota <= 5 ? nota : null,
    fonte_critica: nota != null && nota <= 5 ? String(c.fonte_critica || "crítica") : null,
    imagem_url: null as string | null,
  };
}

// foto da garrafa: tenta a busca pública do Vivino (pode falhar; aí o app desenha uma garrafa)
async function imagemVivino(q: string) {
  try {
    const r = await fetch(`https://www.vivino.com/search/wines?q=${encodeURIComponent(q.trim())}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "Accept-Language": "pt-BR,pt;q=0.9" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await r.text();
    const m = html.match(/images\.vivino\.com\/thumbs\/[A-Za-z0-9_\-]+_pb_x\d+\.png/);
    return m ? `https://${m[0].replace(/_pb_x\d+/, "_pb_x600")}` : null;
  } catch {
    return null;
  }
}
