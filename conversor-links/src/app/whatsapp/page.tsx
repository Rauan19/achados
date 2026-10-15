import {PainelWhatsApp} from '@/components/PainelWhatsApp';
import {lerEstado} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export default async function PaginaWhatsApp() {
  return <PainelWhatsApp inicial={await lerEstado()} />;
}
