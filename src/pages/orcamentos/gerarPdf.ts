import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface ItemBloco {
  nome: string;
  quantidade: number;
  exibirNoPdf: boolean;
}

interface BlocoServico {
  nome: string;
  itens: ItemBloco[];
  valorManual: number;
}

interface Extra {
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

      // Escreve número do orçamento na capa
      const { width, height } = capaPage.getSize();
      capaPage.drawText(orcamento.numero, {
        x: width - 120,
        y: height - 45,
        size: 14,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      // Escreve nome do cliente/evento
      const tituloEvento = orcamento.nomeEvento || orcamento.nomeCliente;
      capaPage.drawText(tituloEvento.toUpperCase(), {
        x: width / 2 - (tituloEvento.length * 5),
        y: height * 0.42,
        size: 16,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
      });

      finalPdf.addPage(capaPage);
    }

    // ============================================================
    // PÁGINAS DE CONTEÚDO — sobre o timbrado
    // ============================================================
    const timbradoBytes = config.timbradoPdfUrl
      ? await fetchPdfBytes(config.timbradoPdfUrl)
      : null;

    const adicionarPaginaComTimbrado = async (): Promise<{
      page: any;
      width: number;
      height: number;
      marginLeft: number;
      marginRight: number;
      marginTop: number;
      contentWidth: number;
    }> => {
      if (timbradoBytes) {
        const timbradoDoc = await PDFDocument.load(timbradoBytes);
        const [timbradoPage] = await finalPdf.copyPages(timbradoDoc, [0]);
        finalPdf.addPage(timbradoPage);
        const page = finalPdf.getPages()[finalPdf.getPageCount() - 1];
        const { width, height } = page.getSize();
        const marginLeft = 70;
        const marginRight = 70;
        const marginTop = 60;
        const contentWidth = width - marginLeft - marginRight;
        return { page, width, height, marginLeft, marginRight, marginTop, contentWidth };
      } else {
        const page = finalPdf.addPage([595, 842]);
        const { width, height } = page.getSize();
        return { page, width, height, marginLeft: 60, marginRight: 60, marginTop: 60, contentWidth: width - 120 };
      }
    };

    // ============================================================
    // PÁGINA 2 — DADOS DO CLIENTE + BLOCOS
    // ============================================================
    let { page, width, height, marginLeft, contentWidth } = await adicionarPaginaComTimbrado();
    let y = height - 80;
    const lineHeight = 18;
    const sectionGap = 24;
    const vermelho = rgb(1, 0.33, 0.32);
    const preto = rgb(0.1, 0.1, 0.1);
    const cinza = rgb(0.5, 0.5, 0.5);
    const cinzaClaro = rgb(0.9, 0.9, 0.9);

    const checkNovaPage = async (espacoNecessario: number) => {
      if (y - espacoNecessario < 100) {
        const nova = await adicionarPaginaComTimbrado();
        page = nova.page;
        y = nova.height - 80;
      }
    };

    const drawLinha = (cor = cinzaClaro) => {
      page.drawLine({
        start: { x: marginLeft, y },
        end: { x: marginLeft + contentWidth, y },
        thickness: 0.5,
        color: cor,
      });
      y -= 8;
    };

    const drawTitulo = (texto: string) => {
      page.drawRectangle({
        x: marginLeft,
        y: y - 4,
        width: contentWidth,
        height: 20,
        color: vermelho,
      });
      page.drawText(texto.toUpperCase(), {
        x: marginLeft + 8,
        y: y,
        size: 10,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
      y -= 28;
    };

    // Número do orçamento
    page.drawText(orcamento.numero, {
      x: marginLeft + contentWidth - 80,
      y,
      size: 12,
      font: helveticaBold,
      color: vermelho,
    });

    // Título da proposta
    page.drawText('PROPOSTA AUDIOVISUAL', {
      x: marginLeft,
      y,
      size: 14,
      font: helveticaBold,
      color: preto,
    });
    y -= 20;

    if (orcamento.nomeEvento) {
      page.drawText(orcamento.nomeEvento, {
        x: marginLeft,
        y,
        size: 10,
        font: helvetica,
        color: cinza,
      });
      y -= 16;
    }

    if (orcamento.localEvento) {
      page.drawText(`Local: ${orcamento.localEvento}`, {
        x: marginLeft,
        y,
        size: 10,
        font: helvetica,
        color: cinza,
      });
      y -= 16;
    }

    y -= sectionGap;
    drawLinha(vermelho);

    // Dados do cliente
    drawTitulo('Dados do Cliente');

    const dadosCliente = [
      { label: 'Cliente', valor: orcamento.nomeCliente },
      { label: 'CNPJ/CPF', valor: orcamento.cnpjCpf },
      { label: 'E-mail', valor: orcamento.emailPrincipal },
      { label: 'Telefone', valor: orcamento.telefone },
      { label: 'Responsável', valor: orcamento.responsavel },
    ].filter(d => d.valor);

    for (const dado of dadosCliente) {
      await checkNovaPage(lineHeight + 4);
      page.drawText(`${dado.label}:`, {
        x: marginLeft,
        y,
        size: 9,
        font: helveticaBold,
        color: cinza,
      });
      page.drawText(dado.valor, {
        x: marginLeft + 80,
        y,
        size: 9,
        font: helvetica,
        color: preto,
      });
      y -= lineHeight;
    }

    y -= sectionGap;

    // Blocos de serviço
    for (const bloco of orcamento.blocos) {
      if (!bloco.nome) continue;
      await checkNovaPage(60);
      drawTitulo(bloco.nome);

      const itensPdf = bloco.itens.filter(i => i.exibirNoPdf !== false);
      for (const item of itensPdf) {
        await checkNovaPage(lineHeight + 4);
        const nomeItem = `${String(item.quantidade).padStart(2, '0')} — ${item.nome}`;
        page.drawText(nomeItem, {
          x: marginLeft + 8,
          y,
          size: 9,
          font: helvetica,
          color: preto,
        });
        drawLinha();
      }

      // Valor do bloco
      await checkNovaPage(30);
      const totalBloco = bloco.valorManual > 0
        ? bloco.valorManual
        : 0;

      if (totalBloco > 0) {
        page.drawText(fmt(totalBloco), {
          x: marginLeft + contentWidth - 80,
          y,
          size: 11,
          font: helveticaBold,
          color: vermelho,
        });
        y -= 20;
      }

      y -= sectionGap;
    }

    // Extras
    const extrasComValor = orcamento.extras.filter(e => e.nome && (e.valorDia * e.diarias) > 0);
    if (extrasComValor.length > 0) {
      await checkNovaPage(40);
      drawTitulo('Extras');
      for (const extra of extrasComValor) {
        await checkNovaPage(lineHeight + 8);
        page.drawText(extra.nome, {
          x: marginLeft + 8,
          y,
          size: 9,
          font: helvetica,
          color: preto,
        });
        page.drawText(fmt(extra.valorDia * extra.diarias), {
          x: marginLeft + contentWidth - 80,
          y,
          size: 9,
          font: helveticaBold,
          color: preto,
        });
        drawLinha();
      }
      y -= sectionGap;
    }

    // Despesas de deslocamento
    await checkNovaPage(40);
    page.drawText('Despesas de deslocamento', {
      x: marginLeft,
      y,
      size: 9,
      font: helvetica,
      color: cinza,
    });
    page.drawText('incluso', {
      x: marginLeft + contentWidth - 50,
      y,
      size: 9,
      font: helvetica,
      color: cinza,
    });
    y -= lineHeight;
    drawLinha();
    y -= sectionGap;

    // Proposta final
    await checkNovaPage(80);
    drawTitulo('Proposta Final');

    for (const bloco of orcamento.blocos) {
      if (!bloco.nome) continue;
      await checkNovaPage(lineHeight + 4);
      page.drawText(bloco.nome.toUpperCase(), {
        x: marginLeft + 8,
        y,
        size: 9,
        font: helveticaBold,
        color: preto,
      });
      if (bloco.valorManual > 0) {
        page.drawText(fmt(bloco.valorManual), {
          x: marginLeft + contentWidth - 80,
          y,
          size: 9,
          font: helveticaBold,
          color: preto,
        });
      }
      drawLinha();
    }

    for (const extra of extrasComValor) {
      await checkNovaPage(lineHeight + 4);
      page.drawText(extra.nome, {
        x: marginLeft + 8,
        y,
        size: 9,
        font: helvetica,
        color: preto,
      });
      page.drawText(fmt(extra.valorDia * extra.diarias), {
        x: marginLeft + contentWidth - 80,
        y,
        size: 9,
        font: helvetica,
        color: preto,
      });
      drawLinha();
    }

    // Total
    await checkNovaPage(50);
    y -= 8;
    page.drawRectangle({
      x: marginLeft,
      y: y - 4,
      width: contentWidth,
      height: 24,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText('TOTAL', {
      x: marginLeft + 8,
      y: y + 2,
      size: 11,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    page.drawText(fmt(orcamento.valorCliente), {
      x: marginLeft + contentWidth - 90,
      y: y + 2,
      size: 11,
      font: helveticaBold,
      color: vermelho,
    });
    y -= 36;

    // Pagamento
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

    // Observações
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
      const linhasObs = orcamento.observacoes.match(/.{1,80}/g) || [];
      for (const linha of linhasObs) {
        await checkNovaPage(14);
        page.drawText(linha, {
          x: marginLeft,
          y,
          size: 8,
          font: helvetica,
          color: cinza,
        });
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
