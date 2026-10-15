import { createFileRoute } from '@tanstack/react-router';
import { StruxEditor } from '@/components/strux/strux-editor';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'STRUX — Análise estrutural 2D' },
    { name: 'description', content: 'Modele vigas, pórticos planos e treliças com análise estrutural por rigidez direta.' },
    { property: 'og:title', content: 'STRUX — Análise estrutural 2D' },
    { property: 'og:description', content: 'Editor interativo de vigas, pórticos, treliças e carregamentos estruturais.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: StruxEditor,
});