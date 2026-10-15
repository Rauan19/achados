import {NextResponse} from 'next/server';
import {lerEstado} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

// A tela do WhatsApp consulta isso a cada 2s (QR, status dos números, atividade)
export async function GET() {
  return NextResponse.json(await lerEstado(), {headers: {'Cache-Control': 'no-store'}});
}
