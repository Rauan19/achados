import {Conversor} from '@/components/Conversor';
import {listarOfertas, sql} from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const historico = await listarOfertas().catch(() => []);
  return <Conversor historico={historico} bancoAtivo={sql !== null} />;
}
