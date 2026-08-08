import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fontBoldUrl from '../../assets/fonts/ChocolatesBold.otf?url';
import fontMediumUrl from '../../assets/fonts/ChocolatesMedium.otf?url';
import fontRegularUrl from '../../assets/fonts/ChocolatesRegular.otf?url';

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
  valorDia?: number;
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
  dataEventoInicio: string;
  dataEventoFim: string;
  diarias: number;
  condicaoPagamento: string;
  blocos: BlocoServico[];
  extras: Extra[];
  despAlimentacao: number;
  despTransporte: number;
  despHospedagem: number;
  despPedagio: number;
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
  // Coordenadas do editor visual da capa (proporção 0–1, origem no topo-esquerdo).
  // Opcional: se ausente, a capa usa as posições fixas validadas.
  capaCoords?: {
    numero?: { x: number; y: number };
    cliente?: { x: number; y: number };
    data?: { x: number; y: number };
  };
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

function formatarData(dataStr: string): string {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function calcularTotalBloco(bloco: BlocoServico, diarias: number): number {
  if (bloco.valorManual > 0) return bloco.valorManual;
  if (!bloco.itens || bloco.itens.length === 0) return 0;
  return (bloco as any).itens.reduce((acc: number, item: any) => {
    return acc + (item.valorDia || 0) * (item.quantidade || 1) * diarias;
  }, 0);
}

async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao baixar PDF: ${url}`);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function gerarOrcamentoPdf(
  orcamento: OrcamentoParaPdf,
  config: ConfiguracaoOrcamento,
  primeiroNomeCliente: string = 'BORANOV'
): Promise<void> {
  try {
    const finalPdf = await PDFDocument.create();

    // ── FONTES TT CHOCOLATES (embedadas via fontkit) ────────────
    // Bold   → títulos, número, data, valores
    // Medium → nome do cliente na capa
    // Regular→ texto corrido, itens, observações
    finalPdf.registerFontkit(fontkit);

    const [boldBytes, mediumBytes, regularBytes] = await Promise.all([
      fetch(fontBoldUrl).then(r => r.arrayBuffer()),
      fetch(fontMediumUrl).then(r => r.arrayBuffer()),
      fetch(fontRegularUrl).then(r => r.arrayBuffer()),
    ]);

    const fontBold = await finalPdf.embedFont(boldBytes);
    const fontMedium = await finalPdf.embedFont(mediumBytes);
    const fontRegular = await finalPdf.embedFont(regularBytes);

    // Largura de um label para posicionar o valor logo depois.
    // Mede a versão SEM acentos (o acento não altera a largura real da letra,
    // mas nesta fonte infla o "advance" medido). O texto continua sendo
    // desenhado com acento normalmente — só o cálculo de posição ignora.
    const larguraLabel = (texto: string, size = 9) =>
      fontBold.widthOfTextAtSize(
        texto.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        size
      );

    const corVermelha = hexToRgb('#dd4d4c');
    const corPreta = hexToRgb('#535353');
    const corCinza = hexToRgb('#888888');
    const corBranca = rgb(1, 1, 1);
    const corEscura = hexToRgb('#222222');
    const corLinha = hexToRgb('#e0e0e0');

    // ============================================================
    // PÁGINA 1 — CAPA
    // ============================================================
    if (config.capaPdfUrl) {
      const capaBytes = await fetchPdfBytes(config.capaPdfUrl);
      const capaDoc = await PDFDocument.load(capaBytes);
      const [capaPage] = await finalPdf.copyPages(capaDoc, [0]);
      const { width, height } = capaPage.getSize();
      const escala = width / 2481;

      // Coordenadas vindas do editor visual (se existirem).
      // Converte proporção (origem topo-esquerdo, y para baixo) para o
      // sistema do pdf-lib (origem rodapé-esquerdo, y para cima, na linha de base).
      const coordsCapa = (config as any).capaCoords;
      const capaX = (c: { x: number; y: number }) => c.x * width;
      const capaY = (c: { x: number; y: number }, size: number, font: any) =>
        height - (c.y * height) - font.heightAtSize(size);

      // Número do orçamento
      const numText = orcamento.numero;
      const numSize = 22 * (height / 3509) * (300 / 72);
      let numX: number;
      let numY: number;
      if (coordsCapa?.numero) {
        numX = capaX(coordsCapa.numero);
        numY = capaY(coordsCapa.numero, numSize, fontBold);
      } else {
        numX = 1920.72 * escala;
        numY = height - (177.46 * (height / 3509)) - 10;
      }
      capaPage.drawText(numText, {
        x: numX,
        y: numY,
        size: numSize,
        font: fontBold,
        color: corBranca,
      });

      // Nome do cliente (TT Chocolates Medium)
      const nomeCompleto = orcamento.nomeCliente.toUpperCase();
      const palavras = nomeCompleto.split(' ');
      const nomeExibir = palavras.length > 2 ? palavras.slice(0, 2).join(' ') : nomeCompleto;
      const clienteSize = 22 * (height / 3509) * (300 / 72);
      let clienteX: number;
      let clienteY: number;
      if (coordsCapa?.cliente) {
        // Editor: centralizado no ponto arrastado (independe do tamanho do nome)
        const clienteTextW = fontMedium.widthOfTextAtSize(nomeExibir, clienteSize);
        clienteX = capaX(coordsCapa.cliente) - clienteTextW / 2;
        clienteY = capaY(coordsCapa.cliente, clienteSize, fontMedium);
      } else {
        // Fallback: centralizado na caixa (comportamento validado)
        const caixaClienteW = 453.93 * escala;
        const clienteTextW = fontMedium.widthOfTextAtSize(nomeExibir, clienteSize);
        clienteX = (1012.44 * escala) + (caixaClienteW / 2) - (clienteTextW / 2);
        clienteY = height - (1444.46 * (height / 3509)) - 5;
      }
      capaPage.drawText(nomeExibir, {
        x: clienteX,
        y: clienteY,
        size: clienteSize,
        font: fontMedium,
        color: corPreta,
      });

      // Data do orçamento com label
      const hoje = new Date();
      const dataFormatada = hoje.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
      });
      const dataLabel = `Data do orçamento: ${dataFormatada}`;
      const dataSize = 11 * (height / 3509) * (300 / 72);  // fonte menor
      let dataX: number;
      let dataY: number;
      if (coordsCapa?.data) {
        dataX = capaX(coordsCapa.data);
        dataY = capaY(coordsCapa.data, dataSize, fontBold);
      } else {
        dataX = 30 * escala;                             // mais para esquerda
        dataY = height - (3282.81 * (height / 3509)) - 5;
      }
      capaPage.drawText(dataLabel, {
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
      y = pageHeight - 75;
    };

    const checkNovaPage = async (espacoNecessario: number) => {
      if (y - espacoNecessario < bottomLimit) {
        await adicionarPagina();
      }
    };

    await adicionarPagina();

    const lineHeight = 18;
    const sectionGap = 14;
    const labelGap = 2; // respiro entre o label (negrito) e o valor

    const drawLinha = () => {
      page.drawLine({
        start: { x: marginLeft, y },
        end: { x: marginLeft + contentWidth, y },
        thickness: 0.5,
        color: corLinha,
      });
      y -= 8;
    };

    const drawSecaoTitulo = async (texto: string) => {
      await checkNovaPage(40);
      page.drawRectangle({
        x: marginLeft,
        y: y - 6,
        width: contentWidth,
        height: 22,
        color: corVermelha,
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

    // ── CABEÇALHO — DADOS DA PROPOSTA ───────────────────────────
    page.drawText('DADOS DA PROPOSTA', {
      x: marginLeft,
      y,
      size: 16,
      font: fontBold,
      color: corEscura,
    });
    y -= 6;

    page.drawLine({
      start: { x: marginLeft, y },
      end: { x: marginLeft + contentWidth, y },
      thickness: 1.5,
      color: corVermelha,
    });
    y -= 14;

    // Responsável
    if (orcamento.responsavel) {
      page.drawText('Responsável:', {
        x: marginLeft,
        y,
        size: 9,
        font: fontBold,
        color: corCinza,
      });
      page.drawText(orcamento.responsavel, {
        x: marginLeft + larguraLabel('Responsável:') + labelGap,
        y,
        size: 9,
        font: fontRegular,
        color: corPreta,
      });
      y -= lineHeight;
    }

    // Local + Data do evento na mesma linha
    const temLocal = !!orcamento.localEvento;
    const temData = !!orcamento.dataEventoInicio;

    if (temLocal || temData) {
      if (temLocal) {
        page.drawText('Local:', {
          x: marginLeft,
          y,
          size: 9,
          font: fontBold,
          color: corCinza,
        });
        page.drawText(orcamento.localEvento, {
          x: marginLeft + larguraLabel('Local:') + labelGap,
          y,
          size: 9,
          font: fontRegular,
          color: corPreta,
        });
      }
      if (temData) {
        const dataInicio = formatarData(orcamento.dataEventoInicio);
        const dataFim = orcamento.dataEventoFim ? formatarData(orcamento.dataEventoFim) : '';
        const dataTexto = dataFim ? `${dataInicio} a ${dataFim}` : dataInicio;
        page.drawText('Data:', {
          x: marginLeft + contentWidth / 2,
          y,
          size: 9,
          font: fontBold,
          color: corCinza,
        });
        page.drawText(dataTexto, {
          x: marginLeft + contentWidth / 2 + larguraLabel('Data:') + labelGap,
          y,
          size: 9,
          font: fontRegular,
          color: corPreta,
        });
      }
      y -= lineHeight + 4;
    }

    y -= sectionGap;

    // ── DADOS DO CLIENTE ─────────────────────────────────────────
    await drawSecaoTitulo('Dados do Cliente');

    page.drawText('Empresa:', {
      x: marginLeft + 8,
      y,
      size: 9,
      font: fontBold,
      color: corCinza,
    });
    page.drawText(orcamento.nomeCliente, {
      x: marginLeft + 8 + larguraLabel('Empresa:') + labelGap,
      y,
      size: 9,
      font: fontRegular,
      color: corPreta,
    });
    y -= lineHeight;

    if (orcamento.cnpjCpf || orcamento.telefone) {
      if (orcamento.cnpjCpf) {
        page.drawText('CNPJ/CPF:', {
          x: marginLeft + 8,
          y,
          size: 9,
          font: fontBold,
          color: corCinza,
        });
        page.drawText(orcamento.cnpjCpf, {
          x: marginLeft + 8 + larguraLabel('CNPJ/CPF:') + labelGap,
          y,
          size: 9,
          font: fontRegular,
          color: corPreta,
        });
      }
      if (orcamento.telefone) {
        page.drawText('Telefone:', {
          x: marginLeft + contentWidth / 2,
          y,
          size: 9,
          font: fontBold,
          color: corCinza,
        });
        page.drawText(orcamento.telefone, {
          x: marginLeft + contentWidth / 2 + larguraLabel('Telefone:') + labelGap,
          y,
          size: 9,
          font: fontRegular,
          color: corPreta,
        });
      }
      y -= lineHeight + sectionGap;
    }

    // ── BLOCOS DE SERVIÇO ────────────────────────────────────────
    for (const bloco of orcamento.blocos) {
      if (!bloco.nome) continue;
      const itensPdf = (bloco.itens || []) as any[];
      await drawSecaoTitulo(bloco.nome);

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

      // Valor do bloco — automático ou manual
      const totalBloco = calcularTotalBloco(bloco, orcamento.diarias || 1);
      if (totalBloco > 0) {
        await checkNovaPage(30);
        y -= 4;
        const valorText = fmt(totalBloco);
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

    // ── DESPESAS DE DESLOCAMENTO ─────────────────────────────────
    const totalDesp = (orcamento.despAlimentacao || 0) +
      (orcamento.despTransporte || 0) +
      (orcamento.despHospedagem || 0) +
      (orcamento.despPedagio || 0);

    const despesas = [
      { label: 'Alimentação', valor: orcamento.despAlimentacao },
      { label: 'Transporte', valor: orcamento.despTransporte },
      { label: 'Hospedagem', valor: orcamento.despHospedagem },
      { label: 'Pedágio / Estacionamento', valor: orcamento.despPedagio },
    ].filter(d => (d.valor || 0) > 0);

    if (despesas.length > 0) {
      await drawSecaoTitulo('Despesas Extras');
      for (const desp of despesas) {
        await checkNovaPage(lineHeight);
        page.drawText(desp.label, {
          x: marginLeft + 8,
          y,
          size: 9,
          font: fontRegular,
          color: corCinza,
        });
        y -= lineHeight;
      }
      await checkNovaPage(20);
      page.drawLine({
        start: { x: marginLeft, y },
        end: { x: marginLeft + contentWidth, y },
        thickness: 0.5,
        color: corLinha,
      });
      y -= 10;
      const totalDespText = fmt(totalDesp);
      const totalDespW = fontBold.widthOfTextAtSize(totalDespText, 9);
      page.drawText('Total', {
        x: marginLeft + 8,
        y,
        size: 9,
        font: fontBold,
        color: corPreta,
      });
      page.drawText(totalDespText, {
        x: marginLeft + contentWidth - totalDespW,
        y,
        size: 9,
        font: fontBold,
        color: corPreta,
      });
      y -= lineHeight + sectionGap;
    }

    // ── PROPOSTA FINAL ───────────────────────────────────────────
    const blocosComValor = orcamento.blocos.filter(b => b.nome);
    const totalFinal = blocosComValor.reduce((acc, b) =>
      acc + calcularTotalBloco(b, orcamento.diarias || 1), 0);

    await drawSecaoTitulo('Proposta Final');

    for (const bloco of blocosComValor) {
      await checkNovaPage(lineHeight + 8);
      const totalBloco = calcularTotalBloco(bloco, orcamento.diarias || 1);
      const valorBloco = fmt(totalBloco);
      const vW = fontBold.widthOfTextAtSize(valorBloco, 9);
      page.drawText(bloco.nome, {
        x: marginLeft + 8,
        y,
        size: 9,
        font: fontBold,
        color: corPreta,
      });
      if (totalBloco > 0) {
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

    // TOTAL
    await checkNovaPage(40);
    y -= 8;
    page.drawRectangle({
      x: marginLeft,
      y: y - 6,
      width: contentWidth,
      height: 26,
      color: corEscura,
    });
    page.drawText('TOTAL', {
      x: marginLeft + 10,
      y: y,
      size: 11,
      font: fontBold,
      color: corBranca,
    });
    const totalText = fmt(orcamento.valorCliente || totalFinal);
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
      color: corEscura,
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

    // ── EXTRAS ───────────────────────────────────────────────────
    const extrasValidos = orcamento.extras.filter(e => e.nome && (e.valorDia * e.diarias) > 0);
    if (extrasValidos.length > 0) {
      await drawSecaoTitulo('Extras Opcionais');
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

    // ── OBSERVAÇÕES ──────────────────────────────────────────────
    if (orcamento.observacoes) {
      await checkNovaPage(40);
      y -= sectionGap;
      page.drawText('DADOS DE ENTREGA DO MATERIAL', {
        x: marginLeft,
        y,
        size: 9,
        font: fontBold,
        color: corEscura,
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
      }
    }

    // ── DOWNLOAD ─────────────────────────────────────────────────
    const pdfBytes = await finalPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Orcamento_${orcamento.numero}_${primeiroNomeCliente}_BORANOV.pdf`;
    link.click();
    URL.revokeObjectURL(url);

  } catch (error: any) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error(error.message || 'Erro ao gerar PDF');
  }
}
