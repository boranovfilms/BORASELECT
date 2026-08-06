import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface ItemBloco {
  nome: string;
  quantidade: number;
  exibirNoPdf: boolean;
}

interface BlocoServico {
  id: string;
  nome: string;
  itens: ItemBloco[];
  valorManual: number;
}

interface Extra {
  id: string;
  nome: string;
  valorDia: number;
  diarias: number;
  valor: number;
}

interface OrcamentoParaPdf {
  numero: string;
  nomeCliente: string;
  nomeEvento: string;
  cnpjCpf: string;
  emailPrincipal: string;
  telefone: string;
  responsavel: string;
  localEvento: string;
  diarias: number;
  condicaoPagamento: string;
  blocos: BlocoServico[];
  extras: Extra[];
  valorCliente: number;
  observacoes: string;
}

interface ConfiguracaoOrcamento {
  capaPdfUrl: string;
  timbradoPdfUrl: string;
  nomeEmpresa: string;
  telefone: string;
  email: string;
  site: string;
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao baixar PDF: ${url}`);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function gerarOrcamentoPdf(
  orcamento: OrcamentoParaPdf,
  config: ConfiguracaoOrcamento
): Promise<void> {
  try {
    const finalPdf = await PDFDocument.create();
    const fontBold = await finalPdf.embedFont(StandardFonts.HelveticaBold);       // trocar por TT Chocolates Bold
    const fontMedium = await finalPdf.embedFont(StandardFonts.Helvetica);         // trocar por TT Chocolates Medium
    const fontRegular = await finalPdf.embedFont(StandardFonts.Helvetica);        // trocar por TT Chocolates Regular

    const corVermelha = hexToRgb('#dd4d4c');                                       // cor padrão vermelha Bornov
    const corPreta = hexToRgb('#535353');                                           // cor texto escuro
    const corCinza = hexToRgb('#888888');                                           // cor texto secundário
    const corBranca = rgb(1, 1, 1);                                                // cor branca

    // ============================================================
    // PÁGINA 1 — CAPA
    // ============================================================
    if (config.capaPdfUrl) {
      const capaBytes = await fetchPdfBytes(config.capaPdfUrl);
      const capaDoc = await PDFDocument.load(capaBytes);
      const [capaPage] = await finalPdf.copyPages(capaDoc, [0]);
      const { width, height } = capaPage.getSize();

      // ── NÚMERO DO ORÇAMENTO ──────────────────────────────────
      const numText = orcamento.numero;
      const escala = width / 2481;                                                 // fator escala horizontal
      const numX = 1920.72 * escala;                                              // X do Photoshop convertido
      const numY = height - (177.46 * (height / 3509)) - 10;                     // Y invertido + ajuste fino
      const numSize = 22 * (height / 3509) * (300 / 72);                         // fonte 22pt Photoshop → PDF
      capaPage.drawText(numText, {
        x: numX,
        y: numY,
        size: numSize,
        font: fontBold,
        color: corBranca,
      });

      // ── NOME DO CLIENTE ──────────────────────────────────────
      // Usa primeiro nome ou nome comercial (máx 2 palavras)
      const nomeCompleto = orcamento.nomeCliente.toUpperCase();
      const palavras = nomeCompleto.split(' ');
      const nomeExibir = palavras.slice(0, 2).join(' ');                          // máx 2 palavras
      const clienteSize = 22 * (height / 3509) * (300 / 72);                     // fonte 22pt Photoshop → PDF
      const clienteTextWidth = fontMedium.widthOfTextAtSize(nomeExibir, clienteSize);
      const caixaClienteW = 453.93 * escala;                                      // largura da caixa no Photoshop
      const clienteX = (1012.44 * escala) + (caixaClienteW / 2) - (clienteTextWidth / 2); // centralizado na caixa
      const clienteY = height - (1444.46 * (height / 3509)) - 5;                 // Y invertido
      capaPage.drawText(nomeExibir, {
        x: clienteX,
        y: clienteY,
        size: clienteSize,
        font: fontMedium,
        color: corPreta,
      });

      // ── DATA DO ORÇAMENTO ────────────────────────────────────
      const hoje = new Date();
      const dataText = hoje.toLocaleDateString('pt-BR', {                          // formato dd/mm/aa
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
      const dataSize = 15 * (height / 3509) * (300 / 72);                        // fonte 15pt Photoshop → PDF
      const dataX = 1873.53 * escala;                                             // X do Photoshop convertido
      const dataY = height - (3282.81 * (height / 3509)) - 5;                    // Y invertido
      capaPage.drawText(dataText, {
        x: dataX,
        y: dataY,
        size: dataSize,
        font: fontBold,
        color: corVermelha,
      });

      finalPdf.addPage(capaPage);
    }

    // ============================================================
    // PÁGINAS DE CONTEÚDO — sobre o timbrado
    // ============================================================
    const timbradoBytes = config.timbradoPdfUrl
      ? await fetchPdfBytes(config.timbradoPdfUrl)
      : null;

    let page: any;
    let pageWidth = 595;
    let pageHeight = 842;
    const marginLeft = 75;
    const marginRight = 75;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const bottomLimit = 110;
    let y = 0;

    const adicionarPagina = async () => {
      if (timbradoBytes) {
        const timbradoDoc = await PDFDocument.load(timbradoBytes);
        const [timbradoPage] = await finalPdf.copyPages(timbradoDoc, [0]);
        finalPdf.addPage(timbradoPage);
        page = finalPdf.getPages()[finalPdf.getPageCount() - 1];
        pageWidth = page.getSize().width;
        pageHeight = page.getSize().height;
      } else {
        page = finalPdf.addPage([595, 842]);
        pageWidth = 595;
        pageHeight = 842;
      }
      y = pageHeight - 75;                                                         // começa 75pt abaixo do topo
    };

    const checkNovaPage = async (espacoNecessario: number) => {
      if (y - espacoNecessario < bottomLimit) {
        await adicionarPagina();
      }
    };

    await adicionarPagina();

    const lineHeight = 18;
    const sectionGap = 16;

    const drawLinha = (cor = hexToRgb('#dddddd'), espessura = 0.5) => {
      page.drawLine({
        start: { x: marginLeft, y },
        end: { x: marginLeft + contentWidth, y },
        thickness: espessura,
        color: cor,
      });
      y -= 8;
    };

    const drawSecaoTitulo = (texto: string) => {
      page.drawRectangle({
        x: marginLeft,
        y: y - 6,
        width: contentWidth,
        height: 22,
        color: corVermelha,                                                        // #dd4d4c
      });
      page.drawText(texto.toUpperCase(), {
        x: marginLeft + 10,
        y: y,
        size: 10,
        font: fontBold,
        color: corBranca,
      });
      y -= 30;
    };

    // ── CABEÇALHO DA PÁGINA DE CONTEÚDO ─────────────────────────
    page.drawText('PROPOSTA AUDIOVISUAL', {
      x: marginLeft,
      y,
      size: 16,
      font: fontBold,
      color: corPreta,
    });
    const numW = fontBold.widthOfTextAtSize(orcamento.numero, 12);
    page.drawText(orcamento.numero, {
      x: marginLeft + contentWidth - numW,
      y,
      size: 12,
      font: fontBold,
      color: corVermelha,
    });
    y -= 18;

    if (orcamento.nomeCliente) {
      page.drawText(orcamento.nomeCliente.toUpperCase(), {
        x: marginLeft,
        y,
        size: 10,
        font: fontMedium,
        color: corCinza,
      });
      y -= 14;
    }

    if (orcamento.localEvento) {
      page.drawText(`Local: ${orcamento.localEvento}`, {
        x: marginLeft,
        y,
        size: 9,
        font: fontRegular,
        color: corCinza,
      });
      y -= 14;
    }

    y -= sectionGap;
    page.drawLine({
      start: { x: marginLeft, y },
      end: { x: marginLeft + contentWidth, y },
      thickness: 1,
      color: corVermelha,
    });
    y -= sectionGap;

    // ── DADOS DO CLIENTE ─────────────────────────────────────────
    const dadosCliente = [
      { label: 'Cliente', valor: orcamento.nomeCliente },
      { label: 'CNPJ/CPF', valor: orcamento.cnpjCpf },
      { label: 'E-mail', valor: orcamento.emailPrincipal },
      { label: 'Telefone', valor: orcamento.telefone },
      { label: 'Responsável', valor: orcamento.responsavel },
    ].filter(d => d.valor);

    if (dadosCliente.length > 0) {
      await checkNovaPage(40 + dadosCliente.length * lineHeight);
      drawSecaoTitulo('Dados do Cliente');
      for (const dado of dadosCliente) {
        await checkNovaPage(lineHeight + 4);
        page.drawText(`${dado.label}:`, {
          x: marginLeft + 8,
          y,
          size: 9,
          font: fontBold,
          color: corCinza,
        });
        page.drawText(dado.valor, {
          x: marginLeft + 90,
          y,
          size: 9,
          font: fontRegular,
          color: corPreta,
        });
        y -= lineHeight;
      }
      y -= sectionGap;
    }

    // ── BLOCOS DE SERVIÇO ────────────────────────────────────────
    for (const bloco of orcamento.blocos) {
      if (!bloco.nome) continue;
      const itensPdf = bloco.itens.filter(i => i.exibirNoPdf !== false);
      await checkNovaPage(50 + itensPdf.length * (lineHeight + 8));
      drawSecaoTitulo(bloco.nome);

      for (const item of itensPdf) {
        await checkNovaPage(lineHeight + 8);
        const nomeItem = `${String(item.quantidade).padStart(2, '0')} — ${item.nome}`;
        page.drawText(nomeItem, {
          x: marginLeft + 8,
          y,
          size: 9,
          font: fontRegular,
          color: corPreta,
        });
        y -= lineHeight;
        drawLinha();
      }

      if (bloco.valorManual > 0) {
        await checkNovaPage(30);
        y -= 4;
        const valorText = fmt(bloco.valorManual);
        const valorW = fontBold.widthOfTextAtSize(valorText, 13);
        page.drawText(valorText, {
          x: marginLeft + contentWidth - valorW,
          y,
          size: 13,
          font: fontBold,
          color: corVermelha,
        });
        y -= 20;
      }
      y -= sectionGap;
    }

    // ── EXTRAS ───────────────────────────────────────────────────
    const extrasValidos = orcamento.extras.filter(e => e.nome && (e.valorDia * e.diarias) > 0);
    if (extrasValidos.length > 0) {
      await checkNovaPage(50 + extrasValidos.length * lineHeight);
      drawSecaoTitulo('Extras');
      for (const extra of extrasValidos) {
        await checkNovaPage(lineHeight + 8);
        const valorExtra = fmt(extra.valorDia * extra.diarias);
        const vW = fontBold.widthOfTextAtSize(valorExtra, 9);
        page.drawText(extra.nome, {
          x: marginLeft + 8,
          y,
          size: 9,
          font: fontRegular,
          color: corPreta,
        });
        page.drawText(valorExtra, {
          x: marginLeft + contentWidth - vW,
          y,
          size: 9,
          font: fontBold,
          color: corPreta,
        });
        y -= lineHeight;
        drawLinha();
      }
      y -= sectionGap;
    }

    // ── DESPESAS DE DESLOCAMENTO ─────────────────────────────────
    await checkNovaPage(30);
    page.drawText('Despesas de deslocamento', {
      x: marginLeft + 8,
      y,
      size: 9,
      font: fontRegular,
      color: corCinza,
    });
    const inclW = fontRegular.widthOfTextAtSize('incluso', 9);
    page.drawText('incluso', {
      x: marginLeft + contentWidth - inclW,
      y,
      size: 9,
      font: fontRegular,
      color: corCinza,
    });
    y -= lineHeight;
    drawLinha();
    y -= sectionGap;

    // ── PROPOSTA FINAL ───────────────────────────────────────────
    const totalBlocos = orcamento.blocos.filter(b => b.nome);
    await checkNovaPage(60 + (totalBlocos.length + extrasValidos.length) * lineHeight + 50);
    drawSecaoTitulo('Proposta Final');

    for (const bloco of totalBlocos) {
      await checkNovaPage(lineHeight + 8);
      const valorBloco = bloco.valorManual > 0 ? fmt(bloco.valorManual) : '';
      page.drawText(bloco.nome.toUpperCase(), {
        x: marginLeft + 8,
        y,
        size: 9,
        font: fontBold,
        color: corPreta,
      });
      if (valorBloco) {
        const vW = fontBold.widthOfTextAtSize(valorBloco, 9);
        page.drawText(valorBloco, {
          x: marginLeft + contentWidth - vW,
          y,
          size: 9,
          font: fontBold,
          color: corPreta,
        });
      }
      y -= lineHeight;
      drawLinha();
    }

    for (const extra of extrasValidos) {
      await checkNovaPage(lineHeight + 8);
      const valorExtra = fmt(extra.valorDia * extra.diarias);
      const vW = fontRegular.widthOfTextAtSize(valorExtra, 9);
      page.drawText(extra.nome, {
        x: marginLeft + 8,
        y,
        size: 9,
        font: fontRegular,
        color: corCinza,
      });
      page.drawText(valorExtra, {
        x: marginLeft + contentWidth - vW,
        y,
        size: 9,
        font: fontRegular,
        color: corCinza,
      });
      y -= lineHeight;
      drawLinha();
    }

    // ── TOTAL ────────────────────────────────────────────────────
    await checkNovaPage(40);
    y -= 8;
    page.drawRectangle({
      x: marginLeft,
      y: y - 6,
      width: contentWidth,
      height: 26,
      color: hexToRgb('#222222'),
    });
    page.drawText('TOTAL', {
      x: marginLeft + 10,
      y: y,
      size: 11,
      font: fontBold,
      color: corBranca,
    });
    const totalText = fmt(orcamento.valorCliente);
    const totalW = fontBold.widthOfTextAtSize(totalText, 13);
    page.drawText(totalText, {
      x: marginLeft + contentWidth - totalW,
      y: y,
      size: 13,
      font: fontBold,
      color: corVermelha,
    });
    y -= 40;

    // ── PAGAMENTO ────────────────────────────────────────────────
    await checkNovaPage(40);
    page.drawText('PAGAMENTO', {
      x: marginLeft,
      y,
      size: 10,
      font: fontBold,
      color: corPreta,
    });
    y -= 16;
    page.drawText(orcamento.condicaoPagamento, {
      x: marginLeft,
      y,
      size: 9,
      font: fontRegular,
      color: corCinza,
    });
    y -= lineHeight;

    // ── OBSERVAÇÕES ──────────────────────────────────────────────
    if (orcamento.observacoes) {
      await checkNovaPage(40);
      y -= sectionGap;
      page.drawText('DADOS DE ENTREGA DO MATERIAL', {
        x: marginLeft,
        y,
        size: 9,
        font: fontBold,
        color: corPreta,
      });
      y -= 14;
      const palavrasObs = orcamento.observacoes.split(' ');
      let linha = '';
      for (const palavra of palavrasObs) {
        const teste = linha ? `${linha} ${palavra}` : palavra;
        if (fontRegular.widthOfTextAtSize(teste, 8) > contentWidth) {
          await checkNovaPage(12);
          page.drawText(linha, { x: marginLeft, y, size: 8, font: fontRegular, color: corCinza });
          y -= 12;
          linha = palavra;
        } else {
          linha = teste;
        }
      }
      if (linha) {
        await checkNovaPage(12);
        page.drawText(linha, { x: marginLeft, y, size: 8, font: fontRegular, color: corCinza });
        y -= 12;
      }
    }

    // ── DOWNLOAD ─────────────────────────────────────────────────
    const pdfBytes = await finalPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Orcamento_${orcamento.numero}_${orcamento.nomeCliente.replace(/\s+/g, '_')}.pdf`;
    link.click();
    URL.revokeObjectURL(url);

  } catch (error: any) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error(error.message || 'Erro ao gerar PDF');
  }
}
