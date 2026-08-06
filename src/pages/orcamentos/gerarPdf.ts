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

async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao baixar PDF: ${url}`);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function centralizarTexto(texto: string, fontSize: number, pageWidth: number): number {
  const charWidth = fontSize * 0.5;
  return (pageWidth - texto.length * charWidth) / 2;
}

export async function gerarOrcamentoPdf(
  orcamento: OrcamentoParaPdf,
  config: ConfiguracaoOrcamento
): Promise<void> {
  try {
    const finalPdf = await PDFDocument.create();
    const helvetica = await finalPdf.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await finalPdf.embedFont(StandardFonts.HelveticaBold);

    // ============================================================
    // PÁGINA 1 — CAPA
    // ============================================================
    if (config.capaPdfUrl) {
      const capaBytes = await fetchPdfBytes(config.capaPdfUrl);
      const capaDoc = await PDFDocument.load(capaBytes);
      const [capaPage] = await finalPdf.copyPages(capaDoc, [0]);
      const { width, height } = capaPage.getSize();
      alert(`Capa: ${width} x ${height}`);

     // Número do orçamento — posição baseada no Photoshop
const numText = orcamento.numero;
const escala = width / 2481;
const numX = 1920.72 * escala;
const numY = height - (177.46 * (height / 3509)) - 8;
const numSize = 22 * (height / 3509) * (300 / 72);
capaPage.drawText(numText, {
  x: numX,
  y: numY,
  size: numSize,
  font: helveticaBold,
  color: rgb(1, 1, 1),
});

      // Nome do cliente — acima da foto, centralizado, cinza
      const nomeCliente = orcamento.nomeCliente.toUpperCase();
      const nomeWidth = helvetica.widthOfTextAtSize(nomeCliente, 13);
      capaPage.drawText(nomeCliente, {
        x: (width - nomeWidth) / 2,
        y: height * 0.455,
        size: 13,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Nome do evento — abaixo do cliente, vermelho
      if (orcamento.nomeEvento) {
        const nomeEvento = orcamento.nomeEvento.toUpperCase();
        const eventoWidth = helveticaBold.widthOfTextAtSize(nomeEvento, 13);
        capaPage.drawText(nomeEvento, {
          x: (width - eventoWidth) / 2,
          y: height * 0.432,
          size: 13,
          font: helveticaBold,
          color: rgb(1, 0.33, 0.32),
        });
      }

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
    const startY = pageHeight - 75; // começa bem no topo da área útil
    const bottomLimit = 110; // espaço para o rodapé do timbrado
    let y = startY;

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
      y = pageHeight - 75;
    };

    const checkNovaPage = async (espacoNecessario: number) => {
      if (y - espacoNecessario < bottomLimit) {
        await adicionarPagina();
      }
    };

    await adicionarPagina();

    const vermelho = rgb(1, 0.33, 0.32);
    const preto = rgb(0.12, 0.12, 0.12);
    const cinza = rgb(0.45, 0.45, 0.45);
    const cinzaClaro = rgb(0.85, 0.85, 0.85);
    const lineHeight = 18;
    const sectionGap = 16;

    const drawLinha = (cor = cinzaClaro, espessura = 0.5) => {
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
        color: vermelho,
      });
      page.drawText(texto.toUpperCase(), {
        x: marginLeft + 10,
        y: y,
        size: 10,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
      y -= 30;
    };

    // ============================================================
    // CABEÇALHO DA PÁGINA DE CONTEÚDO
    // ============================================================
    page.drawText('PROPOSTA AUDIOVISUAL', {
      x: marginLeft,
      y,
      size: 16,
      font: helveticaBold,
      color: preto,
    });

    // Número no lado direito
    const numW = helveticaBold.widthOfTextAtSize(orcamento.numero, 12);
    page.drawText(orcamento.numero, {
      x: marginLeft + contentWidth - numW,
      y,
      size: 12,
      font: helveticaBold,
      color: vermelho,
    });
    y -= 18;

    if (orcamento.nomeCliente) {
      page.drawText(orcamento.nomeCliente.toUpperCase(), {
        x: marginLeft,
        y,
        size: 10,
        font: helvetica,
        color: cinza,
      });
      y -= 14;
    }

    if (orcamento.localEvento) {
      page.drawText(`Local: ${orcamento.localEvento}`, {
        x: marginLeft,
        y,
        size: 9,
        font: helvetica,
        color: cinza,
      });
      y -= 14;
    }

    y -= sectionGap;
    page.drawLine({
      start: { x: marginLeft, y },
      end: { x: marginLeft + contentWidth, y },
      thickness: 1,
      color: vermelho,
    });
    y -= sectionGap;

    // ============================================================
    // DADOS DO CLIENTE
    // ============================================================
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
          font: helveticaBold,
          color: cinza,
        });
        page.drawText(dado.valor, {
          x: marginLeft + 90,
          y,
          size: 9,
          font: helvetica,
          color: preto,
        });
        y -= lineHeight;
      }
      y -= sectionGap;
    }

    // ============================================================
    // BLOCOS DE SERVIÇO
    // ============================================================
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
          font: helvetica,
          color: preto,
        });
        y -= lineHeight;
        drawLinha();
      }

      // Valor do bloco
      if (bloco.valorManual > 0) {
        await checkNovaPage(30);
        y -= 4;
        const valorText = fmt(bloco.valorManual);
        const valorW = helveticaBold.widthOfTextAtSize(valorText, 13);
        page.drawText(valorText, {
          x: marginLeft + contentWidth - valorW,
          y,
          size: 13,
          font: helveticaBold,
          color: vermelho,
        });
        y -= 20;
      }

      y -= sectionGap;
    }

    // ============================================================
    // EXTRAS
    // ============================================================
    const extrasValidos = orcamento.extras.filter(e => e.nome && (e.valorDia * e.diarias) > 0);
    if (extrasValidos.length > 0) {
      await checkNovaPage(50 + extrasValidos.length * lineHeight);
      drawSecaoTitulo('Extras');

      for (const extra of extrasValidos) {
        await checkNovaPage(lineHeight + 8);
        const valorExtra = fmt(extra.valorDia * extra.diarias);
        const valorW = helveticaBold.widthOfTextAtSize(valorExtra, 9);
        page.drawText(extra.nome, {
          x: marginLeft + 8,
          y,
          size: 9,
          font: helvetica,
          color: preto,
        });
        page.drawText(valorExtra, {
          x: marginLeft + contentWidth - valorW,
          y,
          size: 9,
          font: helveticaBold,
          color: preto,
        });
        y -= lineHeight;
        drawLinha();
      }
      y -= sectionGap;
    }

    // ============================================================
    // DESPESAS DE DESLOCAMENTO
    // ============================================================
    await checkNovaPage(30);
    page.drawText('Despesas de deslocamento', {
      x: marginLeft + 8,
      y,
      size: 9,
      font: helvetica,
      color: cinza,
    });
    const inclW = helvetica.widthOfTextAtSize('incluso', 9);
    page.drawText('incluso', {
      x: marginLeft + contentWidth - inclW,
      y,
      size: 9,
      font: helvetica,
      color: cinza,
    });
    y -= lineHeight;
    drawLinha();
    y -= sectionGap;

    // ============================================================
    // PROPOSTA FINAL
    // ============================================================
    const totalBlocos = orcamento.blocos.filter(b => b.nome);
    await checkNovaPage(60 + (totalBlocos.length + extrasValidos.length) * lineHeight + 50);
    drawSecaoTitulo('Proposta Final');

    for (const bloco of totalBlocos) {
      await checkNovaPage(lineHeight + 8);
      const nomeBloco = bloco.nome.toUpperCase();
      const valorBloco = bloco.valorManual > 0 ? fmt(bloco.valorManual) : '';
      page.drawText(nomeBloco, {
        x: marginLeft + 8,
        y,
        size: 9,
        font: helveticaBold,
        color: preto,
      });
      if (valorBloco) {
        const vW = helveticaBold.widthOfTextAtSize(valorBloco, 9);
        page.drawText(valorBloco, {
          x: marginLeft + contentWidth - vW,
          y,
          size: 9,
          font: helveticaBold,
          color: preto,
        });
      }
      y -= lineHeight;
      drawLinha();
    }

    for (const extra of extrasValidos) {
      await checkNovaPage(lineHeight + 8);
      const valorExtra = fmt(extra.valorDia * extra.diarias);
      const vW = helvetica.widthOfTextAtSize(valorExtra, 9);
      page.drawText(extra.nome, {
        x: marginLeft + 8,
        y,
        size: 9,
        font: helvetica,
        color: cinza,
      });
      page.drawText(valorExtra, {
        x: marginLeft + contentWidth - vW,
        y,
        size: 9,
        font: helvetica,
        color: cinza,
      });
      y -= lineHeight;
      drawLinha();
    }

    // TOTAL
    await checkNovaPage(40);
    y -= 8;
    page.drawRectangle({
      x: marginLeft,
      y: y - 6,
      width: contentWidth,
      height: 26,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText('TOTAL', {
      x: marginLeft + 10,
      y: y,
      size: 11,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    const totalText = fmt(orcamento.valorCliente);
    const totalW = helveticaBold.widthOfTextAtSize(totalText, 13);
    page.drawText(totalText, {
      x: marginLeft + contentWidth - totalW,
      y,
      size: 13,
      font: helveticaBold,
      color: vermelho,
    });
    y -= 40;

    // ============================================================
    // PAGAMENTO
    // ============================================================
    await checkNovaPage(40);
    page.drawText('PAGAMENTO', {
      x: marginLeft,
      y,
      size: 10,
      font: helveticaBold,
      color: preto,
    });
    y -= 16;
    page.drawText(orcamento.condicaoPagamento, {
      x: marginLeft,
      y,
      size: 9,
      font: helvetica,
      color: cinza,
    });
    y -= lineHeight;

    // ============================================================
    // OBSERVAÇÕES
    // ============================================================
    if (orcamento.observacoes) {
      await checkNovaPage(40);
      y -= sectionGap;
      page.drawText('DADOS DE ENTREGA DO MATERIAL', {
        x: marginLeft,
        y,
        size: 9,
        font: helveticaBold,
        color: preto,
      });
      y -= 14;
      const palavras = orcamento.observacoes.split(' ');
      let linha = '';
      for (const palavra of palavras) {
        const teste = linha ? `${linha} ${palavra}` : palavra;
        if (helvetica.widthOfTextAtSize(teste, 8) > contentWidth) {
          await checkNovaPage(12);
          page.drawText(linha, { x: marginLeft, y, size: 8, font: helvetica, color: cinza });
          y -= 12;
          linha = palavra;
        } else {
          linha = teste;
        }
      }
      if (linha) {
        await checkNovaPage(12);
        page.drawText(linha, { x: marginLeft, y, size: 8, font: helvetica, color: cinza });
        y -= 12;
      }
    }

    // ============================================================
    // DOWNLOAD
    // ============================================================
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
