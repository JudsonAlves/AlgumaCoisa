// ============================================================
// SOLAR PRO 2.0 — pages/capas-proposta.js
// Biblioteca de capas (página 1 da Proposta Completa) selecionáveis
// pelo usuário em "Personalização da Proposta". Cada entrada de
// CAPAS_PROPOSTA é 100% HTML/CSS (sem dependência de imagem externa
// obrigatória — quando não há foto de fundo, cai no gradiente/cores
// da marca configuradas).
//
// v2: cada capa agora é composta por VÁRIAS camadas geométricas
// (retângulos, tarjas, arcos via border-radius, círculos, losangos
// rotacionados) em vez de um único corte — para dar profundidade e
// evitar o efeito "chapado" da v1.
//
// Contrato de cada capa:
//   { id, nome, render(d) -> string HTML (conteúdo de #page1 .sheet),
//     css -> string CSS escopado (classes prefixadas com o próprio id) }
//
// `d` (dados da capa) sempre tem o formato:
//   {
//     logoUrl, titulo, subtitulo, fraseCliente, clienteNome, vendedorNome,
//     corPrimaria, corSecundaria, fotoFundo (url ou null),
//     telefone, instagram, endereco, site
//   }
// ============================================================

function _capaRodape(d){
  return `<div class="cp-rodape">
    <span>${d.telefone || ''}</span>
    <span>${d.endereco || ''}</span>
    <span>${d.site || ''}</span>
  </div>`;
}

function _capaClienteBlock(d, corTexto){
  if(!d.clienteNome) return '';
  return `<div class="cp-cliente">${d.fraseCliente || 'Preparado para'}<b>${d.clienteNome}</b>
    ${d.vendedorNome ? `<div class="cp-vendedor">Vendedor: <b>${d.vendedorNome}</b></div>` : ''}
  </div>`;
}

// fundo de foto (ou gradiente de fallback com as cores da marca) — usado
// por várias capas; retorna um <div> posicionável via CSS externo
function _capaFundoFoto(d, claseExtra){
  const bg = d.fotoFundo
    ? `background-image:url('${d.fotoFundo}');background-size:cover;background-position:center;`
    : `background:linear-gradient(160deg, ${d.corSecundaria || '#5A3A22'} 0%, ${d.corPrimaria || '#1F140B'} 100%);`;
  return `<div class="${claseExtra}" style="${bg}"></div>`;
}

const CAPAS_PROPOSTA = [

  // ---------------------------------------------------------
  // 1) DIAGONAL CLÁSSICA — três diagonais empilhadas (tarja escura,
  //    tarja laranja, foto/gradiente) + losango de acento atrás do
  //    logo, pra parecer cortada de verdade e não só um retângulo
  // ---------------------------------------------------------
  {
    id: 'diagonal_classica',
    nome: 'Diagonal Clássica',
    css: `
.capa-diagonal_classica{width:100%;height:100%;position:relative;background:#fff;overflow:hidden;display:flex;flex-direction:column;}
.capa-diagonal_classica .cp-losango{position:absolute;top:-60px;left:-60px;width:220px;height:220px;background:var(--light-gray, #F3EFE9);transform:rotate(20deg);z-index:0;}
.capa-diagonal_classica .cp-logo{padding:50px 50px 0;position:relative;z-index:2;}
.capa-diagonal_classica .cp-logo img{height:auto;width:300px;}
.capa-diagonal_classica .cp-mid{flex:1;padding:30px 50px 0;position:relative;z-index:2;}
.capa-diagonal_classica .cp-mid h1{font-family:'Barlow Condensed',sans-serif;font-size:58px;font-weight:800;color:var(--dark);line-height:1;}
.capa-diagonal_classica .cp-mid .cp-sub{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--orange);margin-top:8px;padding-left:14px;border-left:4px solid var(--orange);}
.capa-diagonal_classica .cp-cliente{margin-top:30px;font-size:13px;color:#FFF;}
.capa-diagonal_classica .cp-cliente b{display:block;font-family:'Barlow Condensed',sans-serif;font-size:19px;color:var(--dark);margin-top:2px;}
.capa-diagonal_classica .cp-vendedor{margin-top:10px;font-size:12px;}
.capa-diagonal_classica .cp-tarja-escura{position:absolute;right:0;bottom:0;width:74%;height:58%;clip-path:polygon(46% 0, 100% 0, 100% 100%, 0 100%);background:var(--dark);z-index:1;}
.capa-diagonal_classica .cp-tarja-laranja{position:absolute;right:0;bottom:0;width:70%;height:56%;clip-path:polygon(43% 0, 100% 0, 100% 100%, 0 100%);background:var(--orange);z-index:1;}
.capa-diagonal_classica .cp-fundo{position:absolute;right:0;bottom:0;width:62%;height:52%;clip-path:polygon(38% 0, 100% 0, 100% 100%, 0 100%);z-index:1;box-shadow:-6px 0 24px rgba(0,0,0,.18);}
.capa-diagonal_classica .cp-rodape{position:relative;z-index:2;background:rgba(0,0,0,.04);padding:20px 50px;display:flex;justify-content:space-between;font-size:11.5px;color:#6B5C4C;}
`,
    render(d){
      return `<div class="capa-diagonal_classica">
        <div class="cp-losango"></div>
        <div class="cp-logo"><img src="${d.logoUrl}" alt=""></div>
        <div class="cp-mid">
          <h1>${d.titulo}</h1>
          <div class="cp-sub">${d.subtitulo}</div>
          ${_capaClienteBlock(d, '#6B5C4C')}
        </div>
        <div class="cp-tarja-escura"></div>
        <div class="cp-tarja-laranja"></div>
        ${_capaFundoFoto(d, 'cp-fundo')}
        ${_capaRodape(d)}
      </div>`;
    }
  },

  // ---------------------------------------------------------
  // 2) ARCO MODERNO — dois arcos empilhados (um mais claro atrás,
  //    um com foto/gradiente na frente) + anel fino de acento,
  //    criando profundidade real
  // ---------------------------------------------------------
  {
    id: 'arco_moderno',
    nome: 'Arco Moderno',
    css: `
.capa-arco_moderno{width:100%;height:100%;position:relative;background:#fff;overflow:hidden;display:flex;flex-direction:column;}
.capa-arco_moderno .cp-retangulo{position:absolute;top:220px;left:0;width:60%;height:70px;background:var(--light-gray, #F3EFE9);z-index:0;}
.capa-arco_moderno .cp-logo{padding:50px 50px 0;position:relative;z-index:3;}
.capa-arco_moderno .cp-logo img{height:auto;width:300px;}
.capa-arco_moderno .cp-mid{flex:1;padding:26px 50px 0;position:relative;z-index:3;}
.capa-arco_moderno .cp-mid h1{font-family:'Barlow Condensed',sans-serif;font-size:56px;font-weight:800;color:var(--dark);line-height:1;}
.capa-arco_moderno .cp-mid .cp-sub{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--orange);margin-top:8px;}
.capa-arco_moderno .cp-cliente{margin-top:26px;font-size:13px;color:#6B5C4C;}
.capa-arco_moderno .cp-cliente b{display:block;font-family:'Barlow Condensed',sans-serif;font-size:19px;color:var(--dark);margin-top:2px;}
.capa-arco_moderno .cp-vendedor{margin-top:10px;font-size:12px;}
.capa-arco_moderno .cp-arco-fundo{position:absolute;left:-6%;right:-6%;bottom:-40px;height:56%;border-radius:50% 50% 0 0/110px 110px 0 0;background:var(--light-gray, #F3EFE9);z-index:1;}
.capa-arco_moderno .cp-arco-foto{position:absolute;left:0;right:0;bottom:0;height:46%;border-radius:50% 50% 0 0/90px 90px 0 0;z-index:2;box-shadow:0 -10px 30px rgba(0,0,0,.15);}
.capa-arco_moderno .cp-anel-fina{position:absolute;left:50%;bottom:44%;transform:translateX(-50%);width:120px;height:120px;border-radius:50%;border:3px solid var(--orange);z-index:3;opacity:.85;}
.capa-arco_moderno .cp-rodape{position:relative;z-index:3;padding:20px 50px;display:flex;justify-content:space-between;font-size:11.5px;color:#fff;margin-top:auto;}
`,
    render(d){
      return `<div class="capa-arco_moderno">
        <div class="cp-retangulo"></div>
        <div class="cp-logo"><img src="${d.logoUrl}" alt=""></div>
        <div class="cp-mid">
          <h1>${d.titulo}</h1>
          <div class="cp-sub">${d.subtitulo}</div>
          ${_capaClienteBlock(d, '#6B5C4C')}
        </div>
        <div class="cp-arco-fundo"></div>
        ${_capaFundoFoto(d, 'cp-arco-foto')}
        <div class="cp-anel-fina"></div>
        ${_capaRodape(d)}
      </div>`;
    }
  },

  // ---------------------------------------------------------
  // 3) MINIMALISTA SOL — moldura fina com cantos em L, faixa
  //    retangular sob o título e sol geométrico ao fundo; visual
  //    "editorial" sem depender de foto
  // ---------------------------------------------------------
  {
    id: 'minimalista_sol',
    nome: 'Minimalista Sol',
    css: `
.capa-minimalista_sol{width:100%;height:100%;position:relative;background:#fff;overflow:hidden;display:flex;flex-direction:column;}
.capa-minimalista_sol .cp-moldura{position:absolute;inset:26px;border:1px solid rgba(0,0,0,.12);z-index:1;}
.capa-minimalista_sol .cp-canto{position:absolute;width:34px;height:34px;z-index:2;}
.capa-minimalista_sol .cp-canto.tl{top:26px;left:26px;border-top:4px solid var(--orange);border-left:4px solid var(--orange);}
.capa-minimalista_sol .cp-canto.br{bottom:26px;right:26px;border-bottom:4px solid var(--orange);border-right:4px solid var(--orange);}
.capa-minimalista_sol .cp-logo{padding:56px 60px 0;position:relative;z-index:3;}
.capa-minimalista_sol .cp-logo img{height:auto;width:280px;}
.capa-minimalista_sol .cp-mid{flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 60px;position:relative;z-index:3;}
.capa-minimalista_sol .cp-mid h1{font-family:'Barlow Condensed',sans-serif;font-size:56px;font-weight:800;color:var(--dark);line-height:1;text-align:center;}
.capa-minimalista_sol .cp-faixa{display:inline-block;margin:14px auto 0;background:var(--dark);color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:7px 22px;}
.capa-minimalista_sol .cp-line{width:70px;height:3px;background:var(--orange);margin:16px auto 0;}
.capa-minimalista_sol .cp-cliente{margin-top:26px;font-size:13px;color:#6B5C4C;text-align:center;}
.capa-minimalista_sol .cp-cliente b{display:block;font-family:'Barlow Condensed',sans-serif;font-size:19px;color:var(--dark);margin-top:2px;}
.capa-minimalista_sol .cp-vendedor{margin-top:10px;font-size:12px;}
.capa-minimalista_sol .cp-sol{position:absolute;left:50%;bottom:16%;transform:translateX(-50%);width:64%;aspect-ratio:2/1;overflow:hidden;opacity:.07;z-index:1;}
.capa-minimalista_sol .cp-sol svg{width:100%;height:auto;}
.capa-minimalista_sol .cp-barra{background:var(--orange);color:#fff;padding:18px 60px;display:flex;justify-content:space-between;font-size:11.5px;position:relative;z-index:3;}
`,
    render(d){
      const cor = d.corPrimaria || '#1F140B';
      return `<div class="capa-minimalista_sol">
        <div class="cp-moldura"></div>
        <div class="cp-canto tl"></div>
        <div class="cp-canto br"></div>
        <div class="cp-logo"><img src="${d.logoUrl}" alt=""></div>
        <div class="cp-mid">
          <h1>${d.titulo}</h1>
          <div class="cp-faixa">${d.subtitulo}</div>
          <div class="cp-line"></div>
          ${_capaClienteBlock(d, '#6B5C4C')}
        </div>
        <div class="cp-sol"><svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="70" fill="${cor}"/>
          ${Array.from({length:12}).map((_,i)=>{
            const ang = -180 + i*15;
            const rad = ang*Math.PI/180;
            const x1 = 100 + 78*Math.cos(rad), y1 = 100 + 78*Math.sin(rad);
            const x2 = 100 + 96*Math.cos(rad), y2 = 100 + 96*Math.sin(rad);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cor}" stroke-width="4"/>`;
          }).join('')}
        </svg></div>
        <div class="cp-barra"><span>${d.telefone || ''}</span><span>${d.endereco || ''}</span><span>${d.site || ''}</span></div>
      </div>`;
    }
  },

  // ---------------------------------------------------------
  // 4) ESCURA DIAGONAL — fundo escuro cheio com TRÊS faixas diagonais
  //    de tons diferentes (efeito "borda serrilhada") + chip retangular
  //    para o subtítulo
  // ---------------------------------------------------------
  {
    id: 'escura_diagonal',
    nome: 'Escura Diagonal',
    css: `
.capa-escura_diagonal{width:100%;height:100%;position:relative;overflow:hidden;display:flex;flex-direction:column;color:#fff;}
.capa-escura_diagonal .cp-bg{position:absolute;inset:0;z-index:0;}
.capa-escura_diagonal .cp-faixa1{position:absolute;right:-6%;top:0;width:58%;height:100%;clip-path:polygon(30% 0, 100% 0, 100% 100%, 0 100%);background:rgba(0,0,0,.28);z-index:1;}
.capa-escura_diagonal .cp-fundo{position:absolute;right:0;top:0;width:48%;height:100%;clip-path:polygon(24% 0, 100% 0, 100% 100%, 0 100%);z-index:1;opacity:.92;}
.capa-escura_diagonal .cp-linha1{position:absolute;right:calc(52% - 2px);top:0;width:2px;height:100%;background:rgba(255,255,255,.35);z-index:2;}
.capa-escura_diagonal .cp-linha2{position:absolute;right:calc(44% - 4px);top:0;width:4px;height:100%;background:var(--orange);z-index:2;}
.capa-escura_diagonal .cp-logo{padding:50px 50px 0;position:relative;z-index:3;}
.capa-escura_diagonal .cp-logo img{height:auto;width:280px;filter:brightness(0) invert(1);}
.capa-escura_diagonal .cp-mid{flex:1;padding:30px 50px 0;position:relative;z-index:3;}
.capa-escura_diagonal .cp-mid h1{font-family:'Barlow Condensed',sans-serif;font-size:58px;font-weight:800;line-height:1;}
.capa-escura_diagonal .cp-chip{display:inline-block;margin-top:10px;background:var(--orange);color:#1F140B;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:6px 16px;}
.capa-escura_diagonal .cp-cliente{margin-top:30px;font-size:13px;color:#E9DACB;}
.capa-escura_diagonal .cp-cliente b{display:block;font-family:'Barlow Condensed',sans-serif;font-size:19px;color:#fff;margin-top:2px;}
.capa-escura_diagonal .cp-vendedor{margin-top:10px;font-size:12px;}
.capa-escura_diagonal .cp-rodape{position:relative;z-index:3;background:rgba(0,0,0,.35);padding:20px 50px;display:flex;justify-content:space-between;font-size:11.5px;color:#E9DACB;}
`,
    render(d){
      return `<div class="capa-escura_diagonal">
        <div class="cp-bg" style="background:${d.corPrimaria || '#1F140B'}"></div>
        <div class="cp-faixa1"></div>
        <div class="cp-linha1"></div>
        <div class="cp-linha2"></div>
        ${_capaFundoFoto(d, 'cp-fundo')}
        <div class="cp-logo"><img src="${d.logoUrl}" alt=""></div>
        <div class="cp-mid">
          <h1>${d.titulo}</h1>
          <div class="cp-chip">${d.subtitulo}</div>
          ${_capaClienteBlock(d, '#E9DACB')}
        </div>
        ${_capaRodape(d)}
      </div>`;
    }
  },

  // ---------------------------------------------------------
  // 5) SELO CENTRAL — moldura dupla (retângulo fino + selo grosso)
  //    sobre um grande círculo sangrando no rodapé + tarja retangular
  //    atrás, sem depender de clip-path path() (pouco confiável)
  // ---------------------------------------------------------
  {
    id: 'selo_central',
    nome: 'Selo Central',
    css: `
.capa-selo_central{width:100%;height:100%;position:relative;background:#fff;overflow:hidden;display:flex;flex-direction:column;}
.capa-selo_central .cp-circulo-grande{position:absolute;left:50%;bottom:-260px;transform:translateX(-50%);width:640px;height:640px;border-radius:50%;background:var(--light-gray, #F3EFE9);z-index:0;}
.capa-selo_central .cp-tarja{position:absolute;left:0;right:0;bottom:150px;height:52px;background:var(--dark);z-index:0;}
.capa-selo_central .cp-logo{padding:50px 50px 0;position:relative;z-index:3;}
.capa-selo_central .cp-logo img{height:auto;width:300px;}
.capa-selo_central .cp-mid{flex:1;display:flex;align-items:center;justify-content:center;position:relative;z-index:3;}
.capa-selo_central .cp-selo-outer{border:1px solid rgba(0,0,0,.15);padding:8px;}
.capa-selo_central .cp-selo{border:3px solid var(--orange);padding:34px 46px;text-align:center;background:#fff;}
.capa-selo_central .cp-selo h1{font-family:'Barlow Condensed',sans-serif;font-size:40px;font-weight:800;color:var(--dark);}
.capa-selo_central .cp-selo .cp-sub{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--orange);margin-top:6px;}
.capa-selo_central .cp-selo .cp-ico{margin-top:14px;font-size:30px;}
.capa-selo_central .cp-cliente{margin-top:24px;font-size:13px;color:#6B5C4C;text-align:center;}
.capa-selo_central .cp-cliente b{display:block;font-family:'Barlow Condensed',sans-serif;font-size:19px;color:var(--dark);margin-top:2px;}
.capa-selo_central .cp-vendedor{margin-top:10px;font-size:12px;}
.capa-selo_central .cp-rodape{position:relative;z-index:3;padding:20px 50px;display:flex;justify-content:space-between;font-size:11.5px;color:#6B5C4C;}
`,
    render(d){
      return `<div class="capa-selo_central">
        <div class="cp-circulo-grande"></div>
        <div class="cp-tarja"></div>
        <div class="cp-logo"><img src="${d.logoUrl}" alt=""></div>
        <div class="cp-mid">
          <div class="cp-selo-outer">
            <div class="cp-selo">
              <h1>${d.titulo}</h1>
              <div class="cp-sub">${d.subtitulo}</div>
              <div class="cp-ico">☀️</div>
              ${_capaClienteBlock(d, '#6B5C4C')}
            </div>
          </div>
        </div>
        ${_capaRodape(d)}
      </div>`;
    }
  },

  // ---------------------------------------------------------
  // 6) PONTILHADO & ANEL — tarja superior + bloco pontilhado grande +
  //    losango de acento + anel duplo (grosso atrás, fino na frente),
  //    visual tech com bem mais camadas que a v1
  // ---------------------------------------------------------
  {
    id: 'pontilhado_anel',
    nome: 'Pontilhado & Anel',
    css: `
.capa-pontilhado_anel{width:100%;height:100%;position:relative;background:#fff;overflow:hidden;display:flex;flex-direction:column;}
.capa-pontilhado_anel .cp-topo{position:absolute;top:0;left:0;right:0;height:10px;background:var(--orange);z-index:2;}
.capa-pontilhado_anel .cp-logo{padding:60px 50px 0;position:relative;z-index:3;}
.capa-pontilhado_anel .cp-logo img{height:auto;width:300px;}
.capa-pontilhado_anel .cp-mid{flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 50px;position:relative;z-index:3;}
.capa-pontilhado_anel .cp-mid h1{font-family:'Barlow Condensed',sans-serif;font-size:56px;font-weight:800;color:var(--dark);line-height:1;}
.capa-pontilhado_anel .cp-mid .cp-sub{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--orange);margin-top:8px;}
.capa-pontilhado_anel .cp-cliente{margin-top:26px;font-size:13px;color:#6B5C4C;}
.capa-pontilhado_anel .cp-cliente b{display:block;font-family:'Barlow Condensed',sans-serif;font-size:19px;color:var(--dark);margin-top:2px;}
.capa-pontilhado_anel .cp-vendedor{margin-top:10px;font-size:12px;}
.capa-pontilhado_anel .cp-losango{position:absolute;right:60px;top:130px;width:46px;height:46px;background:var(--orange);transform:rotate(45deg);z-index:1;opacity:.9;}
.capa-pontilhado_anel .cp-pontos{position:absolute;right:0;top:0;width:48%;height:64%;background-image:radial-gradient(var(--orange) 1.6px, transparent 1.6px);background-size:14px 14px;opacity:.4;mask-image:linear-gradient(220deg, #000 10%, transparent 70%);z-index:1;}
.capa-pontilhado_anel .cp-anel-grosso{position:absolute;left:-110px;bottom:-110px;width:320px;height:320px;border-radius:50%;border:34px solid var(--light-gray, #F3EFE9);z-index:0;}
.capa-pontilhado_anel .cp-anel{position:absolute;left:-70px;bottom:-70px;width:220px;height:220px;border-radius:50%;border:20px solid var(--orange);opacity:.92;z-index:1;}
.capa-pontilhado_anel .cp-canto{position:absolute;right:0;bottom:0;width:40%;height:36%;background:var(--dark);clip-path:polygon(100% 0, 100% 100%, 0 100%);z-index:1;}
.capa-pontilhado_anel .cp-canto-linha{position:absolute;right:0;bottom:calc(36% - 2px);width:40%;height:4px;background:var(--orange);z-index:2;transform-origin:right;transform:rotate(-24deg) translateY(-1px);}
.capa-pontilhado_anel .cp-rodape{position:relative;z-index:3;padding:20px 50px;display:flex;justify-content:space-between;font-size:11.5px;color:#6B5C4C;}
`,
    render(d){
      return `<div class="capa-pontilhado_anel">
        <div class="cp-topo"></div>
        <div class="cp-pontos"></div>
        <div class="cp-losango"></div>
        <div class="cp-canto" style="background:${d.corPrimaria || '#1F140B'}"></div>
        <div class="cp-canto-linha"></div>
        <div class="cp-anel-grosso"></div>
        <div class="cp-anel"></div>
        <div class="cp-logo"><img src="${d.logoUrl}" alt=""></div>
        <div class="cp-mid">
          <h1>${d.titulo}</h1>
          <div class="cp-sub">${d.subtitulo}</div>
          ${_capaClienteBlock(d, '#6B5C4C')}
        </div>
        ${_capaRodape(d)}
      </div>`;
    }
  },

  // ---------------------------------------------------------
  // 7) APENAS FOTO — sem nenhum retângulo/forma decorativa: só a
  //    foto de fundo (ou gradiente, se não houver foto) em tela cheia.
  //    Logo e textos (título/cliente/rodapé) são OPCIONAIS — com os
  //    dois ocultos, a capa fica sendo literalmente só a imagem.
  // ---------------------------------------------------------
  {
    id: 'apenas_foto',
    nome: 'Apenas Foto',
    css: `
.capa-apenas_foto{width:100%;height:100%;position:relative;overflow:hidden;background:#111;}
.capa-apenas_foto .cp-fundo{position:absolute;inset:0;z-index:0;}
.capa-apenas_foto .cp-scrim{position:absolute;left:0;right:0;bottom:0;height:4%;background: var(--dark);z-index:1;}
.capa-apenas_foto .cp-logo{position:absolute;top:400px;left:390px;z-index:2;}
.capa-apenas_foto .cp-logo img{height:auto;width:220px;}
.capa-apenas_foto .cp-mid{position:absolute;bottom:64px;padding:0 50px;z-index:2;color:#fff; top: 845px;left: 250px;}
.capa-apenas_foto .cp-mid h1{font-family:'Barlow Condensed',sans-serif;font-size:50px;font-weight:800;line-height:1;}
.capa-apenas_foto .cp-mid .cp-sub{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--orange);margin-top:14px;}
.capa-apenas_foto .cp-cliente{margin-top:18px;font-size:13px;color:#E9DACB;}
.capa-apenas_foto .cp-cliente b{display:block;font-family:'Barlow Condensed',sans-serif;font-size:18px;color:#fff;margin-top:2px;}
.capa-apenas_foto .cp-vendedor{margin-top:8px;font-size:12px;}
.capa-apenas_foto .cp-rodape{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:16px 50px;display:flex;justify-content:space-between;font-size:14px;color:#E9DACB;}
`,
    render(d){
      const semTextos = !!d.ocultarTextos;
      const semLogo = !!d.ocultarLogo;
      return `<div class="capa-apenas_foto">
        ${_capaFundoFoto(d, 'cp-fundo')}
        ${!semTextos ? '<div class="cp-scrim"></div>' : ''}
        ${!semLogo ? `<div class="cp-logo"><img src="${d.logoUrl}" alt=""></div>` : ''}
        ${!semTextos ? `
        <div class="cp-mid">
          <h1>${d.titulo}</h1>
          <div class="cp-sub">${d.subtitulo}</div>
          ${_capaClienteBlock(d, '#E9DACB')}
        </div>
        ${_capaRodape(d)}` : ''}
      </div>`;
    }
  },

];

window.CAPAS_PROPOSTA = CAPAS_PROPOSTA;

function getCapaById(id){
  return CAPAS_PROPOSTA.find(c => c.id === id) || CAPAS_PROPOSTA[0];
}
window.getCapaById = getCapaById;

// Monta o objeto `d` que os render() de cada capa esperam, a partir
// da config mesclada (proposta-config) + dados pontuais do orçamento atual
// (cliente/vendedor), sempre com os NOMES CORRETOS das chaves salvas
// (snake_case), evitando o mismatch que existia antes com camelCase.
function montarDadosCapa(cfg, extra){
  extra = extra || {};
  return {
    logoUrl: cfg.logo_url || (window.LOGO_PADRAO_URL || ''),
    titulo: cfg.capa_titulo || 'ORÇAMENTO',
    subtitulo: cfg.capa_subtitulo || 'Projeto Solar Fotovoltaico',
    fraseCliente: cfg.capa_frase_cliente || 'Preparado para',
    clienteNome: extra.clienteNome || null,
    vendedorNome: extra.vendedorNome || null,
    corPrimaria: cfg.capa_cor_primaria || '#1F140B',
    corSecundaria: cfg.capa_cor_secundaria || '#5A3A22',
    fotoFundo: (cfg.capa_tema === 'foto' && cfg.capa_foto_fundo) ? cfg.capa_foto_fundo : null,
    telefone: cfg.rodape_telefone || '',
    instagram: cfg.rodape_instagram || '',
    endereco: cfg.rodape_endereco || '',
    site: cfg.rodape_site || '',
    // usados só pela capa "Apenas Foto" — nas demais são ignorados
    ocultarLogo: !!cfg.capa_ocultar_logo,
    ocultarTextos: !!cfg.capa_ocultar_textos,
  };
}
window.montarDadosCapa = montarDadosCapa;
