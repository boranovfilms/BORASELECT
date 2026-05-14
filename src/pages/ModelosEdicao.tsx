import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft,
  Plus, 
  LayoutTemplate, 
  GripVertical, 
  Clock, 
  UserCircle, 
  ShieldAlert, 
  CheckCircle2, 
  Settings2,
  MoreVertical,
  PlayCircle,
  Save,
  Loader2,
  Camera,
  Video,
  Mic,
  MonitorPlay,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { modelosService, WorkflowModel, Stage } from '../services/modelosService';
