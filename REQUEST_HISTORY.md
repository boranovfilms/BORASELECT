# Histórico de Solicitações - BORA SELECT

Este arquivo registra as solicitações feitas durante o desenvolvimento desta aplicação.

## 1. Criação Inicial do Projeto
- **Solicitação:** Desenvolver uma plataforma profissional de gerenciamento para cinema e fotografia, focada na entrega de projetos e seleção de material pelos clientes.
- **Funcionalidades Implementadas:** 
    - Estrutura base com React e Tailwind CSS.
    - Integração com Firebase (Autenticação e Firestore).
    - Configuração de regras de segurança e schema para projetos e seleções.

## 2. Registro de Histórico
- **Solicitação:** "poderia gerar um arquivo com todas as solicitações que ja fizemos aqui?"
- **Data:** 05/05/2026
- **Status:** Concluído.

## 3. Migração para Cloudflare (R2/Stream)
- **Solicitação:** Substituir a integração do Google Drive pelo ecossistema Cloudflare.
- **Motivo:** Melhorar a velocidade de carregamento, estabilidade do player e profissionalismo da entrega.
- **Mudanças Realizadas:** 
    - Removido player de compatibilidade do Drive (iframe).
    - Implementado player nativo para links diretos de CDN.
    - Atualizado `server.ts` e `ProjectConfig` para suportar novas fontes de mídia.
    - Adicionadas variáveis de ambiente para Cloudflare R2.
- **Data:** 06/05/2026
- **Status:** Implementado (Aguardando chaves de API do usuário).
