import {
  LayoutDashboard,
  Library,
  Users,
  Package,
  LayoutTemplate,
  CreditCard,
  Settings,
  Shield,
  CheckSquare,
  UsersRound,
  FileText,
  Database,
  Tv,
  TrendingUp,
  Clapperboard,
  type LucideIcon
} from 'lucide-react';

export interface AppModule {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  /**
   * Papéis que terão acesso por padrão quando o módulo ainda não existir
   * no documento `settings/permissions` do Firestore. Após salvo, a matriz
   * de permissões passa a ser a única fonte da verdade.
   */
  roles?: string[];
}

export const ALL_MODULES: AppModule[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { id: 'projetos', icon: Library, label: 'Projetos', path: '/projetos' },
  { id: 'planejamentos', icon: FileText, label: 'Planejamentos', path: '/meus-planejamentos' },
  { id: 'minhas_demandas', icon: FileText, label: 'Minhas Demandas', path: '/minhas-demandas' },
  { id: 'producao', icon: Clapperboard, label: 'Produção', path: '/producao' },
  { id: 'clientes', icon: Users, label: 'Clientes', path: '/clients' },
  { id: 'prospectar', icon: TrendingUp, label: 'Prospectar', path: '/prospectar', roles: ['master', 'admin', 'redator'] },
  { id: 'orcamentos', icon: FileText, label: 'Orçamentos', path: '/orcamentos', roles: ['master', 'admin'] },
  { id: 'equipe', icon: UsersRound, label: 'Equipe', path: '/equipe' },
  { id: 'pacotes', icon: Package, label: 'Serviços', path: '/packages' },
  { id: 'modelos', icon: LayoutTemplate, label: 'Modelos', path: '/modelos' },
  { id: 'creditos', icon: CreditCard, label: 'Créditos', path: '/credits' },
  { id: 'configuracoes', icon: Settings, label: 'Configurações', path: '/configuracoes' },
  { id: 'tarefas', icon: CheckSquare, label: 'Tarefas Diárias', path: '/tarefas' },
  { id: 'teleprompter', icon: Tv, label: 'Teleprompter', path: '/teleprompter' },
  { id: 'painel_master', icon: Shield, label: 'Painel Master', path: '/painel-master' },
  { id: 'diagnostico', icon: Database, label: 'Teste Tabela', path: '/diagnostico' }
];
